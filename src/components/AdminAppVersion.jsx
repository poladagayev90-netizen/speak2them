import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Smartphone } from 'lucide-react';
import { db } from '../firebase';
import { Button } from './ui';
import './AdminApplicants.css';

// Admin → Students: which Android versions are current (appConfig/version).
// Play itself tells a Play-installed app that an update is out; these two
// numbers cover the rest (utils/appUpdate.js):
//   latest — a test APK (not from Play) older than this sees «Update»;
//   min    — anything older is too old to use: Play's full-screen update opens
//            on its own and the banner cannot be dismissed. Raise it only after
//            that version is live on Play, or people are sent to an update
//            that is not there yet.
export default function AdminAppVersion() {
  const [cfg, setCfg] = useState(null);
  const [latest, setLatest] = useState('');
  const [min, setMin] = useState('');
  const [state, setState] = useState('');
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'version'), (snap) => {
    const a = (snap.exists() && snap.data().android) || {};
    setCfg(a);
    setLatest(a.latest ? String(a.latest) : '');
    setMin(a.min ? String(a.min) : '');
  }, () => setCfg({})), []);

  const save = async () => {
    const l = Number(latest) || 0;
    const m = Number(min) || 0;
    if (m > l && l) { setState('The minimum cannot be above the latest.'); return; }
    setState('saving');
    try {
      await setDoc(doc(db, 'appConfig', 'version'), { android: { latest: l, min: m }, updatedAt: serverTimestamp() }, { merge: true });
      setState('Saved.');
    } catch { setState('Could not save.'); }
  };

  if (cfg === null) return null;
  return (
    <section className="aa-panel">
      <h3 className="aa-h"><Smartphone size={16} /> Android app version</h3>
      <p className="aa-meta">versionCode numbers (v30 = 30). Raise «min» only once that version is live on Google Play.</p>
      <div className="aa-filters">
        <label className="aa-meta">Latest <input className="aa-input aa-input--num" inputMode="numeric" value={latest} onChange={(e) => setLatest(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="aa-meta">Min <input className="aa-input aa-input--num" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></label>
        <Button size="sm" variant="secondary" onClick={save} disabled={state === 'saving'}>Save</Button>
      </div>
      {state && state !== 'saving' && <p className={state === 'Saved.' ? 'aa-ok' : 'aa-error'} role="status">{state}</p>}
    </section>
  );
}
