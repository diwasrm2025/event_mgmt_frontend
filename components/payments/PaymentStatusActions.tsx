"use client";

import Link from "next/link";
import { useState } from "react";

export function PaymentStatusActions({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  async function copyLink() {
    const link = new URL(href, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setManualLink("");
    } catch {
      setCopied(false);
      setManualLink(link);
    }
  }
  return <div className="payment-status-actions">
    <button type="button" className="payment-copy-link" onClick={() => void copyLink()}>Click here to copy the status link</button>
    <Link className="btn btn-vibrant" href={href}>View status</Link>
    <span className="hint" role="status">{copied ? "Status link copied!" : manualLink ? "Copy the link below to save your payment status." : "Save this private link to check your payment status later."}</span>
    {manualLink && <input aria-label="Payment status link" readOnly value={manualLink} onFocus={(event) => event.target.select()} />}
  </div>;
}
