import { useEffect, useRef, useState } from 'react';
import { Mail, Lock, User, KeyRound, ArrowRight } from 'lucide-react';
import { loginUser, registerUser } from '../utils/api';
import { useAuth } from '../utils/auth';

// Real per-user login/registration — replaces the old shared-passcode gate
// (PassLock). Registration needs a server-side invite code once at least one
// account already exists; the very first account on the system becomes admin
// regardless of invite code.
export default function Login() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInputRef.current?.focus(); }, [mode]);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { user, token } = mode === 'login'
        ? await loginUser(email, password)
        : await registerUser({ name, email, password, inviteCode: inviteCode || undefined });
      setSession(user, token);
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') void submit(); };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px 11px 38px', borderRadius: 11, boxSizing: 'border-box',
    border: `1.5px solid ${shake ? '#E0716D' : '#35211F'}`,
    background: '#17100F', color: '#F3F1EC', fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
  };
  const iconStyle: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' };

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
        <p style={{ fontSize: 13, color: '#A6918E', marginBottom: 26 }}>
          {mode === 'login' ? 'Log in to your workspace.' : 'Create your account.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {mode === 'register' && (
            <div style={{ position: 'relative' }}>
              <User size={15} color="#8C7875" style={iconStyle} />
              <input ref={firstInputRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={onKeyDown} placeholder="Full name" autoComplete="name" style={fieldStyle} />
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Mail size={15} color="#8C7875" style={iconStyle} />
            <input ref={mode === 'login' ? firstInputRef : undefined} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown} placeholder="Email" autoComplete="email" style={fieldStyle} />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={15} color="#8C7875" style={iconStyle} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown} placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={fieldStyle} />
          </div>
          {mode === 'register' && (
            <div style={{ position: 'relative' }}>
              <KeyRound size={15} color="#8C7875" style={iconStyle} />
              <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={onKeyDown} placeholder="Invite code (not needed for the first account)" autoComplete="off" style={fieldStyle} />
            </div>
          )}

          <button onClick={submit} disabled={busy} className="lift" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '11px', marginTop: 4, borderRadius: 11, border: 'none',
            background: '#BE4A46', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </div>

        {error && <p style={{ color: '#E0716D', fontSize: 12.5, marginTop: 12 }}>{error}</p>}

        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', marginTop: 20,
          fontSize: 12.5, color: '#A6918E',
        }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span style={{ color: '#F08080', fontWeight: 600 }}>{mode === 'login' ? 'Create one' : 'Log in'}</span>
        </button>
      </div>
      <style>{`@keyframes pb-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }`}</style>
    </div>
  );
}
