'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiBlob, apiFetch, clearToken } from '@/lib/api';

interface DocItem {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  download_path: string;
}
interface RegistrationView {
  id: string;
  reference_code: string;
  name: string;
  email: string;
  phone: string;
  organization: string | null;
  dietary: string | null;
  tshirt_size: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  documents: DocItem[];
}

export default function AdminDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [reg, setReg] = useState<RegistrationView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<RegistrationView>(`/admin/registrations/${params.id}`, { role: 'admin' })
      .then(setReg)
      .catch((e) => {
        setErr(e.message);
        if (/401|403/.test(e.message)) {
          clearToken('admin');
          router.push('/admin/login');
        }
      });
  }, [params.id, router]);

  function triggerDownload(blob: Blob, filename: string) {
    // Force the blob to be saved. Some browsers drop a.click() after an `await`
    // (user-activation expired), so we open the blob URL in a new tab — combined
    // with the server's Content-Disposition: attachment header, the browser saves it.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    // Defer cleanup so the browser has actually picked up the click.
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function downloadDoc(d: DocItem) {
    setMsg(null);
    try {
      const blob = await apiBlob(d.download_path, { role: 'admin' });
      triggerDownload(blob, d.filename);
    } catch (e: any) {
      setMsg(`Download failed: ${e.message}`);
    }
  }

  async function downloadTag() {
    if (!reg) return;
    setMsg(null);
    try {
      const blob = await apiBlob(`/admin/registrations/${reg.id}/nametag.pdf`, { role: 'admin' });
      if (!blob.type.includes('pdf')) {
        // Probably an error JSON wrapped in a blob — read it and show.
        const text = await blob.text();
        throw new Error(`Unexpected response (${blob.type}): ${text.slice(0, 200)}`);
      }
      triggerDownload(blob, `nametag-${reg.reference_code}.pdf`);
    } catch (e: any) {
      setMsg(`Name tag download failed: ${e.message}`);
    }
  }

  if (err) return <p className="alert alert--error">{err}</p>;
  if (!reg) return <p>Loading…</p>;

  return (
    <section className="stack">
      <div>
        <Link href="/admin" className="btn btn--link">← Back to list</Link>
      </div>
      <div className="row--between">
        <h1>{reg.name}</h1>
        <span className="mono muted">{reg.reference_code}</span>
      </div>
      <button onClick={downloadTag} className="btn">Download name tag (PDF)</button>
      {msg && <div className="alert alert--error">{msg}</div>}
      <dl className="dl">
        <dt>Email</dt><dd>{reg.email}</dd>
        <dt>Phone</dt><dd>{reg.phone}</dd>
        <dt>Organization</dt><dd>{reg.organization ?? '—'}</dd>
        <dt>Dietary</dt><dd>{reg.dietary ?? '—'}</dd>
        <dt>T-shirt size</dt><dd>{reg.tshirt_size ?? '—'}</dd>
        <dt>Notes</dt><dd>{reg.notes ?? '—'}</dd>
        <dt>Submitted</dt><dd>{new Date(reg.created_at).toLocaleString()}</dd>
        <dt>Updated</dt><dd>{new Date(reg.updated_at).toLocaleString()}</dd>
      </dl>
      <div className="stack--tight">
        <h2>Documents ({reg.documents.length})</h2>
        <ul className="doc-list">
          {reg.documents.map((d) => (
            <li key={d.id} className="doc-row">
              <div>
                <div>{d.filename}</div>
                <div className="doc-row__meta">{d.mime_type} · {d.size_bytes ?? '?'} bytes</div>
              </div>
              <button onClick={() => downloadDoc(d)} className="btn btn--link">Download</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
