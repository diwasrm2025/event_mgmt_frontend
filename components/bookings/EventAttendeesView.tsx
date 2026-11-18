"use client";
import Image from "next/image";
import { ProgressLoader } from "@/components/ui/ProgressLoader";
import { CrudEmptyRow } from "@/components/ui/CrudEmptyState";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { exportParticipants } from "@/lib/participant-export";
import { buildPaymentProofArchive, paymentProofFileName } from "@/lib/payment-proof-archive";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deleteEventBooking, getEventPaymentProof, listEventFields, getEventBookings, PAYMENT_STATUS_LABELS, getAdminEventLink, formatCurrency, type EventItem, type RosterBooking, type RosterAccess } from "@/lib/events";
import { acceptOfflinePayment, markOfflinePaymentPaid, toggleAttendeeCheckIn, updateRegistrationStatus } from "@/lib/rbac";
import { Swal, notify } from "@/lib/swal";
import { RegistrationDetailsDialog } from "./RegistrationDetailsDialog";

type RosterTab = "completed" | "offline" | "qr" | "pendingQr" | "pendingOffline" | "acceptedOffline" | "rejected";

function isOfflinePaymentAccepted(booking: RosterBooking) {
  return booking.paymentMethod === "offline" && booking.paymentStatus === "pending" && booking.registrationStatus === "approved";
}

function canCheckInBooking(booking: RosterBooking) {
  return booking.registrationStatus === "approved" && booking.paymentStatus === "paid";
}

function isPendingQrPayment(booking: RosterBooking) {
  return booking.paymentMethod === "qr" && booking.paymentStatus === "pending" && booking.registrationStatus === "pending";
}

function isPendingOfflinePayment(booking: RosterBooking) {
  return booking.paymentMethod === "offline" && booking.paymentStatus === "pending" && booking.registrationStatus === "pending";
}

function bookingPaymentLabel(booking: RosterBooking) {
  if (isOfflinePaymentAccepted(booking)) return "Payment Accepted";
  return booking.registrationStatus === "rejected" ? "Payment Rejected" : PAYMENT_STATUS_LABELS[booking.paymentStatus];
}

