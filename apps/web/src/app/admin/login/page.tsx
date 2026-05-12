'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, saveToken } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await apiFetch<{ token: string }>('/auth/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
      });
      saveToken('admin', res.token);
      router.push('/admin');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <h1>Admin login</h1>
      <form onSubmit={onSubmit} className="form form--narrow">
        <label className="field"><span>Username</span><input name="username" required /></label>
        <label className="field"><span>Password</span><input name="password" type="password" required /></label>
        {err && <div className="alert alert--error">{err}</div>}
        <button type="submit" disabled={busy} className="btn">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
