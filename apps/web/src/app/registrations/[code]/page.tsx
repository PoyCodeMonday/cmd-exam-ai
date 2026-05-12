'use client';
import { useEffect, useState } from 'react';
import { API_BASE, apiBlob, apiFetch, clearToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

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
  name_th: string;
  name_en: string | null;
  email: string;
  phone: string;
  organization: string | null;
  dietary: string | null;
  tshirt_size: string | null;
  notes: string | null;
  documents: DocItem[];
}

export default function RegistrationPage() {
  const router = useRouter();
  const [reg, setReg] = useState<RegistrationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<RegistrationView>('/registrations/me', { role: 'user' });
      setReg(data);
    } catch (err: any) {
      setError(err.message);
      if (/401|403/.test(err.message)) {
        clearToken('user');
        router.push('/lookup');
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reg) return;
    setSaving(true);
    setMsg(null);
    try {
      const form = new FormData(e.currentTarget);
      const body: Record<string, string> = {};
      for (const k of ['name_th', 'name_en', 'email', 'phone', 'organization', 'dietary', 'tshirt_size', 'notes']) {
        body[k] = String(form.get(k) || '');
      }
      const data = await apiFetch<RegistrationView>('/registrations/me', {
        method: 'PATCH',
        role: 'user',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      setReg(data);
      setMsg('Saved.');
    } catch (err: any) {
      setMsg(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function addDocs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const files = form.getAll('documents') as File[];
    if (!files.length || (files.length === 1 && (files[0] as File).size === 0)) return;
    setSaving(true);
    setMsg(null);
    try {
      const token = window.sessionStorage.getItem('user_token');
      const res = await fetch(`${API_BASE}/registrations/me/documents`, {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setReg(data);
      setMsg('Documents added.');
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setMsg(`Upload failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function downloadDoc(d: DocItem) {
    try {
      const blob = await apiBlob(d.download_path, { role: 'user' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.filename;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (err: any) {
      setMsg(`Download failed: ${err.message}`);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      const data = await apiFetch<RegistrationView>(`/registrations/me/documents/${id}`, {
        method: 'DELETE',
        role: 'user',
      });
      setReg(data);
    } catch (err: any) {
      setMsg(`Delete failed: ${err.message}`);
    }
  }

  if (error) {
    return (
      <section className="stack">
        <h1>Error</h1>
        <p className="alert alert--error">{error}</p>
      </section>
    );
  }
  if (!reg) return <p>Loading…</p>;

  return (
    <section className="stack">
      <div className="row--between">
        <h1>Your registration</h1>
        <span className="mono muted">{reg.reference_code}</span>
      </div>

      <form onSubmit={savePatch} className="form">
        <label className="field"><span>ชื่อ-นามสกุล (ภาษาไทย)</span><input name="name_th" defaultValue={reg.name_th} /></label>
        <label className="field"><span>Name (English)</span><input name="name_en" defaultValue={reg.name_en ?? ''} /></label>
        <label className="field"><span>Email</span><input name="email" type="email" defaultValue={reg.email} /></label>
        <label className="field"><span>Phone</span><input name="phone" defaultValue={reg.phone} /></label>
        <label className="field"><span>Organization</span><input name="organization" defaultValue={reg.organization ?? ''} /></label>
        <label className="field"><span>Dietary</span><input name="dietary" defaultValue={reg.dietary ?? ''} /></label>
        <label className="field"><span>T-shirt size</span><input name="tshirt_size" defaultValue={reg.tshirt_size ?? ''} /></label>
        <label className="field"><span>Notes</span><textarea name="notes" defaultValue={reg.notes ?? ''} rows={3} /></label>
        <button type="submit" disabled={saving} className="btn">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="stack--tight">
        <h2>Documents</h2>
        <ul className="doc-list">
          {reg.documents.map((d) => (
            <li key={d.id} className="doc-row">
              <div>
                <div>{d.filename}</div>
                <div className="doc-row__meta">{d.mime_type} · {d.size_bytes ?? '?'} bytes</div>
              </div>
              <div className="doc-row__actions">
                <button onClick={() => downloadDoc(d)} className="btn btn--link">Download</button>
                <button onClick={() => deleteDoc(d.id)} className="btn btn--danger">Delete</button>
              </div>
            </li>
          ))}
          {!reg.documents.length && <li className="muted">No documents yet.</li>}
        </ul>
        <form onSubmit={addDocs} className="row" encType="multipart/form-data">
          <label className="field">
            <span>Add documents</span>
            <input name="documents" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.doc" />
          </label>
          <button type="submit" className="btn">Upload</button>
        </form>
      </div>

      {msg && <div className="alert alert--info">{msg}</div>}
    </section>
  );
}
