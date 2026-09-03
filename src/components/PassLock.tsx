import { useEffect, useRef, useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

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
      background: '#17100F', padding: 24,
    }}>
      <div className="anim-form" style={{
        width: 400, maxWidth: '100%', background: '#221614',
        border: '1px solid #33211F', borderRadius: 20, padding: '36px 32px',
        textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        animation: shake ? 'pb-shake 0.4s ease' : undefined,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
          background: 'linear-gradient(160deg, #F08080, #9C3733)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 700,
        }}>
          E
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 600, color: '#F3F1EC', letterSpacing: '-0.02em', marginBottom: 4 }}>EsourcEngine</h1>
        <p style={{ fontSize: 13, color: '#A6918E', marginBottom: 26 }}>Enter the passcode to open the workspace.</p>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Lock size={15} color="#8C7875" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
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
                border: `1.5px solid ${shake ? '#E0716D' : '#35211F'}`,
                background: '#17100F', color: '#F3F1EC', fontSize: 14.5,
                outline: 'none', fontFamily: 'inherit', letterSpacing: 2,
              }}
            />
          </div>
          <button onClick={submit} className="lift" aria-label="Unlock" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46,
            borderRadius: 11, border: 'none', cursor: 'pointer',
            background: '#BE4A46', color: '#fff',
          }}>
            <ArrowRight size={18} />
          </button>
        </div>
        {shake && <p style={{ color: '#E0716D', fontSize: 12.5, marginTop: 10 }}>Wrong passcode — try again.</p>}

        <p style={{ fontSize: 11, color: '#7A6663', marginTop: 26, lineHeight: 1.5 }}>
          Shared workspace lock — not user authentication.
        </p>
      </div>
      <style>{`@keyframes pb-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }`}</style>
    </div>
  );
}
