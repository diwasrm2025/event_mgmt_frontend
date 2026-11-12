"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PaymentNotice({ title, children, onClose, closeDisabled = false }: { title: string; children: ReactNode; onClose: () => void; closeDisabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="swal-modal swal-dialog payment-notice" aria-labelledby="payment-notice-title" onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }}>
    <header className="payment-notice-heading">
      <span className="payment-notice-kicker">REGISTRATION PAYMENT</span>
      <h2 id="payment-notice-title">{title}</h2>
    </header>
    <div className="payment-notice-content">{children}</div>
    <button type="button" className="btn btn-vibrant payment-notice-close" onClick={onClose} disabled={closeDisabled}>{closeDisabled ? "Copy the status link above to continue" : "Close"}</button>
  </dialog>;
}
