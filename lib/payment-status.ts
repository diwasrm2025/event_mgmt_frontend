import { apiRequest } from "./api";
import type { BookingItem } from "./events";

export type PaymentReview = Pick<BookingItem, "paymentStatus" | "registrationStatus" | "paidAt" | "status" | "rejectionReason">;

export function paymentStatusLink(booking: Pick<BookingItem, "id" | "paymentAccessToken">) {
  return `/payment-status/${encodeURIComponent(booking.id)}#token=${encodeURIComponent(booking.paymentAccessToken)}`;
}

export function getPaymentReview(id: string, token: string) {
  return apiRequest<PaymentReview>(`/public/bookings/${encodeURIComponent(id)}/payment-status`, { auth: false, query: { token } });
}
