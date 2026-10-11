import { useState } from 'react';
import { useAuth } from '../auth';

export default function NotAdmin() {
  const { user, logout, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function check() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }

  return (
    <div className="center">
      <div className="card auth-card">
        <h1>Not an admin yet</h1>
        <p>
          You are signed in as <strong>{user?.email}</strong>, but this account does not have admin rights.
        </p>
        <p className="muted">
          Ask a developer to run this on the server project, then click “Check again”:
        </p>
        <pre className="code">node scripts/set-admin-claim.js {user?.uid}</pre>
        <div className="row">
          <button
            className="btn ghost"
            onClick={() => {
              void navigator.clipboard.writeText(user?.uid ?? '');
              setCopied(true);
            }}
          >
            {copied ? 'UID copied' : 'Copy my UID'}
          </button>
          <button className="btn primary" onClick={check} disabled={checking}>
            {checking ? 'Checking…' : 'Check again'}
          </button>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