export function EventAttendeesView({ event }: { event: EventItem }) {
  const isFreeEvent = event.eventType === "free";
  const [bookings, setBookings] = useState<RosterBooking[]>([]);
  const [access, setAccess] = useState<RosterAccess>({ canApprovePayment: false, canCheckIn: false });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<RosterTab>("completed");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<RosterBooking | null>(null);
  const [paymentProofUrls, setPaymentProofUrls] = useState<Record<string, string>>({});
  const [paymentProofLoading, setPaymentProofLoading] = useState<Record<string, boolean>>({});
  const [paymentProofErrors, setPaymentProofErrors] = useState<Record<string, string>>({});
  const [downloadedPaymentProofs, setDownloadedPaymentProofs] = useState<Set<string>>(() => new Set());
  const paymentProofObjectUrls = useRef<string[]>([]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await getEventBookings(event.id); setAccess(result.capabilities); setBookings(result.items); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load attendees."); }
    finally { setLoading(false); }
  }, [event.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => {
    paymentProofObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (busy) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getEventBookings(event.id).then(result => {
        if (active) { setAccess(result.capabilities); setBookings(result.items); }
      }).catch(() => { /* Keep the current roster and retry on the next interval. */ });
    }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [event.id, busy]);
  const paymentCounts = {
    completed: bookings.filter(b => b.paymentStatus === "paid").length,
    pendingQr: bookings.filter(isPendingQrPayment).length,
    pendingOffline: bookings.filter(isPendingOfflinePayment).length,
    acceptedOffline: bookings.filter(isOfflinePaymentAccepted).length,
    rejected: bookings.filter(b => b.paymentStatus === "failed" || b.registrationStatus === "rejected").length,
    qr: bookings.filter(b => b.paymentMethod === "qr").length,
    offline: bookings.filter(b => b.paymentMethod === "offline").length,
  };
  const rows = bookings.filter(b => {
    const matchesQuery = `${b.name} ${b.email} ${b.phone}`.toLowerCase().includes(query.toLowerCase());
    const matchesTab = isFreeEvent
      || (activeTab === "completed" && b.paymentStatus === "paid")
      || (activeTab === "acceptedOffline" && isOfflinePaymentAccepted(b))
      || (activeTab === "pendingQr" && isPendingQrPayment(b))
      || (activeTab === "pendingOffline" && isPendingOfflinePayment(b))
      || (activeTab === "rejected" && (b.paymentStatus === "failed" || b.registrationStatus === "rejected"))
      || (activeTab === "qr" && b.paymentMethod === "qr")
      || (activeTab === "offline" && b.paymentMethod === "offline");
    return matchesQuery && matchesTab;
  });
  const pendingQrBookings = bookings.filter(isPendingQrPayment);
  async function loadPaymentProof(bookingId: string) {
    if (paymentProofUrls[bookingId] || paymentProofLoading[bookingId]) return;
    setPaymentProofLoading(current => ({ ...current, [bookingId]: true }));
    setPaymentProofErrors(current => ({ ...current, [bookingId]: "" }));
    try {
      const proof = await getEventPaymentProof(event.id, bookingId);
      if (!proof.size || !proof.type.startsWith("image/")) {
        throw new Error("The server returned an invalid screenshot.");
      }
      const url = URL.createObjectURL(proof);
      paymentProofObjectUrls.current.push(url);
      setPaymentProofUrls(current => ({ ...current, [bookingId]: url }));
    } catch (err) {
      setPaymentProofErrors(current => ({
        ...current,
        [bookingId]: err instanceof Error ? err.message : "Could not load the payment screenshot.",
      }));
    } finally {
      setPaymentProofLoading(current => ({ ...current, [bookingId]: false }));
    }
  }
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function downloadPaymentProof(booking: RosterBooking) {
    if (busy || !access.canApprovePayment) return;
    if (downloadedPaymentProofs.has(booking.id)) {
      const confirmation = await Swal.fire({
        title: "Screenshot already downloaded",
        text: "Do you want to download it again?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
      });
      if (!confirmation.isConfirmed) return;
    }
    setBusy(`proof-${booking.id}`);
    try {
      const proof = await getEventPaymentProof(event.id, booking.id);
      if (!proof.size || !proof.type.startsWith("image/")) throw new Error("The server returned an invalid screenshot.");
      downloadBlob(proof, paymentProofFileName(booking.name, booking.transactionId ?? null, booking.id, proof.type));
      setDownloadedPaymentProofs(current => new Set(current).add(booking.id));
    } catch (err) {
      void notify(err instanceof Error ? err.message : `Could not download ${booking.name}'s payment screenshot.`, "error");
    } finally {
      setBusy(null);
    }
  }
  async function downloadPendingQrScreenshots() {
    if (busy || !access.canApprovePayment || !pendingQrBookings.length) return;
    setBusy("download-all");
    try {
      const files = [];
      for (let offset = 0; offset < pendingQrBookings.length; offset += 6) {
        const batch = pendingQrBookings.slice(offset, offset + 6);
        const downloaded = await Promise.all(batch.map(async booking => {
          try {
            const proof = await getEventPaymentProof(event.id, booking.id);
            if (!proof.size || !proof.type.startsWith("image/")) throw new Error("The server returned an invalid screenshot.");
            return { bookingId: booking.id, name: booking.name, transactionId: booking.transactionId ?? null, proof };
          } catch (err) {
            const reason = err instanceof Error ? err.message : "The screenshot could not be downloaded.";
            throw new Error(`${booking.name}: ${reason}`);
          }
        }));
        files.push(...downloaded);
      }
      const archive = await buildPaymentProofArchive(files);
      downloadBlob(new Blob([archive], { type: "application/zip" }), `${event.slug || "event"}-pending-qr-payment-screenshots.zip`);
      void notify(`Downloaded ${files.length} pending QR payment screenshot${files.length === 1 ? "" : "s"}.`, "success");
    } catch (err) {
      void notify(err instanceof Error ? err.message : "Could not download pending QR payment screenshots.", "error");
    } finally {
      setBusy(null);
    }
  }
  async function review(booking: RosterBooking, approve: boolean) {
    const decision = await Swal.fire({
      title: approve ? booking.paymentMethod === "offline" ? "Accept offline payment?" : "Accept payment?" : "Reject payment?",
      text: approve
        ? booking.isTest
          ? `Approve ${booking.name}'s test payment. This will not process a payment, affect live attendance, or send an email.`
          : booking.paymentMethod === "offline" ? `Confirm that you have received ${booking.name}'s offline payment. This marks it as Payment Accepted. You can mark it paid later; check-in is enabled only after that.` : `Confirm that you have verified ${booking.name}'s transaction and screenshot. Approval completes the registration and sends a confirmation email.`
        : "Provide a reason. The attendee will see it on their payment status page.",
      icon: approve ? "question" : "warning", showCancelButton: true, dangerMode: !approve,
      confirmButtonText: approve ? booking.paymentMethod === "offline" ? "Accept offline payment" : "Accept payment" : "Reject payment",
      ...(!approve ? { input: "textarea" as const, inputValue: booking.rejectionReason || "", inputPlaceholder: "For example: the transaction amount does not match the registration fee" } : {}),
    });
    if (!decision.isConfirmed) return;
    setBusy(booking.id);
    try {
      if (approve && booking.paymentMethod === "offline") await acceptOfflinePayment(event.id, booking.id);
      else await updateRegistrationStatus(event.id, booking.id, approve ? "approved" : "rejected", decision.value);
      setActiveTab(approve ? booking.paymentMethod === "offline" ? "acceptedOffline" : "completed" : "rejected");
      await load(); void notify(approve ? booking.paymentMethod === "offline" ? "Offline payment accepted. Mark it paid to enable check-in." : "Payment completed. Registration confirmed." : "Payment rejected. The reason is available to the attendee.", approve ? "success" : "info");
    } catch (err) { void notify(err instanceof Error ? err.message : "Could not review payment.", "error"); }
    finally { setBusy(null); }
  }
  async function markOfflinePaid(booking: RosterBooking) {
    if (busy || !isOfflinePaymentAccepted(booking) || !access.canApprovePayment) return;
    const confirmation = await Swal.fire({
      title: "Mark offline payment as paid?",
      text: `This moves ${booking.name}'s payment to Completed Payments and enables check-in.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Mark paid",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setBusy(booking.id);
    try {
      await markOfflinePaymentPaid(event.id, booking.id);
      setActiveTab("completed");
      await load();
      void notify("Offline payment marked paid. Check-in is now enabled.", "success");
    } catch (err) {
      void notify(err instanceof Error ? err.message : "Could not mark the offline payment as paid.", "error");
    } finally {
      setBusy(null);
    }
  }
  async function checkIn(booking: RosterBooking) {
    if (busy || booking.isTest || !canCheckInBooking(booking)) return;
    const confirmation = await Swal.fire({
      title: "Confirm attendee check-in",
      text: `Name: ${booking.name}\nMobile number: ${booking.phone || "Not provided"}\nPayment status: ${bookingPaymentLabel(booking)}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm check-in",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setBusy(booking.id);
    try { await toggleAttendeeCheckIn(event.id, booking.id); await load(); void notify("Attendee checked in.", "success"); }
    catch (err) { void notify(err instanceof Error ? err.message : "Could not update check-in.", "error"); }
    finally { setBusy(null); }
  }
  async function exportExcel() {
    setBusy("export");
    try { const [result, fields] = await Promise.all([getEventBookings(event.id), listEventFields(event.id)]); await exportParticipants({ ...event, fields }, result.items, result.capabilities); }
    catch (err) { void notify(err instanceof Error ? err.message : "Could not export participants.", "error"); }
    finally { setBusy(null); }
  }
  async function removeBooking(booking: RosterBooking) {
    if (busy || !access.canDelete) return;
    setBusy(booking.id);
    try {
      const decision = await Swal.fire({
        title: "Delete this registration?",
        text: `Permanently delete ${booking.name}'s booking (${booking.email}) and their registration answers? This cannot be undone.${booking.status === "confirmed" ? " Their reserved seats will be released." : ""}${booking.amount > 0 ? " Deleting a booking does not issue a payment refund." : ""}`,
        icon: "warning", showCancelButton: true, dangerMode: true,
        confirmButtonText: "Yes, delete registration", cancelButtonText: "Keep registration",
      });
      if (!decision.isConfirmed) return;
      await deleteEventBooking(event.id, booking.id);
      setBookings(current => current.filter(item => item.id !== booking.id));
      setSelectedBooking(current => current?.id === booking.id ? null : current);
      void notify("Registration deleted successfully.", "success");
    } catch (err) { void notify(err instanceof Error ? err.message : "Could not delete registration.", "error"); }
    finally { setBusy(null); }
  }
  const liveBookings = bookings.filter(booking => !booking.isTest);
  const testBookings = bookings.filter(booking => booking.isTest);
  const paidBookings = liveBookings.filter(booking => booking.paymentStatus === "paid");
  const acceptedOfflineBookings = liveBookings.filter(isOfflinePaymentAccepted);
  const columns = 2 + Number(!isFreeEvent) * 3 + Number(!isFreeEvent && access.canApprovePayment) + Number(access.canCheckIn) + Number(!!access.canDelete);
  return <div className="roster-page">
    <div className="roster-toolbar"><Link className="btn btn-ghost" href={getAdminEventLink(event)}>Back to event</Link><button className="btn btn-ghost" onClick={() => void load()} disabled={loading}>Refresh</button><button className="btn btn-accent" onClick={() => void exportExcel()} disabled={loading || !!busy}>Export all participants (Excel)</button></div>
    <div className="roster-summary"><div className="summary-card"><p>Paid attendees</p><strong>{paidBookings.length}</strong></div><div className="summary-card"><p>Test registrations</p><strong>{testBookings.length}</strong></div>{!isFreeEvent && <><div className="summary-card"><p>Payment accepted</p><strong>{acceptedOfflineBookings.length}</strong></div><div className="summary-card"><p>Payment pending</p><strong>{liveBookings.filter(b => b.paymentStatus === "pending" && !isOfflinePaymentAccepted(b)).length}</strong></div><div className="summary-card"><p>Rejected payments</p><strong>{liveBookings.filter(b => b.paymentStatus === "failed" || b.registrationStatus === "rejected").length}</strong></div></>}{access.canCheckIn && <div className="summary-card"><p>Checked in</p><strong>{liveBookings.filter(b => b.checkedIn).length}</strong></div>}</div>
    <section className="panel"><div className="panel-head"><h2>{event.title}: attendees</h2></div>
      {!isFreeEvent && <div className="roster-tabs" role="tablist" aria-label="Attendee payment status">
        <button type="button" role="tab" aria-selected={activeTab === "completed"} className={activeTab === "completed" ? "active" : ""} onClick={() => setActiveTab("completed")}>Completed Payment <span>{paymentCounts.completed}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "offline"} className={activeTab === "offline" ? "active" : ""} onClick={() => setActiveTab("offline")}>Offline Payment <span>{paymentCounts.offline}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "qr"} className={activeTab === "qr" ? "active" : ""} onClick={() => setActiveTab("qr")}>QR <span>{paymentCounts.qr}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "pendingQr"} className={activeTab === "pendingQr" ? "active" : ""} onClick={() => setActiveTab("pendingQr")}>Pending QR Payment <span>{paymentCounts.pendingQr}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "pendingOffline"} className={activeTab === "pendingOffline" ? "active" : ""} onClick={() => setActiveTab("pendingOffline")}>Pending Offline Payment <span>{paymentCounts.pendingOffline}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "acceptedOffline"} className={activeTab === "acceptedOffline" ? "active" : ""} onClick={() => setActiveTab("acceptedOffline")}>Accept Offline Payment <span>{paymentCounts.acceptedOffline}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "rejected"} className={activeTab === "rejected" ? "active" : ""} onClick={() => setActiveTab("rejected")}>Rejected Payment <span>{paymentCounts.rejected}</span></button>
      </div>}
      <div className="toolbar">
        <input aria-label="Search attendees" placeholder="Search by attendee name or email" value={query} onChange={e => setQuery(e.target.value)} />
        {!isFreeEvent && activeTab === "pendingQr" && access.canApprovePayment && <button type="button" className="btn btn-accent" disabled={!!busy || loading || !pendingQrBookings.length} onClick={() => void downloadPendingQrScreenshots()}>{busy === "download-all" ? "Preparing ZIP…" : "Download all users' payment screenshots"}</button>}
      </div>
      {error && <div className="empty-state"><p>{error}</p><button className="btn btn-ghost" onClick={() => void load()}>Retry</button></div>}
      <DataTablePagination key={activeTab} data={rows} defaultPageSize={10} pageSizeOptions={[10]}>
      {pageRows => <div className="table-wrap"><table className="attendee-table"><thead><tr><th>Attendee</th>{!isFreeEvent && <><th>Phone</th><th>Amount</th><th>Payment status</th>{access.canApprovePayment && <th>Payment approval</th>}</>}{access.canCheckIn && <th>Check-in management</th>}<th>Registration details</th>{access.canDelete && <th>Actions</th>}</tr></thead><tbody>
        {loading && !bookings.length ? <tr><td colSpan={columns}><ProgressLoader label="Loading attendees" /></td></tr> : pageRows.length ? pageRows.map(booking => <tr key={booking.id}>
          <td><strong>{booking.name}</strong>{booking.isTest && <span className="event-status-pill event-status-testing" style={{ marginLeft: 8 }}>TEST</span>}<div className="event-sub">{booking.email}</div></td>
          {!isFreeEvent && <><td>{booking.phone || "Not provided"}</td><td>{booking.amount ? formatCurrency(booking.amount) : "Free"}</td>
          <td><span className={`pay-badge ${isOfflinePaymentAccepted(booking) ? "accepted" : booking.paymentStatus}`}>{bookingPaymentLabel(booking)}</span></td>
          {access.canApprovePayment && <td>{booking.paymentMethod === "sbiepay" && <p className="hint">Verified automatically by SBI Order Search.</p>}<p className="mono">{booking.paymentMethod === "offline" ? "Offline payment" : `Transaction: ${booking.transactionId || "Not submitted"}`}</p>{isPendingQrPayment(booking) && (booking.hasPaymentProof ?? Boolean(booking.paymentProof)) && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void downloadPaymentProof(booking)}>{busy === `proof-${booking.id}` ? "Downloading…" : downloadedPaymentProofs.has(booking.id) ? "Download Again" : "Download screenshot"}</button>}{(booking.hasPaymentProof ?? Boolean(booking.paymentProof)) && <details onToggle={event => { if (event.currentTarget.open) void loadPaymentProof(booking.id); }}>
            <summary>View payment screenshot</summary>
            {paymentProofLoading[booking.id] ? <p className="hint">Loading screenshot…</p> : paymentProofUrls[booking.id] ? <>
              {paymentProofErrors[booking.id] && <p className="form-msg show error" role="alert">{paymentProofErrors[booking.id]}</p>}
              <a href={paymentProofUrls[booking.id]} target="_blank" rel="noopener noreferrer" aria-label={`Open payment screenshot for ${booking.name} in a new tab`}>
                <Image style={{ height: "auto" }} unoptimized width={320} height={480} className="roster-proof" src={paymentProofUrls[booking.id]} alt={`Payment screenshot for ${booking.name}`} onError={() => setPaymentProofErrors(current => ({ ...current, [booking.id]: "The screenshot preview could not be displayed. Use the link below to open the image directly." }))} />
              </a>
              <a className="btn btn-ghost btn-sm" href={paymentProofUrls[booking.id]} target="_blank" rel="noopener noreferrer">Open full screenshot in new tab</a>
            </> : paymentProofErrors[booking.id] ? <div><p className="form-msg show error" role="alert">{paymentProofErrors[booking.id]}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadPaymentProof(booking.id)}>Retry loading screenshot</button></div> : <p className="hint">The screenshot loads on demand to keep the attendee list fast.</p>}
            </details>}{booking.rejectionReason && <p className="payment-review-banner is-rejected">Reason: {booking.rejectionReason}</p>}{booking.paymentMethod !== "sbiepay" && booking.paymentStatus === "pending" && booking.registrationStatus === "pending" && <div className="roster-actions"><button className="btn btn-accent btn-sm" disabled={!!busy || (booking.paymentMethod !== "offline" && (!(booking.hasPaymentProof ?? Boolean(booking.paymentProof)) || !booking.transactionId))} onClick={() => void review(booking, true)}>{booking.paymentMethod === "offline" ? "Accept offline payment" : "Accept payment"}</button><button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void review(booking, false)}>Reject</button></div>}{isOfflinePaymentAccepted(booking) && <div className="roster-actions"><button className="btn btn-accent btn-sm" disabled={!!busy} onClick={() => void markOfflinePaid(booking)}>Mark paid</button></div>}</td>}</>}
          {access.canCheckIn && <td>{booking.checkedIn ? <p className="hint">Checked in</p> : <><button className="btn btn-ghost btn-sm" disabled={!!busy || booking.isTest || !canCheckInBooking(booking)} onClick={() => void checkIn(booking)}>Check in</button><p className="hint">{booking.isTest ? "Test registrations cannot be checked in." : canCheckInBooking(booking) ? "Not checked in" : booking.paymentMethod === "offline" && isOfflinePaymentAccepted(booking) ? "Mark this payment paid before check-in." : booking.paymentMethod === "offline" ? "Offline payment must be accepted and marked paid before check-in." : "Payment must be completed before check-in."}</p></>}</td>}
          <td><button type="button" className="btn btn-ghost btn-sm" aria-haspopup="dialog" onClick={() => setSelectedBooking(booking)}>View form</button></td>
          {access.canDelete && <td><button type="button" className="btn btn-danger-outline btn-sm" disabled={!!busy || loading || (booking.paymentMethod === "sbiepay" && booking.paymentStatus === "pending")} aria-label={`Delete registration for ${booking.name}`} onClick={() => void removeBooking(booking)}>{busy === booking.id ? "Please wait…" : "Delete"}</button>{booking.paymentMethod === "sbiepay" && booking.paymentStatus === "pending" && <p className="hint">Awaiting payment verification.</p>}</td>}
        </tr>) : <CrudEmptyRow name="Attendees" columns={columns} />}
      </tbody></table></div>}
      </DataTablePagination>
    </section>
    {selectedBooking && <RegistrationDetailsDialog event={event} booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}
  </div>;
}
