import type { EventItem, RosterBooking, RosterAccess } from "./events";
export async function exportParticipants(event: EventItem, bookings: RosterBooking[], access: RosterAccess) {
 const { Workbook } = await import("exceljs");
 const workbook = new Workbook(); const sheet = workbook.addWorksheet("Participants");
 const fields = [...(event.fields ?? [])].sort((a,b) => a.order-b.order);
 const columns: { label: string; value: (b: RosterBooking, index: number) => unknown }[] = [
 { label: "S.No", value: (_, index) => index + 1 },
 { label: "Event", value: () => event.title },
 { label: "Full Name", value: b => b.name },
 { label: "Email Address", value: b => b.email },
 { label: "Phone Number", value: b => b.phone },
 { label: "Booking status", value: b => b.status },
 { label: "Booking ID", value: b => b.id },
 ...fields.map(field => ({ label: field.label, value: (b: RosterBooking) => b.responses?.[field.name] })),
 { label: "Registration status", value: b => b.registrationStatus === "approved" && b.status === "confirmed" ? "Completed" : "Pending" },
 { label: "Registered at", value: b => b.createdAt },
 ...(event.eventType === "paid" ? [
 { label: "Amount", value: (b: RosterBooking) => b.amount },
 { label: "Payment method", value: (b: RosterBooking) => b.paymentMethod },
 { label: "Payment status", value: (b: RosterBooking) => b.paymentStatus },
 { label: "paidAt", value: (b: RosterBooking) => access.canApprovePayment ? b.paidAt : undefined },
 { label: "transactionId", value: (b: RosterBooking) => access.canApprovePayment ? b.transactionId : undefined },
 ] : []),
 { label: "checkedIn", value: b => b.checkedIn },
 { label: "checkedInAt", value: b => b.checkedInAt },
 ];
 sheet.addRow(columns.map(c => c.label));
 bookings.forEach((booking, index) => sheet.addRow(columns.map(c => { const v = c.value(booking, index); return v == null ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "object" ? JSON.stringify(v) : v; })));
 sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
 sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: columns.length } };
 sheet.columns.forEach(c => { c.width = 25; c.alignment = { vertical: "top", wrapText: true }; });
 const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
 const link = document.createElement("a"); link.href = url; link.download = (event.slug || "event") + "-participants.xlsx"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
