"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
import { PublicTopBar } from "@/components/layout/PublicTopBar";
import { getPaymentReview, type PaymentReview } from "@/lib/payment-status";

export default function PaymentStatusPage({ params }: { params: { bookingId: string } }) {
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
  const approved = review?.paymentStatus === "paid";
  const rejected = review?.registrationStatus === "rejected";
  return <><PublicTopBar /><main className="event-detail-shell">
    <section className="booking-card payment-status-card">
      <h1>Payment status</h1>
      <p className="hint">Bookmark this private link to check your payment review at any time.</p>
      <FeedbackNotice message={error} icon="error" />
      <div aria-live="polite" className={review ? `payment-review-banner ${approved ? "is-completed" : rejected ? "is-rejected" : "is-pending"}` : undefined}>
        {!review && loading && <p>Checking your payment…</p>}
        {review && <>
          <h2>{approved ? "Payment completed" : rejected ? "Payment rejected" : "Pending verification"}</h2>
          <p>{approved ? "Thank you for registering! Your payment has been approved. Your registration confirmation will be sent by email." : rejected ? "Your payment could not be approved. Please contact the event organizer to resolve the issue." : "We have received your payment details. Once the admin verifies and approves your payment, we will send your registration confirmation by email."}</p>
          {rejected && <p><strong>Reason: </strong>{review.rejectionReason || "Please contact the organizer for further details."}</p>}
          {approved && review.paidAt && <p className="hint">Approved on {new Date(review.paidAt).toLocaleString()}</p>}
        </>}
      </div>
      <button className="btn btn-vibrant" type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh status"}</button>
      <p className="hint">Status updates automatically every 10 seconds.</p>
    </section>
  </main></>;
}
