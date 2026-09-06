// Small transaction-capable REST adapter for maintenance with an existing CLI login.
// Credentials remain in memory and are sent only to Google's Firestore API.
function firestoreRest(accessToken, projectId) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const decode = v => v.timestampValue ? {toMillis:()=>Date.parse(v.timestampValue), toDate:()=>new Date(v.timestampValue)}
    : v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue) ?? v.booleanValue
    ?? (v.arrayValue ? (v.arrayValue.values || []).map(decode) : v.mapValue ? fields(v.mapValue.fields) : null);
  const fields = value => Object.fromEntries(Object.entries(value || {}).map(([k,v])=>[k,decode(v)]));
  const encode = v => v?.toMillis ? {timestampValue:new Date(v.toMillis()).toISOString()}
    : typeof v === 'number' ? {doubleValue:v} : typeof v === 'string' ? {stringValue:v}
    : typeof v === 'boolean' ? {booleanValue:v} : v === null ? {nullValue:null}
    : Array.isArray(v) ? {arrayValue:{values:v.map(encode)}} : {mapValue:{fields:encodeFields(v)}};
  const encodeFields = value => Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
  async function request(suffix, body) {
    const res = await fetch(base + suffix, {method:body?'POST':'GET',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if (res.status === 404) return null;
    const json = await res.json();
    if (!res.ok) throw Object.assign(new Error(json.error?.message || `Firestore ${res.status}`),{code:json.error?.status});
    return json;
  }
  const snapshot = d => ({id:d?.name.split('/').pop(),exists:!!d,data:()=>d?fields(d.fields):undefined});
  const doc = path => ({path,collection:name=>collection(`${path}/${name}`),get:async()=>snapshot(await request(`/${path}`))});
  const collection = path => {
    const bits=path.split('/'), collectionId=bits.pop(), parent=bits.length?'/'+bits.join('/'):'';
    const q={from:[{collectionId}]};
    const ref={doc:id=>doc(`${path}/${id}`),query:q,parent,
      where:(field,op,value)=>{q.where={fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:encode(value)}};return ref;},
      get:()=>query(ref)};
    return ref;
  };
  async function query(ref, transaction) {
    const rows=await request(`${ref.parent}:runQuery`,{structuredQuery:ref.query,...(transaction?{transaction}:{})});
    const docs=rows.filter(x=>x.document).map(x=>snapshot(x.document));
    return {docs,size:docs.length,empty:!docs.length};
  }
  return {doc,collection,runTransaction:async fn=>{
    for(let attempt=0;attempt<5;attempt++) {
      const {transaction}=await request(':beginTransaction',{options:{readWrite:{}}});
      const writes=[];
      try {
        const result=await fn({
          get:ref=>ref.query?query(ref,transaction):request(`/${ref.path}?transaction=${encodeURIComponent(transaction)}`).then(snapshot),
          set:(ref,value,options)=>writes.push({update:{name:`${root}/${ref.path}`,fields:encodeFields(value)},...(options?.merge?{updateMask:{fieldPaths:Object.keys(value)}}:{})}),
        });
        await request(':commit',{transaction,writes});
        return result;
      } catch(e) {
        await request(':rollback',{transaction}).catch(()=>{});
        if(e.code!=='ABORTED'||attempt===4)throw e;
      }
    }
  }};
}
module.exports={firestoreRest};
