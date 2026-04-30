import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import IncomingCallModal from "./components/IncomingCallModal"; // Yeni yaradacağın komponent

function App() {
  const [user, setUser] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    // 1. İstifadəçinin daxil olub-olmadığını yoxla
    const unsubscribeAuth = auth.onAuthStateChanged((loggedInUser) => {
      if (loggedInUser) {
        setUser(loggedInUser);
        const userRef = doc(db, "users", loggedInUser.uid);

        // --- ONLINE STATUS MƏNTİQİ ---
        updateDoc(userRef, { status: "online" });

        const handleOffline = () => updateDoc(userRef, { status: "offline" });
        window.addEventListener("beforeunload", handleOffline);

        // --- CANLI ZƏNG VƏ MESAJ DİNLƏYİCİSİ ---
        const unsubscribeUserDoc = onSnapshot(userRef, (snapshot) => {
          const userData = snapshot.data();
          if (userData?.incomingCall) {
            // Əgər bazada gələn zəng məlumatı varsa, modalı aç
            setIncomingCall(userData.incomingCall);
          } else {
            setIncomingCall(null);
          }
        });

        return () => {
          handleOffline();
          window.removeEventListener("beforeunload", handleOffline);
          unsubscribeUserDoc();
        };
      } else {
        setUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <div className="App">
      {/* Əgər zəng varsa, modalı göstər */}
      {incomingCall && (
        <IncomingCallModal 
          callData={incomingCall} 
          onReject={() => {/* Bazada incomingCall-u sil */}}
        />
      )}
      
      {/* Səhifələrin (Routing) */}
    </div>
  );
}