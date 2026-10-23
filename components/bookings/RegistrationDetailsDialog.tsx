"use client";

import { useEffect, useId, useRef } from "react";
import { ageThisYear, isDobField } from "@/lib/registration";
import type { EventItem, RosterBooking } from "@/lib/events";

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(", ") : "Not provided";
  return String(value);
}

export function RegistrationDetailsDialog({ event, booking, onClose }: {
  event: EventItem;
  booking: RosterBooking;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  const responses = booking.responses ?? {};
  const fields = [...(event.fields ?? [])].sort((a, b) => a.order - b.order);
  const knownNames = new Set(fields.map((field) => field.name));
  const entries = [
    { key: "default-name", label: "Full Name", value: booking.name },
    { key: "default-email", label: "Email Address", value: booking.email },
    { key: "default-phone", label: "Mobile Number", value: booking.phone },
    ...fields.map((field) => ({ key: `field-${field.id}`, label: field.label, value: responses[field.name] })),
    ...fields.filter(isDobField).map(field => ({ key: `age-${field.id}`, label: `Age in ${new Date().getFullYear()} (${field.label})`, value: ageThisYear(responses[field.name]) })),
    // Preserve answers to fields that have since been removed from the event.
    ...Object.entries(responses).filter(([name]) => !knownNames.has(name))
      .map(([name, value]) => ({ key: `response-${name}`, label: name, value })),
  ];

  return (
    <dialog ref={dialog} className="swal-modal swal-dialog" aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ width: "min(600px, calc(100vw - 32px))", maxHeight: "85dvh", overflowY: "auto", textAlign: "left" }}>
      <h2 id={titleId} className="swal-title">Registration form</h2>
      <p className="hint">{event.title}</p>
      <dl style={{ margin: "20px 0" }}>
        {entries.map(({ key, label, value }) => (
          <div key={key} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)", overflowWrap: "anywhere" }}>
            <dt style={{ fontWeight: 600, marginBottom: 6 }}>{label}</dt>
            <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{displayValue(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">Registered {new Date(booking.createdAt).toLocaleString()}</p>
      <div className="swal-footer">
        <button type="button" className="swal-btn swal-btn--confirm" onClick={onClose} autoFocus>Close</button>
      </div>
    </dialog>
  );
}
