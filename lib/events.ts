"use client";

import { apiRequest, apiUpload } from "./api";

export type EventStatus = "published" | "draft" | "sold-out" | "completed";
export type EventCategory = "Music" | "Conference" | "Workshop" | "Sports" | "Festival" | "Community";
export type EventMode = "online" | "offline";
export type FieldType = "text" | "email" | "phone" | "number" | "date" | "textarea" | "select" | "checkbox" | "radio";

export interface EventFormFieldItem {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  order: number;
}

export interface EventItem {
  id: string;
  /** Null until the admin completes the final wizard step. */
  slug: string | null;
  title: string;
  category: EventCategory;
  date: string;
  time: string;
  eventMode: EventMode;
  onlineUrl: string;
  venue: string;
  capacity: number;
  attendees: number;
  price: number;
  status: EventStatus;
  description: string;
  agenda: string[];
  host: string;
  featured: boolean;
  banners: string[];
  wizardStep: number;
  fields?: EventFormFieldItem[];
  ownerId?: string;
  ownerName?: string;
  isOwner?: boolean;
  sharedPermissions?: string[];
}

export interface ActivityItem {
  id?: string;
  action: "created" | "updated" | "deleted";
  title: string;
  at: number | string;
}

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  Music: "#f97316",
  Conference: "#14b8a6",
  Workshop: "#8b5cf6",
  Sports: "#3b82f6",
  Festival: "#ef4444",
  Community: "#22c55e",
};

export type EventFilters = {
  search?: string;
  category?: string;
  status?: string;
};

/** Every field but `title` is optional — the wizard fills these in one step
 * (and one PATCH) at a time. */
export type EventPayload = Partial<{
  title: string;
  category: EventCategory;
  date: string;
  time: string;
  eventMode: EventMode;
  onlineUrl: string;
  venue: string;
  capacity: number;
  attendees: number;
  price: number;
  status: EventStatus;
  description: string;
  agenda: string[];
  host: string;
  featured: boolean;
  banners: string[];
  wizardStep: number;
}> & { title: string };

export async function allEvents(filters: EventFilters = {}): Promise<EventItem[]> {
  const events = await apiRequest<EventItem[]>("/events", {
    query: { search: filters.search, category: filters.category, status: filters.status },
  });
  return [...events].sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
}

export async function getEvent(id: string): Promise<EventItem | null> {
  try {
    return await apiRequest<EventItem>(`/events/${id}`);
  } catch {
    return null;
  }
}

/** Wizard step 0 — creates a draft with just a title and returns its id. */
export async function createDraftEvent(title: string): Promise<EventItem> {
  return apiRequest<EventItem>("/events", { method: "POST", body: { title } });
}

export async function createEvent(data: EventPayload): Promise<EventItem> {
  return apiRequest<EventItem>("/events", { method: "POST", body: data });
}

/** PATCHes one wizard step's worth of fields onto an existing draft (or
 * makes a quick edit after the event is already published). */
export async function updateEvent(id: string, data: Partial<EventPayload>): Promise<EventItem | null> {
  try {
    return await apiRequest<EventItem>(`/events/${id}`, { method: "PATCH", body: data });
  } catch {
    return null;
  }
}

/** Final wizard step: generates the slug/unique URL the first time it's
 * called, and (re)publishes on later calls. */
export async function finalizeEvent(id: string, status?: EventStatus): Promise<EventItem> {
  return apiRequest<EventItem>(`/events/${id}/finalize`, { method: "POST", body: status ? { status } : {} });
}

export async function uploadEventBanner(id: string, file: File): Promise<EventItem> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<EventItem>(`/events/${id}/banners`, formData);
}

export async function removeEventBanner(id: string, url: string): Promise<EventItem> {
  return apiRequest<EventItem>(`/events/${id}/banners`, { method: "DELETE", body: { url } });
}

export async function removeEvent(id: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/events/${id}`, { method: "DELETE" });
}

export async function getActivityLog(): Promise<ActivityItem[]> {
  return apiRequest<ActivityItem[]>("/events/activity");
}

// ---------------------------------------------------------------------------
// Dynamic registration-form field builder (admin side, wizard step 4)
// ---------------------------------------------------------------------------

export type FieldPayload = {
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

export async function listEventFields(eventId: string): Promise<EventFormFieldItem[]> {
  return apiRequest<EventFormFieldItem[]>(`/events/${eventId}/fields`);
}

export async function createEventField(eventId: string, data: FieldPayload): Promise<EventFormFieldItem> {
  return apiRequest<EventFormFieldItem>(`/events/${eventId}/fields`, { method: "POST", body: data });
}

export async function updateEventField(
  eventId: string,
  fieldId: string,
  data: Partial<FieldPayload>,
): Promise<EventFormFieldItem> {
  return apiRequest<EventFormFieldItem>(`/events/${eventId}/fields/${fieldId}`, { method: "PATCH", body: data });
}

export async function removeEventField(eventId: string, fieldId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/events/${eventId}/fields/${fieldId}`, { method: "DELETE" });
}

export async function reorderEventFields(eventId: string, order: string[]): Promise<EventFormFieldItem[]> {
  return apiRequest<EventFormFieldItem[]>(`/events/${eventId}/fields/reorder`, { method: "PATCH", body: { order } });
}

// ---------------------------------------------------------------------------
// Public booking page (no auth required — optionally sends a token if the
// visitor happens to be signed in, since apiRequest attaches one when present)
// ---------------------------------------------------------------------------

export async function getPublicEvent(slug: string): Promise<EventItem | null> {
  try {
    return await apiRequest<EventItem>(`/public/events/${encodeURIComponent(slug)}`, { auth: true });
  } catch {
    return null;
  }
}

