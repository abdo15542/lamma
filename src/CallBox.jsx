import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CallBox({ profile }) {
  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVidRef = useRef(null);
  const remoteVidRef = useRef(null);
  const peerChansRef = useRef({});
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  function setCallBoth(c) {
    callRef.current = c;
    setCall(c);
  }

  async function sendSignal(peerId, event, payload) {
    try {
      let ch = peerChansRef.current[peerId];
      if (!ch) {
        ch = supabase.channel("call:user:" + peerId);
        peerChansRef.current[peerId] = ch;
        await ch.subscribe();
      }
      await ch.send({ type: "broadcast", event, payload });
    } catch (e) {}
  }

  async function makePC(peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, "ice-candidate", { candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      const s = e.streams && e.streams[0];
      if (s) {
        remoteStreamRef.current = s;
        if (remoteVidRef.current) remoteVidRef.current.srcObject = s;
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function endCall(notifyPeer) {
    const c = callRef.current;
    if (notifyPeer && c) {
      try { await sendSignal(c.peerId, "call-end", {}); } catch (e) {}
    }
    try { if (pcRef.current) pcRef.current.close(); } catch (e) {}
    try {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setMuted(false);
    setCamOff(false);
    setSecs(0);
    setCallBoth(null);
  }

  async function startCall(peerId, peerName, kind) {
    if (callRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
      localStreamRef.current = stream;
      setCallBoth({ peerId, peerName, kind, dir: "out", status: "calling", msg: "" });
      const pc = await makePC(peerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(peerId, "call-offer", { from: profileRef.current.id, fromName: profileRef.current.username, kind, sdp: offer });
    } catch (e) {
      setCallBoth({ peerId, peerName, kind, dir: "out", status: "ended", msg: "تعذر الوصول للميكروفون أو الكاميرا — وافق على الإذن وحاول من جديد" });
    }
  }

  async function acceptCall() {
    const c = callRef.current;
    if (!c || !c.offer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: c.kind === "video" });
      localStreamRef.current = stream;
      const pc = await makePC(c.peerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(c.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(c.peerId, "call-answer", { sdp: answer });
      setCallBoth({ ...c, status: "active" });
    } catch (e) {
      setCallBoth({ ...c, status: "ended", msg: "تعذر الوصول للميكروفون أو الكاميرا — وافق على الإذن وحاول من جديد" });
    }
  }

  async function declineCall() {
    const c = callRef.current;
    if (c) { try { await sendSignal(c.peerId, "call-decline", {}); } catch (e) {} }
    endCall(false);
  }

  useEffect(() => {
    const h = (e) => {
      const d = (e && e.detail) || {};
      if (d.peerId) startCall(d.peerId, d.peerName || "مستخدم", d.kind || "audio");
    };
    window.addEventListener("lamma-call", h);
    return () => window.removeEventListener("lamma-call", h);
  }, []);

  useEffect(() => {
    if (!profile || !profile.id) return undefined;
    const ch = supabase.channel("call:user:" + profile.id);
    ch.on("broadcast", { event: "call-offer" }, ({ payload }) => {
      const p = payload || {};
      if (callRef.current) { sendSignal(p.from, "call-busy", {}); return; }
      try { if (navigator.vibrate) navigator.vibrate([300, 200, 300]); } catch (e) {}
      setCallBoth({ peerId: p.from, peerName: p.fromName || "مستخدم", kind: p.kind || "audio", dir: "in", status: "ringing", offer: p.sdp, msg: "" });
    });
    ch.on("broadcast", { event: "call-answer" }, async ({ payload }) => {
      const pc = pcRef.current;
      const c = callRef.current;
      if (pc && c && c.dir === "out" && payload && payload.sdp) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          setCallBoth({ ...c, status: "active" });
        } catch (e) {}
      }
    });
    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      const pc = pcRef.current;
      if (pc && payload && payload.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (e) {}
      }
    });
    ch.on("broadcast", { event: "call-decline" }, () => {
      const c = callRef.current;
      if (c) setCallBoth({ ...c, status: "ended", msg: "تم رفض المكالمة" });
    });
    ch.on("broadcast", { event: "call-busy" }, () => {
      const c = callRef.current;
      if (c) setCallBoth({ ...c, status: "ended", msg: "الطرف الآخر في مكالمة أخرى" });
    });
    ch.on("broadcast", { event: "call-end" }, () => { endCall(false); });
    ch.subscribe();
    return () => { try { supabase.removeChannel(ch); } catch (e) {} };
  }, [profile && profile.id]);

  useEffect(() => {
    if (localVidRef.current && localStreamRef.current) localVidRef.current.srcObject = localStreamRef.current;
    if (remoteVidRef.current && remoteStreamRef.current) remoteVidRef.current.srcObject = remoteStreamRef.current;
  }, [call]);

  useEffect(() => {
    if (call && call.status === "active") {
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
    }
    return undefined;
  }, [call && call.status]);

  function toggleMute() {
    const next = !muted;
    try {
      if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !next; });
    } catch (e) {}
    setMuted(next);
  }

  function toggleCam() {
    const next = !camOff;
    try {
      if (localStreamRef.current) localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !next; });
    } catch (e) {}
    setCamOff(next);
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + (r < 10 ? "0" + r : r);
  }

  if (!call) return null;
  const isVideo = call.kind === "video";
  const statusText = call.status === "calling" ? "جارٍ الاتصال..." : call.status === "ringing" ? "مكالمة واردة..." : call.status === "active" ? "متصل — " + fmt(secs) : call.msg || "";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }}>
      <b style={{ fontSize: 22 }}>@{call.peerName}</b>
      <div style={{ color: "#ccc" }}>{isVideo ? "🎥 مكالمة فيديو" : "📞 مكالمة صوتية"} · {statusText}</div>
      {isVideo && (
        <video ref={remoteVidRef} autoPlay playsInline style={{ width: "100%", maxHeight: "55%", background: "#111", borderRadius: 16, objectFit: "cover" }} />
      )}
      {isVideo && call.status === "active" && (
        <video ref={localVidRef} autoPlay playsInline muted style={{ position: "absolute", bottom: 110, right: 16, width: 110, height: 150, background: "#222", borderRadius: 12, objectFit: "cover", border: "2px solid #fff" }} />
      )}
      {!isVideo && <video ref={remoteVidRef} autoPlay playsInline style={{ display: "none" }} />}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {call.status === "ringing" && call.dir === "in" && (
          <button onClick={acceptCall} style={{ background: "#16a34a", color: "#fff", border: 0, borderRadius: 999, padding: "14px 22px", fontSize: 18 }}>✅ قبول</button>
        )}
        {call.status === "ringing" && call.dir === "in" && (
          <button onClick={declineCall} style={{ background: "#dc2626", color: "#fff", border: 0, borderRadius: 999, padding: "14px 22px", fontSize: 18 }}>❌ رفض</button>
        )}
        {call.status === "active" && (
          <button onClick={toggleMute} style={{ background: muted ? "#444" : "#1f2937", color: "#fff", border: "1px solid #555", borderRadius: 999, padding: "12px 18px" }}>{muted ? "🔇 كتم الصوت (مفعّل)" : "🎤 كتم الصوت"}</button>
        )}
        {call.status === "active" && isVideo && (
          <button onClick={toggleCam} style={{ background: camOff ? "#444" : "#1f2937", color: "#fff", border: "1px solid #555", borderRadius: 999, padding: "12px 18px" }}>{camOff ? "📷 الكاميرا متوقفة" : "📷 إيقاف الكاميرا"}</button>
        )}
        {(call.status === "calling" || call.status === "active") && (
          <button onClick={() => endCall(true)} style={{ background: "#dc2626", color: "#fff", border: 0, borderRadius: 999, padding: "14px 22px", fontSize: 18 }}>📴 إنهاء</button>
        )}
        {call.status === "ended" && (
          <button onClick={() => endCall(false)} style={{ background: "#1f2937", color: "#fff", border: "1px solid #555", borderRadius: 999, padding: "12px 22px" }}>إغلاق</button>
        )}
      </div>
    </div>
  );
}
