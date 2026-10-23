"use client";
import { ProgressLoader } from "@/components/ui/ProgressLoader";
import { CrudEmptyRow } from "@/components/ui/CrudEmptyState";
import { exportParticipants } from "@/lib/participant-export";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listEventFields, getEventBookings, PAYMENT_STATUS_LABELS, getAdminEventLink, formatCurrency, type EventItem, type RosterBooking, type RosterAccess } from "@/lib/events";
import { toggleAttendeeCheckIn, updateRegistrationStatus } from "@/lib/rbac";
import { Swal, notify } from "@/lib/swal";
import { RegistrationDetailsDialog } from "./RegistrationDetailsDialog";

export function EventAttendeesView({ event }: { event: EventItem }) {
  const isFreeEvent = event.eventType === "free";
  const [bookings, setBookings] = useState<RosterBooking[]>([]);
  const [access, setAccess] = useState<RosterAccess>({ canApprovePayment: false, canCheckIn: false });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<RosterBooking | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await getEventBookings(event.id); setAccess(result.capabilities); setBookings(result.items); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load attendees."); }
    finally { setLoading(false); }
  }, [event.id]);
  useEffect(() => { void load(); }, [load]);
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
  const rows = bookings.filter(b => `${b.name} ${b.email} ${b.phone}`.toLowerCase().includes(query.toLowerCase()) && (isFreeEvent || !filter || b.paymentStatus === filter));
  async function review(booking: RosterBooking, approve: boolean) {
    const decision = await Swal.fire({
      title: approve ? "Accept payment?" : "Reject payment?",
      text: approve ? `Confirm that you have verified ${booking.name}'s transaction and screenshot. Approval completes the registration and sends a confirmation email.` : "Provide a reason. The attendee will see it on their payment status page.",
      icon: approve ? "question" : "warning", showCancelButton: true, dangerMode: !approve,
      confirmButtonText: approve ? "Accept payment" : "Reject payment",
      ...(!approve ? { input: "textarea" as const, inputValue: booking.rejectionReason || "", inputPlaceholder: "For example: the transaction amount does not match the registration fee" } : {}),
    });
    if (!decision.isConfirmed) return;
    setBusy(booking.id);
    try {
      await updateRegistrationStatus(event.id, booking.id, approve ? "approved" : "rejected", decision.value);
      await load(); void notify(approve ? "Payment accepted. Registration completed." : "Payment rejected. The reason is available to the attendee.", approve ? "success" : "info");
    } catch (err) { void notify(err instanceof Error ? err.message : "Could not review payment.", "error"); }
    finally { setBusy(null); }
  }
  async function checkIn(booking: RosterBooking) {
    setBusy(booking.id);
    try { await toggleAttendeeCheckIn(event.id, booking.id); await load(); void notify(booking.checkedIn ? "Attendee checked out." : "Attendee checked in.", "success"); }
    catch (err) { void notify(err instanceof Error ? err.message : "Could not update check-in.", "error"); }
    finally { setBusy(null); }
  }
  async function exportExcel() {
    setBusy("export");
    try { const [result, fields] = await Promise.all([getEventBookings(event.id), listEventFields(event.id)]); await exportParticipants({ ...event, fields }, result.items, result.capabilities); }
    catch (err) { void notify(err instanceof Error ? err.message : "Could not export participants.", "error"); }
    finally { setBusy(null); }
  }
  const columns = 2 + Number(!isFreeEvent) * 3 + Number(!isFreeEvent && access.canApprovePayment) + Number(access.canCheckIn);
  return <div className="roster-page">
    <div className="roster-toolbar"><Link className="btn btn-ghost" href={getAdminEventLink(event)}>Back to event</Link><button className="btn btn-ghost" onClick={() => void load()} disabled={loading}>Refresh</button><button className="btn btn-accent" onClick={() => void exportExcel()} disabled={loading || !!busy}>Export all participants (Excel)</button></div>
    <div className="roster-summary"><div className="summary-card"><p>Attendees</p><strong>{bookings.length}</strong></div>{!isFreeEvent && <div className="summary-card"><p>Payment pending</p><strong>{bookings.filter(b => b.paymentStatus === "pending").length}</strong></div>}{access.canCheckIn && <div className="summary-card"><p>Checked in</p><strong>{bookings.filter(b => b.checkedIn).length}</strong></div>}</div>
    <section className="panel"><div className="panel-head"><h2>{event.title}: attendees</h2></div>
      <div className="toolbar"><input aria-label="Search attendees" placeholder="Search by attendee name or email" value={query} onChange={e => setQuery(e.target.value)} />{!isFreeEvent && <select aria-label="Filter by payment status" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All payment statuses</option><option value="pending">Payment Pending</option><option value="paid">Payment Completed</option><option value="failed">Payment Failed</option></select>}</div>
      {error && <div className="empty-state"><p>{error}</p><button className="btn btn-ghost" onClick={() => void load()}>Retry</button></div>}
      <div className="table-wrap"><table className="attendee-table"><thead><tr><th>Attendee</th>{!isFreeEvent && <><th>Phone</th><th>Amount</th><th>Payment status</th>{access.canApprovePayment && <th>Payment approval</th>}</>}{access.canCheckIn && <th>Check-in management</th>}<th>Registration details</th></tr></thead><tbody>
        {loading && !bookings.length ? <tr><td colSpan={columns}><ProgressLoader label="Loading attendees" /></td></tr> : rows.length ? rows.map(booking => <tr key={booking.id}>
          <td><strong>{booking.name}</strong><div className="event-sub">{booking.email}</div></td>
          {!isFreeEvent && <><td>{booking.phone || "Not provided"}</td><td>{booking.amount ? formatCurrency(booking.amount) : "Free"}</td>
          <td><span className={`pay-badge ${booking.paymentStatus}`}>{PAYMENT_STATUS_LABELS[booking.paymentStatus]}</span></td>
          {access.canApprovePayment && <td>{booking.paymentMethod === "sbiepay" && <p className="hint">Verified automatically by SBI Order Search.</p>}<p className="mono">Transaction: {booking.transactionId || "Not submitted"}</p>{booking.paymentProof && <details><summary>View payment screenshot</summary><img className="roster-proof" src={booking.paymentProof} alt={`Payment screenshot for ${booking.name}`} /></details>}{booking.rejectionReason && <p className="payment-review-banner is-rejected">Reason: {booking.rejectionReason}</p>}{booking.paymentMethod !== "sbiepay" && booking.paymentStatus !== "paid" && <div className="roster-actions"><button className="btn btn-accent btn-sm" disabled={!!busy || !booking.paymentProof || !booking.transactionId} onClick={() => void review(booking, true)}>Accept payment</button><button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void review(booking, false)}>Reject</button></div>}</td>}</>}
          {access.canCheckIn && <td><button className="btn btn-ghost btn-sm" disabled={!!busy || booking.paymentStatus !== "paid" || booking.registrationStatus !== "approved"} onClick={() => void checkIn(booking)}>{booking.checkedIn ? "Check out" : "Check in"}</button><p className="hint">{booking.checkedIn ? "Checked in" : "Not checked in"}</p></td>}
          <td><button type="button" className="btn btn-ghost btn-sm" aria-haspopup="dialog" onClick={() => setSelectedBooking(booking)}>View form</button></td>
        </tr>) : <CrudEmptyRow name="Attendees" columns={columns} />}
      </tbody></table></div>
    </section>
    {selectedBooking && <RegistrationDetailsDialog event={event} booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}
  </div>;
}
