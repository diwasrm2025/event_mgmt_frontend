"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
import { PublicTopBar } from "@/components/layout/PublicTopBar";
import { PAYMENT_STATUS_LABELS } from "@/lib/events";
import { getPaymentReview, type PaymentReview } from "@/lib/payment-status";

export default function PaymentStatusPage({ params }: { params: { bookingId: string } }) {
  const router = useRouter();
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) { setError("This link is incomplete. Please use the full payment-status link provided after submission."); setLoading(false); return; }
    setLoading(true);
    try {
      setReview(await getPaymentReview(params.bookingId, token));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load payment status. Please try again."); }
    finally { setLoading(false); }
  }, [params.bookingId]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const paid = review?.paymentStatus === "paid";
  useEffect(() => {
    if (!paid) {
      setCountdown(null);
      return;
    }
    setCountdown(10);
    let redirectTimer: number | undefined;
    let secondsLeft = 10;
    const timer = window.setInterval(() => {
      secondsLeft -= 1;
      setCountdown(secondsLeft);
      if (secondsLeft === 0) {
        window.clearInterval(timer);
        redirectTimer = window.setTimeout(() => router.replace("/events"), 700);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [paid, router]);
  const approved = review?.paymentStatus === "paid" && review?.registrationStatus === "approved";
  const rejected = review?.registrationStatus === "rejected";
  return <><PublicTopBar /><main className="event-detail-shell">
    <section className="booking-card payment-status-card">
      <h1>Payment status</h1>
      <p className="hint">Bookmark this private link to check your payment review at any time.</p>
      <FeedbackNotice message={error} icon="error" />
      <div aria-live="polite" className={review ? `payment-review-banner ${paid ? "is-completed" : rejected ? "is-rejected" : "is-pending"}` : undefined}>
        {!review && loading && <p>Checking your payment…</p>}
        {review && <>
          <h2>{PAYMENT_STATUS_LABELS[review.paymentStatus]}</h2>
          {paid && <p><strong>Your SBI ePay order has been confirmed.</strong></p>}
          <p>{approved ? "Thank you for registering! SBI ePay has verified your payment. Your registration confirmation will be sent by email." : rejected ? "Your payment could not be approved. Please contact the event organizer to resolve the issue." : review?.paymentStatus === "paid" ? review.rejectionReason || "Payment received. Please contact the organizer to resolve your registration." : "Your SBI ePay order is awaiting verification. Registration will be confirmed only after SBI reports a successful order."}</p>
          {rejected && <p><strong>Reason: </strong>{review.rejectionReason || "Please contact the organizer for further details."}</p>}
          {paid && review.paidAt && <p className="hint">Completed on {new Date(review.paidAt).toLocaleString()}</p>}
          {paid && countdown !== null && <p role="status" aria-live="polite"><strong>{countdown > 0 ? `Returning to the event home in ${countdown}…` : "Loading event home…"}</strong></p>}
        </>}
      </div>
      {!paid && <button className="btn btn-vibrant" type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh status"}</button>}
      {!paid && <p className="hint">Status updates automatically every 10 seconds.</p>}
    </section>
  </main></>;
}
