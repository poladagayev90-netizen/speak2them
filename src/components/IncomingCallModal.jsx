import React from 'react';

export default function IncomingCallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  return (
    <div className="incoming-call">
      <p>📞 {call.callerName} is calling you...</p>
      <div className="incoming-call-buttons">
        <button className="btn-accept" onClick={onAccept}>✅ Accept</button>
        <button className="btn-reject" onClick={onReject}>❌ Decline</button>
      </div>
    </div>
  );
}
