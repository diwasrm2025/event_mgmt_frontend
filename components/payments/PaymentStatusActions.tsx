"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useState } from "react";

export function PaymentStatusActions({ href, onCopied, focusOnOpen = false, hideViewUntilCopied = false }: {
  href: string;
  onCopied?: () => void;
  focusOnOpen?: boolean;
  hideViewUntilCopied?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  function markCopied() {
    setCopied(true);
    setManualLink("");
    onCopied?.();
  }
  async function copyLink() {
    const link = new URL(href, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      markCopied();
    } catch {
      setCopied(false);
      setManualLink(link);
    }
  }
  return <div className={`payment-status-actions${hideViewUntilCopied ? " payment-status-actions--required" : ""}`}>
    <div className="payment-status-copy-panel">
      <p className="payment-status-copy-title">Private payment status link</p>
      <button type="button" className="payment-copy-link" onClick={() => void copyLink()} autoFocus={focusOnOpen}>
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? "payment-copy-success-icon" : undefined} aria-hidden="true" />
        <span>{copied ? "Status link copied" : "Copy status link"}</span>
      </button>
      <span className="payment-status-copy-feedback" role="status">{copied ? "Status link copied!" : manualLink ? "Copy the link below to save your payment status." : "Keep this private link to check your booking later."}</span>
      {manualLink && <input aria-label="Payment status link" readOnly value={manualLink} onFocus={(event) => event.target.select()} onCopy={markCopied} />}
    </div>
    {(!hideViewUntilCopied || copied) && <Link className="btn btn-vibrant" href={href}>View status</Link>}
  </div>;
}
