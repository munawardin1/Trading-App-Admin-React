import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../auth';

function friendly(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Wrong email or password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a minute and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is disabled in Firebase (Authentication → Sign-in method).';
      default:
        return err.message;
    }
  }
  return 'Sign-in failed.';
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card auth-card" onSubmit={submit}>
        <img src="/logo.png" alt="" className="auth-logo" />
        <h1>Cron Trading Admin</h1>
        <p className="muted">Sign in with the same account you use in the app.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
