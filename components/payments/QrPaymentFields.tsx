"use client";

import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
import paymentQr from "@/app/images/payment_qr.jpeg";
import { useState } from "react";

export function QrPaymentFields({ transactionId, onTransactionId, proof, onProof, onReady }: {
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
    <p className="hint">Scan using your payment app and pay the registration amount shown below.</p>
    {qrError ? <p role="alert" className="form-msg show error">The payment QR is currently unavailable. Please contact the organizer.</p> :
      <img className="payment-qr-image" src={process.env.NEXT_PUBLIC_PAYMENT_QR_URL || paymentQr.src} alt="Scan to pay the event organizer" onLoad={() => onReady(true)} onError={() => { setQrError(true); onReady(false); }} />}
    <label className="field">Transaction ID / UTR (required)
      <input required minLength={6} maxLength={100} pattern="[A-Za-z0-9-]{6,100}" value={transactionId} onChange={(e) => onTransactionId(e.target.value)} placeholder="Enter your payment transaction ID" />
    </label>
    <label className="field">Payment proof screenshot (required)
      <input type="file" required={!proof} aria-required="true" accept="image/png,image/jpeg,image/webp" onChange={(e) => void selectFile(e.target.files?.[0])} />
      <small>PNG, JPEG or WebP, maximum 5 MB.</small>
    </label>
    <FeedbackNotice message={error} icon="error" />
    {proof && <img className="payment-proof-preview" src={proof} alt="Your selected payment screenshot" />}
  </div>;
}
