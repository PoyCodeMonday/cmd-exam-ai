'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, clearToken } from '@/lib/api';

interface Row {
  id: string;
  reference_code: string;
  name: string;
  email: string;
  phone: string;
  organization: string | null;
  created_at: string;
}

export default function AdminListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Row[]>('/admin/registrations', { role: 'admin' })
      .then(setRows)
      .catch((e) => {
        setErr(e.message);
        if (/401|403/.test(e.message)) {
          clearToken('admin');
          router.push('/admin/login');
        }
      });
  }, [router]);

  if (err) return <p className="alert alert--error">{err}</p>;
  if (!rows) return <p>Loading…</p>;

  return (
    <section className="stack">
      <div className="row--between">
        <h1>Registrations ({rows.length})</h1>
        <button
          onClick={() => { clearToken('admin'); router.push('/admin/login'); }}
          className="btn btn--link"
        >
          Sign out
        </button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Org</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">
                  <Link href={`/admin/${r.id}`}>{r.reference_code}</Link>
                </td>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.phone}</td>
                <td>{r.organization ?? '—'}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '24px' }}>No registrations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
