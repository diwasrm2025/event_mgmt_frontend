"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeProgress } from "@/lib/action-feedback";
import { ProgressLoader } from "./ProgressLoader";

export function ActivityFeedback() {
  const [progress, setProgress] = useState({ pending: 0, label: "", mutation: false, success: "", revision: 0 });
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const notified = useRef(0);

  useEffect(() => subscribeProgress(setProgress), []);

  useEffect(() => {
    if (!progress.pending) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setVisible(true);
      setToast("");
    }, progress.mutation ? 0 : 650);
    return () => window.clearTimeout(timer);
  }, [progress.pending, progress.mutation]);

  useEffect(() => {
    const el = dialog.current;
    if (visible && progress.mutation && !el?.open) el?.showModal();
    else if ((!visible || !progress.mutation) && el?.open) el.close();
  }, [visible, progress.mutation]);

  useEffect(() => {
    if (progress.pending || !progress.success || progress.revision <= notified.current) return;
    const timer = window.setTimeout(() => {
      notified.current = progress.revision;
      if (!document.querySelector(".toast-wrap, .swal-success")) setToast(progress.success);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [progress]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cleanToast = (msg: string) =>
    msg
      .replace(/&check;?/g, "✓ ")
      .replace(/&done:?/gi, "✓ ")
      .replace(/&times;?/g, "×")
      .trim();

  return (
    <>
      <dialog
        ref={dialog}
        className="activity-dialog"
        aria-label={progress.label || "Processing"}
        onCancel={(event) => event.preventDefault()}
      >
        <ProgressLoader label={progress.label || "Processing"} />
        <p>Please wait while we finish your request.</p>
      </dialog>

      {visible && !progress.mutation && (
        <div className="activity-read-status">
          <ProgressLoader compact label={progress.label || "Loading data"} />
        </div>
      )}

      {toast && (
        <div className="action-success-toast" role="status">
          <span aria-hidden="true" style={{ fontSize: "1.1rem", lineHeight: 1 }}>✓</span>
          <span>{cleanToast(toast)}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
