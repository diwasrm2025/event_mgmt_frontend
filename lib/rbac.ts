"use client";

import { apiRequest } from "./api";

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  role: { id: string; name: string };
};

export type PersonSummary = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

/** A single event-sharing capability. Grants hold any combination. */
export type EventCapability = "VIEW" | "ATTENDEE" | "EDIT" | "PAYMENT_APPROVE";

export const EVENT_CAPABILITY_LABELS: Record<EventCapability, string> = {
  VIEW: "View",
  ATTENDEE: "Attendee Management",
  EDIT: "Edit",
  PAYMENT_APPROVE: "Payment Approve",
};

export const EVENT_CAPABILITY_DESCRIPTIONS: Record<EventCapability, string> = {
  VIEW: "View event details and the attendee list. No editing or management actions.",
  ATTENDEE: "Manage attendee check-in and check-out. Cannot approve payments.",
  PAYMENT_APPROVE: "Review payment screenshots and transaction IDs, then approve or reject payments.",
  EDIT: "Can edit event details, images, and schedule. Cannot delete the event.",
};

export type SharedMember = {
  id: string;
  permissions: EventCapability[];
  status: "ACTIVE" | "REMOVED";
  createdAt: string;
  updatedAt: string;
  user: PersonSummary;
  grantedBy: { id: string; name: string; email: string } | null;
};

export const ALL_PERMISSIONS = [
  { value: "events:create", label: "Create events" },
  { value: "events:manage_all", label: "Manage every event (Super Admin)" },
  { value: "users:manage", label: "Manage users" },
  { value: "roles:manage", label: "Manage roles" },
  { value: "companies:manage", label: "Manage companies" },
];

export interface SystemEvent {
  id: string;
  slug: string;
  title: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  capacity: number;
  attendees: number;
  price: number;
  status: string;
  description: string;
  host: string;
  owner: { id: string; name: string; email: string };
  company?: { id: string; name: string; slug: string } | null;
  totalBookings: number;
  createdAt: string;
}

export function listAllSystemEvents() {
  return apiRequest<SystemEvent[]>("/events/admin/all");
}

// --- Roles ------------------------------------------------------------
export function listRoles() {
  return apiRequest<Role[]>("/roles");
}

export function createRole(input: { name: string; description?: string; permissions: string[] }) {
  return apiRequest<Role>("/roles", { method: "POST", body: input });
}

export function updateRole(id: string, input: { description?: string; permissions?: string[] }) {
  return apiRequest<Role>(`/roles/${id}`, { method: "PATCH", body: input });
}

export function deleteRole(id: string) {
  return apiRequest<{ success: boolean }>(`/roles/${id}`, { method: "DELETE" });
}

// --- Users --------------------------------------------------------------
export function listUsers() {
  return apiRequest<AdminUser[]>("/users");
}

export function assignUserRole(userId: string, roleId: string) {
  return apiRequest<AdminUser>(`/users/${userId}/role`, { method: "PATCH", body: { roleId } });
}

export function searchPeople(query: string) {
  return apiRequest<PersonSummary[]>("/people/search", { query: { q: query } });
}

// --- Per-event Shared Members ---------------------------------------------
export function listSharedMembers(eventId: string) {
  return apiRequest<SharedMember[]>(`/events/${eventId}/permissions`);
}

export function sharedMembersCount(eventId: string) {
  return apiRequest<number>(`/events/${eventId}/permissions/count`);
}

/** Share by picking an existing person (userId) OR typing their email. */
export function shareEvent(eventId: string, target: { userId?: string; email?: string }, permissions: EventCapability[]) {
  return apiRequest<SharedMember>(`/events/${eventId}/permissions`, {
    method: "POST",
    body: { ...target, permissions },
  });
}

export function createUserAndShareEvent(
  eventId: string,
  data: { name: string; email: string; password: string },
  permissions: EventCapability[],
) {
  return apiRequest<SharedMember>(`/events/${eventId}/permissions/create-user`, {
    method: "POST",
    body: { ...data, permissions },
  });
}

export function updateSharedMemberPermissions(eventId: string, permissionId: string, permissions: EventCapability[]) {
  return apiRequest<SharedMember>(`/events/${eventId}/permissions/${permissionId}`, {
    method: "PATCH",
    body: { permissions },
  });
}

/** Clears permissions but keeps the row as history (Status: Removed). */
export function revokeSharedMemberAccess(eventId: string, permissionId: string) {
  return apiRequest<SharedMember>(`/events/${eventId}/permissions/${permissionId}/revoke`, { method: "PATCH" });
}

/** Deletes the row outright. */
export function removeSharedMember(eventId: string, permissionId: string) {
  return apiRequest<{ success: boolean }>(`/events/${eventId}/permissions/${permissionId}`, { method: "DELETE" });
}

// --- Event dashboard summary ----------------------------------------------
export type EventDashboardSummary = {
  owner: PersonSummary;
  sharedMembersCount: number;
  totalRegistrations: number;
  checkedInAttendees: number;
  pendingRegistrations: number;
  status: string;
  updatedAt: string;
};

export function getEventDashboard(eventId: string) {
  return apiRequest<EventDashboardSummary>(`/events/${eventId}/dashboard`);
}

// --- Attendee management (check-in, approve/reject, export) --------------
export function toggleAttendeeCheckIn(eventId: string, bookingId: string) {
  return apiRequest(`/bookings/event/${eventId}/${bookingId}/check-in`, { method: "PATCH" });
}

export function updateRegistrationStatus(eventId: string, bookingId: string, status: "pending" | "approved" | "rejected", reason?: string) {
  return apiRequest<Pick<import("./events").BookingItem, "id" | "paymentStatus" | "registrationStatus" | "rejectionReason" | "paidAt" | "status">>(`/bookings/event/${eventId}/${bookingId}/registration-status`, { method: "PATCH", body: { status, reason } });
}

// --- Notifications ---------------------------------------------------------
export type AppNotification = {
  id: string;
  type: "access_granted" | "access_updated" | "access_revoked" | "member_removed";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  eventId: string | null;
};

export function listNotifications() {
  return apiRequest<AppNotification[]>("/notifications");
}

export function unreadNotificationCount() {
  return apiRequest<number>("/notifications/unread-count");
}

export function markNotificationRead(id: string) {
  return apiRequest<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return apiRequest<{ success: boolean }>("/notifications/read-all", { method: "PATCH" });
}
