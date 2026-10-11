# Line start times for a listening: python scripts/align-listening.py content/materials/NN/listening.mp3 content/materials/NN.json
# Prints a JSON array of start seconds per line (null = not matched; fill by hand from the neighbours).
# Align script lines to audio: word timestamps from faster-whisper, then greedy match line word sequences.
import json, re, sys
from faster_whisper import WhisperModel
audio, js = sys.argv[1], sys.argv[2]
data = json.load(open(js, encoding='utf-8'))
lines = data['lines'] if 'lines' in data else data['listening']['lines']
m = WhisperModel('small.en', device='cpu', compute_type='int8')
segs, _ = m.transcribe(audio, word_timestamps=True, language='en')
words = []
for s in segs:
    for w in s.words:
        t = re.sub(r"[^a-z0-9']", '', w.word.lower())
        if t: words.append((t, w.start, w.end))
norm = lambda s: [x for x in (re.sub(r"[^a-z0-9']", '', t.lower()) for t in re.sub(r'\[[^\]]*\]', ' ', s).replace('-', ' ').split()) if x]
import difflib
script=[]; owner=[]
for li, ln in enumerate(lines):
    for t in norm(ln['t']): script.append(t); owner.append(li)
wt=[w[0] for w in words]
sm=difflib.SequenceMatcher(None, script, wt, autojunk=False)
first={}
for a,b,n in sm.get_matching_blocks():
    for k in range(n):
        li=owner[a+k]
        # keep the earliest matched script token per line, with its offset inside the line
        if li not in first: first[li]=(a+k, b+k)
out=[]
for li in range(len(lines)):
    if li in first:
        a,b=first[li]
        lead=a-owner.index(li)            # tokens of the line before the first match
        out.append(round(max(0, words[max(0,b-lead)][1]),2))
    else: out.append(None)
print(json.dumps(out))
print(' '.join(w[0] for w in words), file=sys.stderr)
