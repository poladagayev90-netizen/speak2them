import React from 'react';

export default function IncomingCallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  return (
    <div className="incoming-call">
      <p>📞 {call.callerName} sizi zəng edir...</p>
      <div className="incoming-call-buttons">
        <button className="btn-accept" onClick={onAccept}>✅ Qəbul et</button>
        <button className="btn-reject" onClick={onReject}>❌ Rədd et</button>
      </div>
    </div>
  );
}
