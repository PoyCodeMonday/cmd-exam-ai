'use client';
import { useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '@/lib/api';

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference_code: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch(`${API_BASE}/registrations`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message?.toString?.() || `Request failed (${res.status})`);
      }
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="stack">
        <div className="eyebrow">All set</div>
        <h1>Registration complete</h1>
        <p>Save this reference code. You will need it (with your password) to view or edit your registration.</p>
        <div className="card">
          <div className="card__label">Reference code</div>
          <div className="card__value" data-testid="reference-code">{result.reference_code}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigator.clipboard.writeText(result.reference_code)}>
            Copy code
          </button>
          <Link href="/lookup" className="btn btn--secondary">Go to my registration</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="eyebrow">CMD AI Adoption Exam 2026</div>
      <h1>Register for the event</h1>
      <p className="muted">Submit your details and any supporting documents. You will receive a reference code at the end — keep it together with your password.</p>
      <form onSubmit={onSubmit} className="form" encType="multipart/form-data">
        <label className="field">
          <span>ชื่อ-นามสกุล (ภาษาไทย) *</span>
          <input name="name_th" required placeholder="ปวริศ ประสานทรัพย์" />
        </label>
        <label className="field">
          <span>Name (English transliteration)</span>
          <input name="name_en" placeholder="Pavarit Prasansup" />
        </label>
        <label className="field">
          <span>Email *</span>
          <input name="email" type="email" required />
        </label>
        <label className="field">
          <span>Phone *</span>
          <input name="phone" required />
        </label>
        <label className="field">
          <span>Organization</span>
          <input name="organization" />
        </label>
        <label className="field">
          <span>Dietary requirements</span>
          <input name="dietary" placeholder="e.g. vegetarian, halal" />
        </label>
        <label className="field">
          <span>T-shirt size</span>
          <select name="tshirt_size">
            <option value="">—</option>
            <option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
          </select>
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea name="notes" rows={3} />
        </label>
        <label className="field">
          <span>Password * (min 8 chars — used to view/edit your registration later)</span>
          <input name="password" type="password" required minLength={8} />
        </label>
        <label className="field">
          <span>Supporting documents (pdf / png / jpg / docx, up to 4 MB each)</span>
          <input name="documents" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.doc" />
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <button type="submit" disabled={submitting} className="btn">
          {submitting ? 'Submitting…' : 'Submit registration'}
        </button>
      </form>
    </section>
  );
}
