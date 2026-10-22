"use client";
import { useEffect, useState } from "react";
import type { SwalIcon } from "@/lib/swal";

export function FeedbackNotice({ message, icon }: { message: string; icon?: SwalIcon }) {
  const [visible, setVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!visible || !currentMessage) return null;

  const isError = icon === "error" || /error|failed|cannot|could not|invalid/i.test(currentMessage);

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast" style={{ borderColor: isError ? "var(--danger)" : "var(--border)" }}>
        <span
          className="tdot"
          style={{
            background: isError
              ? "var(--danger)"
              : "linear-gradient(135deg, var(--accent), var(--accent-2))",
          }}
        />
        <span style={{ fontSize: "0.88rem", fontWeight: 550, color: "var(--text)" }}>
          {currentMessage}
        </span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-faint)",
            cursor: "pointer",
            fontSize: "1rem",
            marginLeft: "8px",
            lineHeight: 1,
            padding: "2px",
          }}
          aria-label="Dismiss notification"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
