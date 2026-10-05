import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import useOnlineNow from '../hooks/useOnlineNow';
import AvatarImage from './ui/AvatarImage';
import './OnlineNow.css';

// "Online now": learners who are in the app at this moment, one tap from a
// call. A stop-gap until the weekly plan carries everyone (Polad 2026-10-06),
// switched in Admin → Matching (appConfig/features.onlineNow). The server
// decides who may appear (blocks, "don't pair me again", minors) — this only
// draws the list; the call itself is checked again by canPair.
const firstName = (n) => String(n || '').split(' ')[0] || 'Someone';

export default function OnlineNow({ enabled = true }) {
  const people = useOnlineNow(enabled);
  const navigate = useNavigate();
  if (!people.length) return null;
  return (
    <section className="on-now" aria-label="Online now">
      <p className="on-now-head">
        <span className="on-now-dot" aria-hidden="true" />
        Online now
        <span className="on-now-count">{people.length}</span>
      </p>
      <ul className="on-now-list">
        {people.map((p) => (
          <li key={p.uid} className="on-now-item">
            <span className="on-now-avatar" aria-hidden="true">
              {firstName(p.name).charAt(0).toUpperCase()}
              {p.photo && <AvatarImage src={p.photo} className="on-now-photo" />}
              <span className={`on-now-badge ${p.busy ? 'is-busy' : ''}`} />
            </span>
            <span className="on-now-name">{firstName(p.name)}</span>
            <span className="on-now-level">{p.level ? String(p.level).slice(0, 2) : ' '}</span>
            <button
              type="button"
              className="on-now-call"
              disabled={p.busy}
              onClick={() => navigate(`/chat/${p.uid}`, { state: { autoCall: true } })}
              aria-label={p.busy ? `${firstName(p.name)} is in a call` : `Call ${firstName(p.name)}`}
            >
              {p.busy ? 'In a call' : <><Phone size={14} aria-hidden="true" /> Call</>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
