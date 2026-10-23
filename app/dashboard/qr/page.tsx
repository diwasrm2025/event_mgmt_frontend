"use client";
import { ProgressLoader } from "@/components/ui/ProgressLoader";
import { CrudEmptyRow } from "@/components/ui/CrudEmptyState";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faPenToSquare, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { AppShell } from "@/components/layout/AppShell";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { requireAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { downloadQr, qrFilename } from "@/lib/qr";
import { Swal, notify } from "@/lib/swal";

type QrRecord = { id: string; title: string; url: string; createdAt: string; owner: { name: string; email: string } };
type QrForm = { id?: string; title: string; url: string };
function QrDialog({ initial, onClose, onSaved }: { initial: QrForm; onClose: () => void; onSaved: () => Promise<void> }) {
 const dialog = useRef<HTMLDialogElement>(null);
 const [form, setForm] = useState(initial);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 useEffect(() => { const focus = document.activeElement as HTMLElement | null; const el = dialog.current; el?.showModal(); return () => { el?.close(); focus?.focus(); }; }, []);
 async function save(e: FormEvent) {
  e.preventDefault(); if (busy) return;
  try { const url = new URL(form.url.trim()); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
  catch { setError("Enter a complete URL starting with http:// or https://."); return; }
  setBusy(true); setError("");
  try { await apiRequest(initial.id ? '/qr-codes/' + initial.id : '/qr-codes', { method: initial.id ? "PATCH" : "POST", body: { title: form.title.trim(), url: form.url.trim() } }); await onSaved(); onClose(); }
  catch (err) { setError(err instanceof Error ? err.message : "Could not save QR code."); }
  finally { setBusy(false); }
 }
 return <dialog ref={dialog} className="swal-modal swal-dialog" aria-labelledby="qr-dialog-title" style={{ textAlign: "left", width: "min(520px, calc(100vw - 32px))" }} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
  <h2 id="qr-dialog-title">{initial.id ? "Edit QR code" : "Generate QR"}</h2>
  <form onSubmit={save} style={{ display: "grid", gap: 16 }}>
   <div className="field"><label htmlFor="qr-title">Title of the QR</label><input id="qr-title" required maxLength={200} autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><p className="hint">Download filename: {qrFilename(form.title)}</p></div>
   <div className="field"><label htmlFor="qr-url">URL</label><input id="qr-url" type="url" required maxLength={2000} placeholder="https://example.com" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></div>
   {error && <p role="alert" className="hint">{error}</p>}
   <div className="swal-footer"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="btn btn-accent" disabled={busy}>{busy ? "Saving..." : initial.id ? "Save changes" : "Generate QR"}</button></div>
  </form>
 </dialog>;
}
export default function QrPage() {
 const router = useRouter();
 const [records, setRecords] = useState<QrRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [isSuperAdmin, setIsSuperAdmin] = useState(false);
 const [form, setForm] = useState<QrForm | null>(null);
 const [busy, setBusy] = useState<string | null>(null);
 const load = useCallback(async () => { setLoading(true); setError(""); try { setRecords(await apiRequest<QrRecord[]>("/qr-codes")); } catch(err) { setError(err instanceof Error ? err.message : "Could not load QR codes."); } finally { setLoading(false); } }, []);
 useEffect(() => { const session = requireAuth(); if (!session) { router.replace("/signin"); return; } setIsSuperAdmin(session.role === "SUPER_ADMIN"); void load(); }, [load, router]);
 async function remove(record: QrRecord) {
  const decision = await Swal.fire({ title: "Permanently delete QR code?", text: '"' + record.title + '" will be permanently deleted. This action cannot be reverted.', icon: "warning", dangerMode: true, showCancelButton: true, confirmButtonText: "Delete permanently" });
  if (!decision.isConfirmed) return;
  setBusy(record.id);
  try { await apiRequest('/qr-codes/' + record.id, { method: "DELETE" }); await load(); }
  catch(err) { void notify(err instanceof Error ? err.message : "Could not delete QR code.", "error"); }
  finally { setBusy(null); }
 }
 async function download(record: QrRecord) { setBusy(record.id); try { await downloadQr(record.title, record.url); } catch { void notify("Could not download QR code.", "error"); } finally { setBusy(null); } }
 return <AppShell title="Generate QR" actions={<button className="btn btn-accent btn-sm" onClick={() => setForm({ title: "", url: "" })}><FontAwesomeIcon icon={faPlus} /> New QR</button>}>
  <section className="panel" style={{ padding: 24 }}>
   <div className="panel-head"><div><h2>Saved QR codes</h2><p className="hint">{isSuperAdmin ? "Links created by all users." : "Create and manage QR codes for your links."}</p></div></div>
   {error && <div role="alert"><p>{error}</p><button className="btn btn-ghost" onClick={() => void load()}>Retry</button></div>}
   {loading ? <ProgressLoader label="Loading QR codes" /> : !error && <DataTablePagination data={records} searchFields={["title", "url", ...(isSuperAdmin ? ["owner" as const] : [])]} searchPlaceholder="Search QR codes...">
    {rows => <div className="table-wrap"><table className="attendee-table"><thead><tr><th>Title of the QR</th><th>URL</th>{isSuperAdmin && <th>Created by</th>}<th>Created at</th><th>Actions</th></tr></thead><tbody>
     {rows.length ? rows.map(record => <tr key={record.id}><td><strong>{record.title}</strong></td><td style={{ maxWidth: 360, overflowWrap: "anywhere" }}><a href={record.url} target="_blank" rel="noopener noreferrer">{record.url}</a></td>{isSuperAdmin && <td>{record.owner.name}<div className="hint">{record.owner.email}</div></td>}<td>{new Date(record.createdAt).toLocaleString()}</td><td><div style={{ display: "flex", gap: 8 }}>
      <button className="icon-btn" title="Download QR code" aria-label={'Download ' + record.title} disabled={!!busy} onClick={() => void download(record)}><FontAwesomeIcon icon={faDownload} /></button>
      <button className="icon-btn" title="Edit URL" aria-label={'Edit ' + record.title} disabled={!!busy} onClick={() => setForm({ id: record.id, title: record.title, url: record.url })}><FontAwesomeIcon icon={faPenToSquare} /></button>
      <button className="icon-btn danger" title="Delete QR code" aria-label={'Delete ' + record.title} disabled={!!busy} onClick={() => void remove(record)}><FontAwesomeIcon icon={faTrash} /></button>
     </div></td></tr>) : <CrudEmptyRow name="Generate QR" columns={isSuperAdmin ? 5 : 4} />}
    </tbody></table></div>}
   </DataTablePagination>}
  </section>
  {form && <QrDialog initial={form} onClose={() => setForm(null)} onSaved={load} />}
 </AppShell>;
}