export async function listPublicEvents(filters: { search?: string; category?: string } = {}): Promise<EventItem[]> {
  return apiRequest<EventItem[]>("/public/events", {
    query: { search: filters.search, category: filters.category },
    auth: false,
  });
}

export type PaymentMethod = "qr" | "offline" | "free";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  qr: "QR payment",
  offline: "Pay offline",
  free: "Free",
};

export type BookingPayload = {
  name: string;
  email: string;
  phone?: string;
  responses?: Record<string, unknown>;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  paymentProof?: string;
};

export interface BookingItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  seats: number;
  responses: Record<string, unknown>;
  status: "pending" | "confirmed" | "cancelled";
  registrationStatus: "pending" | "approved" | "rejected";
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
  eventId: string;
  event?: EventItem;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId: string | null;
  paymentProof: string | null;
  paymentAccessToken: string;
  rejectionReason: string | null;
  paidAt: string | null;
}

/** Submit registration and payment evidence for administrator review. */
export async function createBooking(slug: string, data: BookingPayload): Promise<BookingItem> {
  return apiRequest<BookingItem>(`/public/events/${encodeURIComponent(slug)}/bookings`, {
    method: "POST",
    body: data,
    auth: true,
  });
}

export async function getMyBookings(): Promise<BookingItem[]> {
  return apiRequest<BookingItem[]>("/bookings/me");
}

/** Admin roster — every member/order booked for one of the organizer's own events. */
/** What a caller whose only capability is ATTENDEE (no EDIT, not the
 * owner) gets back for the roster — the server itself narrows the field
 * set, so this isn't just a UI-level hide. */
export interface RestrictedBookingItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  checkedIn: boolean;
}

export type RosterAccess = { canApprovePayment: boolean; canCheckIn: boolean };
export type RosterBooking = Pick<BookingItem, "id" | "name" | "email" | "phone" | "seats" | "amount" | "createdAt" | "paymentMethod" | "paymentStatus" | "registrationStatus" | "status" | "responses"> & Partial<Pick<BookingItem, "paymentProof" | "transactionId" | "rejectionReason" | "paidAt" | "checkedIn" | "checkedInAt">>;
export function getEventBookings(eventId: string) {
  return apiRequest<{ capabilities: RosterAccess; items: RosterBooking[] }>(`/bookings/event/${encodeURIComponent(eventId)}`);
}

// ---------------------------------------------------------------------------
// Pure, client-side derived helpers (no network calls) — these work off of
// whatever EventItem[] the caller already fetched.
// ---------------------------------------------------------------------------

export function parseEventDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export type Stats = {
  total: number;
  upcoming: number;
  attendees: number;
  capacity: number;
  fillRate: number;
  revenue: number;
  checkIns: number;
};

export function getStats(events: EventItem[]): Stats {
  const now = new Date();
  const upcoming = events.filter((event) => parseEventDate(event.date) >= now).length;
  const bookedSeats = events.reduce((sum, event) => sum + (Number(event.attendees) || 0), 0);
  const capacity = events.reduce((sum, event) => sum + (Number(event.capacity) || 0), 0);
  const revenue = events.reduce((sum, event) => sum + (Number(event.attendees) || 0) * (Number(event.price) || 0), 0);
  const checkIns = events.reduce(
    (sum, event) => sum + Math.min(Number(event.attendees) || 0, Math.round((Number(event.attendees) || 0) * 0.82)),
    0,
  );
  return {
    total: events.length,
    upcoming,
    attendees: bookedSeats,
    capacity,
    fillRate: capacity ? bookedSeats / capacity : 0,
    revenue,
    checkIns,
  };
}

export function getAnalyticsData(events: EventItem[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const bookings = new Array(12).fill(0);
  const revenue = new Array(12).fill(0);

  events.forEach((event) => {
    const monthIndex = parseEventDate(event.date).getMonth();
    bookings[monthIndex] += Number(event.attendees) || 0;
    revenue[monthIndex] += (Number(event.attendees) || 0) * (Number(event.price) || 0);
  });

  const byCategory = Object.entries(
    events.reduce<Record<string, number>>((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value, color: CATEGORY_COLORS[label as EventCategory] || "#999999" }))
    .sort((a, b) => b.value - a.value);

  const byStatus = ["published", "draft", "sold-out", "completed"].map((status) => ({
    label: status,
    value: events.filter((event) => event.status === status).length,
  }));

  const topVenues = Object.entries(
    events.reduce<Record<string, { bookings: number; revenue: number }>>((acc, event) => {
      acc[event.venue] = acc[event.venue] || { bookings: 0, revenue: 0 };
      acc[event.venue].bookings += Number(event.attendees) || 0;
      acc[event.venue].revenue += (Number(event.attendees) || 0) * (Number(event.price) || 0);
      return acc;
    }, {}),
  )
    .map(([venue, entry]) => ({ venue, ...entry }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  return { months, bookings, revenue, byCategory, byStatus, topVenues };
}

export function formatCurrency(value: number) {
  return value > 0 ? `₹${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0 })}` : "Free";
}

export function formatDateLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return {
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    mon: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    year: date.getFullYear(),
    full: date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
  };
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** Admin management/edit page — always available, even for drafts. */
export function getAdminEventLink(event: EventItem) {
  return `/dashboard/events/${event.id}`;
}

/** Public booking URL — null until the wizard's final step generates a slug. */
export function getEventLink(event: EventItem) {
  return event.slug ? `/events/${event.slug}` : null;
}

export function getEventLinkAbsolute(event: EventItem) {
  const path = getEventLink(event);
  if (!path || typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function relativeTime(ts: number | string) {
  const time = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const diff = Math.max(0, Date.now() - time);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
