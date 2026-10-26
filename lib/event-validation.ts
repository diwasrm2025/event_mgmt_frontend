import type { EventFormFieldItem } from "./events";

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function isValidPhone(value: string) {
  return /^\+?[\d\s().-]+$/.test(value.trim()) && /^\d{7,15}$/.test(value.replace(/\D/g, ""));
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTicketPrice(value: number) {
  return Number.isFinite(value) && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) <= 0.000001;
}

export function isValidCapacity(value: number, bookedSeats = 0) {
  return Number.isSafeInteger(value) && value >= Math.max(1, bookedSeats) && value <= 2147483647;
}

export function validateRegistrationField(field: EventFormFieldItem, value: string | boolean | string[] | undefined): string | null {
  if (field.type === "checkbox" && field.options.length) {
    const selected = Array.isArray(value) ? value : [];
    if (selected.some((option) => !field.options.includes(option))) return `Choose valid options for "${field.label}".`;
    return field.required && selected.length === 0 ? `"${field.label}" is required.` : null;
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (field.type === "checkbox") return field.required && value !== true ? `"${field.label}" is required.` : null;
  if (!text) return field.required ? `"${field.label}" is required.` : null;
  if (field.type === "email" && !isValidEmail(text)) return `Enter a valid email for "${field.label}".`;
  if (field.type === "phone" && !isValidPhone(text)) return `Enter a valid phone number for "${field.label}".`;
  if (field.type === "number" && !Number.isFinite(Number(text))) return `Enter a valid number for "${field.label}".`;
  if (field.type === "date" && !isValidDate(text)) return `Enter a valid date for "${field.label}".`;
  if (["select", "radio"].includes(field.type) && !field.options.includes(text)) return `Select a valid option for "${field.label}".`;
  return null;
}
