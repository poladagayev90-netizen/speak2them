import React, { useEffect, useState } from 'react';

// The photo half of an avatar.
//
// Every avatar in the app used to be written the same way:
//
//   {user.photo ? <img src={user.photo} alt={user.name} /> : initial}
//
// which has one failure mode, and it is not rare: a photo URL that 404s or is
// blocked. `user.photo` is still truthy, so the initial fallback never runs,
// and the browser draws its broken-image glyph — with the alt text beside it.
// On the leaderboard that meant a torn-page icon in three list rows and the
// winner's full name spilling out of a 74px circle.
//
// So the initial is ALWAYS rendered by the caller, and this sits on top of it:
// present while the image loads and displays, gone the moment it fails. The
// caller keeps its own sizing and class — this is deliberately just the <img>,
// because the six call sites have six different frames around it.
//
// `alt` is empty on purpose. The name is already text next to every one of
// these, so announcing it again is noise to a screen reader, and an empty alt
// is what stops a failed image from painting its alt text.
export default function AvatarImage({ src, style, className }) {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt: the same <img> is reused when a list
  // re-renders with different people in it, and a sticky `failed` would hide a
  // perfectly good photo.
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
}
