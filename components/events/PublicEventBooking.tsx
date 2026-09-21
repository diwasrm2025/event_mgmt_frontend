"use client";
import { EventBannerSlider } from "./EventBannerSlider";
import { QrPaymentFields } from "@/components/payments/QrPaymentFields";
import { apiRequest } from "@/lib/api";
import { PaymentStatusActions } from "@/components/payments/PaymentStatusActions";
import { PaymentNotice } from "@/components/payments/PaymentNotice";
import { paymentStatusLink } from "@/lib/payment-status";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCalendarDays, faCircleCheck, faClock, faGlobe, faLocationDot, faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { PublicTopBar } from "@/components/layout/PublicTopBar";
import { Loader } from "@/components/ui/Loader";
import { getSession } from "@/lib/auth";
import { CATEGORY_COLORS, createBooking, formatCurrency, formatDateLabel, getPublicEvent, type BookingItem, type EventFormFieldItem, type EventItem } from "@/lib/events";

type Stage = "details" | "payment" | "processing" | "success";
const timeLabel = (value: string) => { const m = value?.match(/^(\d{1,2}):(\d{2})/); if (!m) return "TBA"; let h = Number(m[1]); const p = h < 12 ? "AM" : "PM"; if (h === 0) h = 12; else if (h > 12) h -= 12; return `${h}:${m[2]} ${p}`; };

