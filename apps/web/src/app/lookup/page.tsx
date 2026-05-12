'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, saveToken } from '@/lib/api';

export default function LookupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      const reference_code = String(form.get('reference_code') || '').trim().toUpperCase();
      const password = String(form.get('password') || '');
      const res = await apiFetch<{ token: string }>('/auth/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference_code, password }),
      });
      saveToken('user', res.token);
      router.push(`/registrations/${encodeURIComponent(reference_code)}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>View or edit your registration</h1>
      <form onSubmit={onSubmit} className="form form--narrow">
        <label className="field">
          <span>Reference code</span>
          <input name="reference_code" required placeholder="REG-XXXXXX" className="mono" />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" required />
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <button type="submit" disabled={submitting} className="btn">
          {submitting ? 'Verifying…' : 'Continue'}
        </button>
      </form>
    </section>
  );
}
