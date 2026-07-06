import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FUNCTIONS_BASE } from "../constants";
import { getTodayContent } from "../data/weeklyContent";
import { auth } from "../firebase";

export default function AIChat({ user }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle, recording, processing, speaking
  const [history, setHistory] = useState([]);
  const [callSeconds, setCallSeconds] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const currentAudioRef = useRef(null);

  const content = getTodayContent();
  const topic = content?.topic || "General";
  const userLevel = user?.level || "B1";

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCallSeconds(s => s + 1);
    }, 1000);
    return () => {
      clearInterval(timerRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    if (status === "speaking" && currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    setStatus("recording");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200); // chunk every 200ms
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("idle");
      alert("Mikrofona icazə verilmədi!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = async () => {
        setStatus("processing");
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioToAI(audioBlob);
      };
      mediaRecorderRef.current.stop();
    } else {
      setStatus("idle");
    }
  };

  const sendAudioToAI = async (blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(",")[1];
        const idToken = await auth.currentUser?.getIdToken(true);

        const res = await fetch(`${FUNCTIONS_BASE}/chatWithAI`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            base64Audio: base64Data,
            history: history,
            userLevel: userLevel,
            topic: topic
          })
        });

        if (!res.ok) {
          throw new Error("AI Server error");
        }

        const data = await res.json();
        const { transcript, aiReply, audioBase64 } = data;

        setHistory(prev => [
          ...prev, 
          { role: "user", content: transcript }, 
          { role: "assistant", content: aiReply }
        ]);

        playAIAudio(audioBase64);
      };
    } catch (error) {
      console.error("AI Communication error:", error);
      setStatus("idle");
      alert("Xəta baş verdi. Zəhmət olmasa yenidən yoxlayın.");
    }
  };

  const playAIAudio = (base64Audio) => {
    try {
      setStatus("speaking");
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        setStatus("idle");
      };

      audio.play().catch(e => {
        console.error("Audio playback failed:", e);
        setStatus("idle");
      });
    } catch (e) {
      console.error(e);
      setStatus("idle");
    }
  };

  const endCall = () => {
    navigate("/");
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="fullscreen-call" style={{ background: "#1e1e30", display: "flex", flexDirection: "column", height: "100dvh" }}>
      
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="call-avatar-big" style={{
          background: status === "speaking" ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #7c6ff7, #5b4de8)",
          boxShadow: status === "speaking" ? "0 0 40px rgba(16, 185, 129, 0.4)" : "none",
          transition: "all 0.3s ease"
        }}>
          🤖
        </div>
        <h2 className="call-peer-name" style={{ marginTop: "24px" }}>
          AInur
        </h2>
        <p className="call-status-text" style={{ color: "#a1a1aa" }}>
          {status === "processing" && "Düşünür... 🤔"}
          {status === "speaking" && "Danışır... 🔊"}
          {status === "recording" && "Sizi dinləyir... 🎙️"}
          {status === "idle" && `🟢 ${formatTime(callSeconds)}`}
        </p>

        <div style={{ marginTop: "40px", padding: "0 20px", textAlign: "center", minHeight: "80px" }}>
          {status === "processing" ? (
            <div className="typing-indicator" style={{ display: "inline-block" }}>
              <span>.</span><span>.</span><span>.</span>
            </div>
          ) : (
            <p style={{ color: "#e2e8f0", fontSize: "18px", fontStyle: "italic", maxWidth: "400px", margin: "0 auto", opacity: 0.8 }}>
              {history.length > 0 ? history[history.length - 1].content : "Hi! I am AInur. How can I help you practice today?"}
            </p>
          )}
        </div>
      </div>

      <div className="fullscreen-call-buttons" style={{ paddingBottom: "40px", display: "flex", justifyContent: "center", gap: "30px" }}>
        
        <button 
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerCancel={stopRecording}
          style={{
            width: "80px", height: "80px", borderRadius: "50%", border: "none",
            background: status === "recording" ? "#ef4444" : "#2e2e50",
            color: "#fff", fontSize: "32px", cursor: "pointer",
            boxShadow: status === "recording" ? "0 0 20px rgba(239, 68, 68, 0.5)" : "none",
            transition: "all 0.2s ease",
            display: "flex", alignItems: "center", justifyContent: "center",
            userSelect: "none", touchAction: "none"
          }}
        >
          🎤
        </button>
        
        <button className="call-btn-big end" onClick={endCall}>
          📵<span>End</span>
        </button>
      </div>

      <p style={{ textAlign: "center", color: "#888", fontSize: "14px", marginBottom: "40px" }}>
        Danışmaq üçün mikrofona basıb saxlayın
      </p>

    </div>
  );
}
