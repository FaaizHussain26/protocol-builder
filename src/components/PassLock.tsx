import { useEffect, useRef, useState } from 'react';
import { Layers, Lock, ArrowRight } from 'lucide-react';

// Simple passcode gate — NOT authentication, just a shared lock on the frontend.
// The passcode comes from VITE_APP_PASSCODE; the unlocked state persists in
// localStorage until the passcode changes or the user locks the app again.

const PASSCODE = (import.meta.env.VITE_APP_PASSCODE as string) || 'esource';
const STORAGE_KEY = 'pb_passlock';

// Obfuscation only (this is a lock, not security): don't store the passcode verbatim.
const token = (code: string) => btoa(`pb:${code}`);

export function isUnlocked(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === token(PASSCODE); } catch { return false; }
}

export function lockApp(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
}

export default function PassLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (code === PASSCODE) {
      try { localStorage.setItem(STORAGE_KEY, token(PASSCODE)); } catch { /* private mode */ }
      onUnlock();
      return;
    }
    setShake(true);
    setCode('');
    setTimeout(() => setShake(false), 450);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background:
        'radial-gradient(720px 420px at 80% -10%, rgba(242,106,27,0.20) 0%, rgba(242,106,27,0) 60%),' +
        'linear-gradient(135deg, #0b1220 0%, #15233c 55%, #25364f 100%)',
      padding: 24,
    }}>
      <div className="anim-form" style={{
        width: 400, maxWidth: '100%', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '36px 32px',
        backdropFilter: 'blur(12px)', textAlign: 'center',
        boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        animation: shake ? 'pb-shake 0.4s ease' : undefined,
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: 15, margin: '0 auto 16px',
          background: 'linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #f26a1b 130%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 24px rgba(242,106,27,0.35)',
        }}>
          <Layers size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.3, marginBottom: 4 }}>EsourcEngine</h1>
        <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.65)', marginBottom: 26 }}>Enter the passcode to open the workspace.</p>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Lock size={15} color="rgba(226,232,240,0.5)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={inputRef}
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Passcode"
              autoComplete="off"
              style={{
                width: '100%', padding: '12px 14px 12px 38px', borderRadius: 11, boxSizing: 'border-box',
                border: `1.5px solid ${shake ? '#f87171' : 'rgba(255,255,255,0.18)'}`,
                background: 'rgba(15,23,42,0.55)', color: '#fff', fontSize: 14.5,
                outline: 'none', fontFamily: 'inherit', letterSpacing: 2,
              }}
            />
          </div>
          <button onClick={submit} className="lift" aria-label="Unlock" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46,
            borderRadius: 11, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #fb8c3b 0%, #f26a1b 55%, #ea5e0b 100%)', color: '#fff',
            boxShadow: '0 8px 18px rgba(234,94,11,0.35)',
          }}>
            <ArrowRight size={18} />
          </button>
        </div>
        {shake && <p style={{ color: '#fca5a5', fontSize: 12.5, marginTop: 10 }}>Wrong passcode — try again.</p>}

        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginTop: 26, lineHeight: 1.5 }}>
          Shared workspace lock — not user authentication.
        </p>
      </div>
      <style>{`@keyframes pb-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }`}</style>
    </div>
  );
}
