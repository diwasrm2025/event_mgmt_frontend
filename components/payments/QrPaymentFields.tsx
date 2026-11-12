"use client";

import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
import paymentQr from "@/app/images/payment_qr.jpeg";
import { useState } from "react";

export function QrPaymentFields({ transactionId, onTransactionId, proof, onProof, onReady, showQr = true, showEvidence = true }: {
  showQr?: boolean;
  showEvidence?: boolean;
  transactionId: string;
  onTransactionId: (value: string) => void;
  proof: string;
  onProof: (value: string) => void;
  onReady: (ready: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [qrError, setQrError] = useState(false);
  async function selectFile(file?: File) {
    setError(""); onProof("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a PNG, JPEG or WebP screenshot up to 5 MB."); return;
    }
    const reader = new FileReader();
    reader.onload = () => onProof(String(reader.result));
    reader.onerror = () => setError("Could not read this screenshot. Please select it again.");
    reader.readAsDataURL(file);
  }
  return <div className="qr-payment-fields">
    {showQr && <>
    <section className="payment-qr-panel" aria-labelledby="payment-qr-heading">
      <div className="payment-section-heading">
        <span className="payment-step-number" aria-hidden="true">1</span>
        <div>
          <h3 id="payment-qr-heading">Pay using the QR code</h3>
          <p>Open your payment app and scan this code to pay the amount shown above.</p>
        </div>
      </div>
      {qrError ? <p role="alert" className="form-msg show error">The payment QR is currently unavailable. Please contact the organizer.</p> :
        <img className="payment-qr-image" src={process.env.NEXT_PUBLIC_PAYMENT_QR_URL || paymentQr.src} alt="Payment QR code for the event organizer" onLoad={() => onReady(true)} onError={() => { setQrError(true); onReady(false); }} />}
    </section>
    </>}
    {showEvidence && <>
    <section className="payment-evidence-panel" aria-labelledby="payment-evidence-heading">
      <div className="payment-section-heading">
        <span className="payment-step-number" aria-hidden="true">{showQr ? "2" : "1"}</span>
        <div>
          <h3 id="payment-evidence-heading">Add your payment details</h3>
          <p>Use the transaction reference from your payment receipt and attach a clear screenshot.</p>
        </div>
      </div>
    <label className="field">Transaction ID / UTR (required)
      <input required minLength={6} maxLength={100} pattern="[A-Za-z0-9-]{6,100}" value={transactionId} onChange={(e) => onTransactionId(e.target.value)} placeholder="Enter your payment transaction ID" />
    </label>
    <label className="field">Payment proof screenshot (required)
      <input type="file" required={!proof} aria-required="true" accept="image/png,image/jpeg,image/webp" onChange={(e) => void selectFile(e.target.files?.[0])} />
      <small>PNG, JPEG or WebP, maximum 5 MB.</small>
    </label>
    <FeedbackNotice message={error} icon="error" />
    {proof && <div className="payment-proof-preview-wrap"><p className="payment-proof-caption">Screenshot attached</p><img className="payment-proof-preview" src={proof} alt="Preview of your payment screenshot" /></div>}
    </section>
    </>}
  </div>;
}
