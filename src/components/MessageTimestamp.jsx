import React from 'react';

// Display the stored send time in the reader's local timezone.
export default function MessageTimestamp({ createdAt, pending = false }) {
  const date = createdAt instanceof Date ? createdAt : createdAt?.toDate?.();
  const valid = date instanceof Date && Number.isFinite(date.getTime());
  const style = { display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 };
  if (!valid) return <span style={style}>{pending ? 'Sending…' : 'Date unavailable'}</span>;
  const pad = value => String(value).padStart(2, '0');
  const label = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return <time dateTime={date.toISOString()} title={date.toLocaleString()} style={style}>{label}</time>;
}