export function PublicEventBooking({ slug }: { slug: string }) {
  const session = useMemo(() => getSession(), []);
  const [event, setEvent] = useState<EventItem | null | undefined>();
  const [name, setName] = useState(session?.name ?? ""), [email, setEmail] = useState(session?.email ?? ""), [phone, setPhone] = useState("");
  const [responses, setResponses] = useState<Record<string, string | boolean>>({}), [stage, setStage] = useState<Stage>("details"), [receipt, setReceipt] = useState<BookingItem | null>(null);
  const [error, setError] = useState(""), [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [notice, setNotice] = useState<{ title: string; message?: string; success?: boolean } | null>(null);
  const [qrReady, setQrReady] = useState(false);
  useEffect(() => { void getPublicEvent(slug).then(setEvent); }, [slug]);
  useEffect(() => {
    if (!receipt || receipt.paymentStatus !== "pending") return;
    const refresh = async () => {
      try {
        const updated = await apiRequest<Pick<BookingItem, "paymentStatus" | "registrationStatus" | "paidAt" | "status" | "rejectionReason">>(
          `/public/bookings/${receipt.id}/payment-status`, { auth: false, query: { token: receipt.paymentAccessToken } },
        );
        setReceipt((current) => current ? { ...current, ...updated } : current);
      } catch { /* Retry on the next refresh if the network is temporarily unavailable. */ }
    };
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [receipt?.id, receipt?.paymentStatus, receipt?.paymentAccessToken]);
  if (event === undefined) return <><PublicTopBar /><main className="event-detail-shell"><div className="empty-state">Loading event...</div></main></>;
  if (!event) return <><PublicTopBar /><main className="event-detail-shell"><div className="panel"><div className="panel-body empty-state">This event could not be found.</div></div></main></>;
  const bookedEvent = event;
  const date = formatDateLabel(event.date), seatsLeft = Math.max(0, event.capacity - event.attendees), isFree = event.price <= 0;
  const soldOut = event.status === "sold-out" || (event.capacity > 0 && seatsLeft === 0), closed = event.status === "completed";
  const setResponse = (field: EventFormFieldItem, value: string | boolean) => setResponses((current) => ({ ...current, [field.name]: value }));
  function reportDetailsError(message: string) {
    setNotice({ title: "Please check your details", message });
  }
  function continueToPayment(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!name.trim() || !email.trim()) return reportDetailsError("Name and email are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return reportDetailsError("Enter a valid email address.");
    for (const field of bookedEvent.fields ?? []) { const value = responses[field.name]; if (field.required && (field.type === "checkbox" ? value !== true : value === undefined || value === "")) return reportDetailsError(`"${field.label}" is required.`); }
    setStage("payment");
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!isFree) {
      let message = "";
      if (!transactionId.trim() && !paymentProof) message = "Kindly attach your payment screenshot and enter your transaction ID.";
      else if (!paymentProof) message = "Kindly attach your payment screenshot.";
      else if (!transactionId.trim()) message = "Kindly enter your transaction ID.";
      else if (!/^[A-Za-z0-9-]{6,100}$/.test(transactionId.trim())) message = "Enter a valid transaction ID with 6-100 letters, digits or hyphens.";
      else if (!qrReady) message = "The payment QR is unavailable. Please wait for it to load or contact the organizer.";
      if (message) { setError(message); setNotice({ title: "Payment details required", message }); return; }
    }
    setError(""); setSubmitting(true); setStage("processing");
    try {
      const booking = await createBooking(slug, {
        name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, responses,
        ...(!isFree ? { paymentMethod: "qr", transactionId: transactionId.trim(), paymentProof } : {}),
      });
      setReceipt(booking); setStage("success");
      setNotice({ title: "Congratulations!", success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not submit registration.";
      setError(message); setNotice({ title: "Submission failed", message }); setStage("payment");
    } finally { setSubmitting(false); }
  }

  return <><PublicTopBar /><main className="event-detail-shell" style={{ "--event-category-color": CATEGORY_COLORS[event.category] } as CSSProperties}><div className="public-event-grid"><section><EventBannerSlider banners={event.banners || []} title={event.title} /><span className="vip-badge-tag">{event.category}</span><h1>{event.title}</h1><p className="event-sub">Hosted by <strong>{event.host}</strong></p><div className="detail-grid"><Detail icon={faCalendarDays} label="Date" value={date.full || "TBA"} /><Detail icon={faClock} label="Time" value={timeLabel(event.time)} /><Detail icon={event.eventMode === "online" ? faGlobe : faLocationDot} label={event.eventMode === "online" ? "Online event" : "Venue"} value={event.eventMode === "online" ? "Join online" : event.venue || "TBA"} /><Detail icon={faUserGroup} label="Seats left" value={event.capacity ? String(seatsLeft) : "Unlimited"} /></div>{event.description ? <div className="event-description"><h3>About this event</h3><p className="event-sub">{event.description}</p></div> : null}{event.eventMode === "online" ? <p className="hint"><FontAwesomeIcon icon={faGlobe} /> Joining instructions appear after registration.</p> : null}</section><section className="booking-card booking-form-card">{closed || soldOut ? <div className="sold-out-banner">{closed ? "Registration is closed." : "This event is sold out."}</div> : <><BookingSteps stage={stage} isFree={isFree} />{stage === "details" && <form onSubmit={continueToPayment} className="registration-form" noValidate><p className="chart-kicker">{isFree ? "Free registration" : `${formatCurrency(event.price)} per attendee`}</p><h2>Registration details</h2><p className="hint">{session ? `Booking as ${session.name}.` : <>Booking as a guest. <Link href="/signin">Sign in</Link> to track your booking.</>}</p><Field label="Full Name" value={name} onChange={setName} required /><Field label="Email Address" value={email} onChange={setEmail} type="email" required /><Field label="Phone (optional)" value={phone} onChange={setPhone} type="tel" />{(event.fields ?? []).map((field) => <RegistrationField key={field.id} field={field} value={responses[field.name]} onChange={setResponse} />)}<button className="btn btn-vibrant" type="submit">Continue to {isFree ? "review" : "payment"}</button></form>}{stage === "payment" && <form onSubmit={handlePay} className="registration-form" noValidate><h2>{isFree ? "Review your registration" : "Scan QR to pay"}</h2>{!isFree && <QrPaymentFields transactionId={transactionId} onTransactionId={setTransactionId} proof={paymentProof} onProof={setPaymentProof} onReady={setQrReady} />}<div className="order-summary pro"><div className="order-summary-row"><span>{event.title}</span><strong>{isFree ? "Free" : formatCurrency(event.price)}</strong></div><div className="order-summary-row"><span>Attendee</span><span>{name}</span></div></div>{!isFree && <p className="hint">Pay the amount shown, then submit your transaction ID and screenshot. Payment stays pending until an administrator approves it.</p>}<button className="btn btn-vibrant" type="submit" disabled={submitting}>{isFree ? "Confirm registration" : "Submit payment for review"}</button><button type="button" className="btn btn-ghost" onClick={() => setStage("details")}><FontAwesomeIcon icon={faArrowLeft} /> Back to details</button></form>}{stage === "processing" && <div className="checkout-processing"><Loader size={48} /><strong>{isFree ? "Completing your registration..." : "Submitting payment for review..."}</strong></div>}{stage === "success" && receipt && <SuccessReceipt event={event} date={date} receipt={receipt} />}</>}</section></div></main>{notice && <PaymentNotice title={notice.title} onClose={() => setNotice(null)}>{notice.success && receipt ? <><p>{isFree ? "Your registration is complete!" : "Your payment details have been submitted successfully for review."}</p><p>{isFree ? "Thank you for registering!" : "Once the admin verifies and approves your payment, we will send your registration confirmation by email."}</p><PaymentStatusActions href={paymentStatusLink(receipt)} /><p className="hint">Save this private link to check whether your payment is pending, approved, or rejected with a reason.</p></> : <p>{notice.message}</p>}</PaymentNotice>}</>;
}

function Detail({ icon, label, value }: { icon: any; label: string; value: string }) { return <div className="detail-card"><FontAwesomeIcon icon={icon} /><div className="label">{label}</div><strong>{value}</strong></div>; }
function BookingSteps({ stage, isFree }: { stage: Stage; isFree: boolean }) { const current = stage === "details" ? 1 : stage === "success" ? 3 : 2; return <nav className="booking-step-nav" aria-label="Booking progress">{[[1, "Details"], [2, isFree ? "Review" : "Payment"], [3, isFree ? "Complete" : "Submitted"]].map(([n, label]) => <div className={`booking-step ${current === n ? "active" : current > Number(n) ? "complete" : ""}`} key={String(n)}><span>{current > Number(n) ? "✓" : n}</span><strong>{label}</strong></div>)}</nav>; }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <div className="field"><label>{label}{required && <span className="required-star"> *</span>}</label><input type={type} value={value} placeholder={`Enter ${label.replace(" *", "").toLowerCase()}`} onChange={(e) => onChange(e.target.value)} required={required} /></div>; }
function RegistrationField({ field, value, onChange }: { field: EventFormFieldItem; value: string | boolean | undefined; onChange: (field: EventFormFieldItem, value: string | boolean) => void }) { if (field.type === "checkbox") return <label className="registration-checkbox"><input type="checkbox" checked={value === true} onChange={(e) => onChange(field, e.target.checked)} /><span><b>Checkbox</b> · {field.label}{field.required ? " *" : ""}</span></label>; if (field.type === "select") return <div className="field"><label><b>Dropdown</b> · {field.label}{field.required ? " *" : ""}</label><select value={String(value ?? "")} onChange={(e) => onChange(field, e.target.value)}><option value="">Choose {field.label.toLowerCase()}...</option>{field.options.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>; if (field.type === "radio") return <fieldset className="registration-radio"><legend><b>Radio</b> · {field.label}{field.required ? " *" : ""}</legend>{field.options.map((o) => <label key={o}><input type="radio" name={field.name} checked={value === o} onChange={() => onChange(field, o)} /> {o}</label>)}</fieldset>; return <Field label={`${field.label}${field.required ? " *" : ""}`} value={String(value ?? "")} onChange={(v) => onChange(field, v)} type={field.type === "phone" ? "tel" : field.type} />; }
function SuccessReceipt({ event, date, receipt }: { event: EventItem; date: ReturnType<typeof formatDateLabel>; receipt: BookingItem }) { return <div className="ticket-stub-wrap"><div className={`payment-review-banner ${receipt.paymentStatus === "paid" ? "is-completed" : receipt.registrationStatus === "rejected" ? "is-rejected" : "is-pending"}`}><FontAwesomeIcon icon={faCircleCheck} /> {receipt.paymentStatus === "paid" ? "Registration completed!" : receipt.registrationStatus === "rejected" ? "Payment could not be approved" : "Payment awaiting approval"}</div><p className="event-sub">{receipt.paymentStatus === "paid" ? "Thank you for registering." : receipt.registrationStatus === "rejected" ? "Please contact the organizer about your payment." : "Once the admin verifies and approves your payment, we will send your registration confirmation by email."}</p><PaymentStatusActions href={paymentStatusLink(receipt)} />{receipt.registrationStatus === "rejected" && receipt.rejectionReason && <p className="payment-review-banner is-rejected">Reason: {receipt.rejectionReason}</p>}<div className="ticket-stub"><div className="ticket-stub-hero-title">{event.title}</div><div className="ticket-stub-hero-meta"><span>{date.full}</span><span>{event.eventMode === "online" ? "Online event" : event.venue}</span></div><div className="ticket-stub-body"><strong>{receipt.name}</strong><span>{receipt.paymentStatus === "paid" ? "Payment completed" : receipt.registrationStatus === "rejected" ? "Payment rejected" : "Pending administrator review"}</span>{receipt.paymentStatus === "paid" && event.eventMode === "online" && event.onlineUrl && <a href={event.onlineUrl} target="_blank" rel="noreferrer">Join online event</a>}</div></div></div>; }
