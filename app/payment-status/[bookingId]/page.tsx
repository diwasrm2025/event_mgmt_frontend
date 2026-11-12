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
  }, [refresh]);
  const approved = review?.paymentStatus === "paid" && review?.registrationStatus === "approved";
  const rejected = review?.registrationStatus === "rejected" || review?.paymentStatus === "failed";
  useEffect(() => {
    if (approved || rejected) return;
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [approved, rejected, refresh]);
  useEffect(() => {
    if (!approved) {
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
  }, [approved, router]);
  return <><PublicTopBar /><main className="event-detail-shell">
    <section className="booking-card payment-status-card">
      <h1>Payment status</h1>
      <p className="hint">Bookmark this private link to check your payment review at any time.</p>
      <FeedbackNotice message={error} icon="error" />
      <div aria-live="polite" className={review ? `payment-review-banner ${approved ? "is-completed" : rejected ? "is-rejected" : "is-pending"}` : undefined}>
        {!review && loading && <p>Checking your payment…</p>}
        {review && <>
          <h2>{rejected ? "Payment Rejected" : PAYMENT_STATUS_LABELS[review.paymentStatus]}</h2>
          {approved && <p><strong>Your UPI payment has been confirmed.</strong></p>}
          <p>{approved ? "Thank you for registering! Your UPI payment has been verified. Your registration confirmation will be sent by email." : rejected ? "Your payment was rejected. Please review the reason below or contact the event organizer." : review.paymentStatus === "paid" ? review.rejectionReason || "Payment received. Please contact the organizer to resolve your registration." : "Your UPI payment is awaiting verification. Registration will be confirmed once the payment is verified."}</p>
          {rejected && <p><strong>Reason: </strong>{review.rejectionReason || "Please contact the organizer for further details."}</p>}
          {approved && review.paidAt && <p className="hint">Completed on {new Date(review.paidAt).toLocaleString()}</p>}
          {approved && countdown !== null && <div className="payment-completion-timer" role="status" aria-live="polite">
            <div>
              <strong>Returning to the event home</strong>
              <span>You will be redirected in</span>
            </div>
            <strong className="payment-completion-timer-number">{String(Math.max(countdown, 0)).padStart(2, "0")}</strong>
          </div>}
        </>}
      </div>
      {!approved && !rejected && <button className="btn btn-vibrant" type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh status"}</button>}
      {!approved && !rejected && <p className="hint">Status updates automatically every 10 seconds.</p>}
    </section>
  </main>
  </>;
}
