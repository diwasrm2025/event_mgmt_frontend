"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PaymentNotice({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="swal-modal swal-dialog payment-notice" aria-labelledby="payment-notice-title" onCancel={onClose}>
    <h2 id="payment-notice-title">{title}</h2>
    <div className="payment-notice-content">{children}</div>
    <button type="button" className="btn btn-vibrant" onClick={onClose} autoFocus>OK</button>
  </dialog>;
}
