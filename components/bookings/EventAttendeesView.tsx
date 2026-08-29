"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faXmark,
  faArrowLeft,
  faDownload,
  faCircleExclamation,
  faFileLines,
  faUserCheck,
  faTicket,
  faClock,
  faCreditCard,
  faEnvelope,
  faPhone,
  faCheck,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import {
  formatCurrency,
  getAdminEventLink,
  getEventBookings,
  getEventLink,
  PAYMENT_METHOD_LABELS,
  type BookingItem,
  type EventItem,
  type RestrictedBookingItem,
} from "@/lib/events";
import { toggleAttendeeCheckIn, updateRegistrationStatus } from "@/lib/rbac";
import { ApiError } from "@/lib/api";

type EventAttendeesViewProps = {
  event: EventItem;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toCsv(rows: BookingItem[]) {
  const header = ["Name", "Email", "Phone", "Seats", "Amount", "Payment method", "Payment status", "Booked at", "Transaction ID"];
  const lines = rows.map((row) =>
    [
      row.name,
      row.email,
      row.phone,
      row.seats,
      row.amount,
      PAYMENT_METHOD_LABELS[row.paymentMethod],
      row.paymentStatus,
      new Date(row.createdAt).toISOString(),
      row.transactionId ?? "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function toRestrictedCsv(rows: RestrictedBookingItem[]) {
  const header = ["Name", "Mobile", "Email", "Paid Status", "Check In", "Payment Mode"];
  const lines = rows.map((row) =>
    [row.name, row.phone, row.email, row.paymentStatus, row.checkedIn ? "Checked in" : "Not checked in", PAYMENT_METHOD_LABELS[row.paymentMethod]]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Roster view for a member whose only capability is ATTENDEE (no EDIT,
 * not the owner). The server already sent only these six fields — this
 * component simply has nothing else to render, by design, not by choice. */
function RestrictedRosterView({
  event,
  bookings,
  error,
  onRetry,
  onToggleCheckIn,
  actionMessage,
}: {
  event: EventItem;
  bookings: RestrictedBookingItem[] | null;
  error: string;
  onRetry: () => void;
  onToggleCheckIn: (booking: RestrictedBookingItem) => void;
  actionMessage: string;
}) {
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const rows = useMemo(() => {
    if (!bookings) return [];
    return bookings
      .filter((b) => {
        const haystack = `${b.name} ${b.email} ${b.phone}`.toLowerCase();
        return !query || haystack.includes(query.toLowerCase());
      })
      .filter((b) => !paymentFilter || b.paymentStatus === paymentFilter);
  }, [bookings, query, paymentFilter]);

  const checkedInCount = rows.filter((b) => b.checkedIn).length;
  const pendingCount = rows.filter((b) => b.paymentStatus === "pending").length;
  const filtersActive = Boolean(query || paymentFilter);

  const downloadCsv = () => {
    if (!rows.length) return;
    const blob = new Blob([toRestrictedCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="booking-grid">
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link href={getAdminEventLink(event)} className="btn btn-ghost btn-sm">
          <FontAwesomeIcon icon={faArrowLeft} /> Back
        </Link>
        <button type="button" className="btn btn-accent btn-sm" onClick={downloadCsv} disabled={!rows.length}>
          <FontAwesomeIcon icon={faDownload} /> Export CSV
        </button>
      </div>

      <div className="summary-card">
        <p className="panel-kicker">Members booked</p>
        <strong>{rows.length}</strong>
        <div className="summary-stat">Registered for {event.title}</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Checked in</p>
        <strong>{checkedInCount}</strong>
        <div className="summary-stat">Out of {rows.length} registered</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Awaiting payment</p>
        <strong>{pendingCount}</strong>
        <div className="summary-stat">Orders started but not yet paid</div>
      </div>

      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Attendees</p>
            <h3>{event.title}</h3>
          </div>
        </div>
        <div className="toolbar">
          <div className="toolbar-search">
            <div className="search-box">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, mobile" />
            </div>
          </div>
          <div className="toolbar-filters">
            <select className="select-filter" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All payment statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            {filtersActive ? (
              <button type="button" className="filter-reset" onClick={() => { setQuery(""); setPaymentFilter(""); }}>
                <FontAwesomeIcon icon={faXmark} /> Clear
              </button>
            ) : null}
          </div>
          <div className="toolbar-meta">
            <span className="table-chip">
              Showing <strong>{rows.length}</strong>
            </span>
          </div>
        </div>

        {actionMessage ? <div className="form-msg show error" style={{ margin: "0 20px 12px" }}>{actionMessage}</div> : null}

        {error ? (
          <div className="empty-state">
            <div className="glyph">
              <FontAwesomeIcon icon={faCircleExclamation} />
            </div>
            {error}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Paid Status</th>
                  <th>Check In</th>
                  <th>Payment Mode</th>
                </tr>
              </thead>
              <tbody>
                {bookings === null ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">Loading attendees...</div>
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <div className="event-name-cell" style={{ gap: 12 }}>
                          <div className="avatar-ring" style={{ width: 36, height: 36 }}>
                            <div className="avatar-ring-inner">{booking.name.slice(0, 1).toUpperCase()}</div>
                          </div>
                          <div className="event-title">{booking.name}</div>
                        </div>
                      </td>
                      <td className="mono">{booking.phone || "—"}</td>
                      <td>{booking.email}</td>
                      <td>
                        <span className={`pay-badge ${booking.paymentStatus}`}>{booking.paymentStatus}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${booking.checkedIn ? "btn-accent" : "btn-ghost"}`}
                          onClick={() => onToggleCheckIn(booking)}
                        >
                          {booking.checkedIn ? "Checked in" : "Check in"}
                        </button>
                      </td>
                      <td>{PAYMENT_METHOD_LABELS[booking.paymentMethod]}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="glyph">Tickets</div>
                        No one has booked this event yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function EventAttendeesView({ event }: EventAttendeesViewProps) {
  const [bookings, setBookings] = useState<BookingItem[] | null>(null);
  const [restrictedBookings, setRestrictedBookings] = useState<RestrictedBookingItem[] | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<BookingItem | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const load = async () => {
    setError("");
    try {
      const { restricted: isRestricted, items } = await getEventBookings(event.id);
      setRestricted(isRestricted);
      if (isRestricted) {
        setRestrictedBookings(items as RestrictedBookingItem[]);
        setBookings(null);
      } else {
        setBookings(items as BookingItem[]);
        setRestrictedBookings(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load attendees.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const rows = useMemo(() => {
    if (!bookings) return [];
    return bookings
      .filter((b) => {
        const haystack = `${b.name} ${b.email} ${b.phone}`.toLowerCase();
        return !query || haystack.includes(query.toLowerCase());
      })
      .filter((b) => !paymentFilter || b.paymentStatus === paymentFilter)
      .filter((b) => !registrationFilter || b.registrationStatus === registrationFilter);
  }, [bookings, query, paymentFilter, registrationFilter]);

  const handleToggleCheckInRestricted = async (booking: RestrictedBookingItem) => {
    setActionMessage("");
    try {
      await toggleAttendeeCheckIn(event.id, booking.id);
      setRestrictedBookings((current) =>
        (current ?? []).map((b) => (b.id === booking.id ? { ...b, checkedIn: !b.checkedIn } : b)),
      );
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Could not update check-in status.");
    }
  };

  const handleToggleCheckIn = async (booking: BookingItem) => {
    setActionMessage("");
    try {
      await toggleAttendeeCheckIn(event.id, booking.id);
      setBookings((current) =>
        (current ?? []).map((b) => (b.id === booking.id ? { ...b, checkedIn: !b.checkedIn } : b)),
      );
      if (selectedStudent?.id === booking.id) {
        setSelectedStudent((curr) => curr ? { ...curr, checkedIn: !curr.checkedIn } : null);
      }
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Could not update check-in status.");
    }
  };

  const handleRegistrationStatus = async (booking: BookingItem, status: "pending" | "approved" | "rejected") => {
    setActionMessage("");
    try {
      await updateRegistrationStatus(event.id, booking.id, status);
      setBookings((current) => (current ?? []).map((b) => (b.id === booking.id ? { ...b, registrationStatus: status } : b)));
      if (selectedStudent?.id === booking.id) {
        setSelectedStudent((curr) => curr ? { ...curr, registrationStatus: status } : null);
      }
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Could not update registration status.");
    }
  };

  const totalSeats = rows.reduce((sum, b) => sum + b.seats, 0);
  const totalRevenue = rows.filter((b) => b.paymentStatus === "paid").reduce((sum, b) => sum + b.amount, 0);
  const pendingCount = rows.filter((b) => b.paymentStatus === "pending").length;
  const pendingRegistrations = rows.filter((b) => b.registrationStatus === "pending").length;
  const checkedInCount = rows.filter((b) => b.checkedIn).length;
  const filtersActive = Boolean(query || paymentFilter || registrationFilter);

  const publicLink = getEventLink(event);

  const downloadCsv = () => {
    if (!rows.length) return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (restricted) {
    return (
      <RestrictedRosterView
        event={event}
        bookings={restrictedBookings}
        error={error}
        onRetry={load}
        onToggleCheckIn={handleToggleCheckInRestricted}
        actionMessage={actionMessage}
      />
    );
  }

  return (
    <div className="booking-grid">
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link href={getAdminEventLink(event)} className="btn btn-ghost btn-sm">
          <FontAwesomeIcon icon={faArrowLeft} /> Back to event setup
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          {publicLink ? (
            <Link href={publicLink} target="_blank" className="btn btn-ghost btn-sm">
              View booking page
            </Link>
          ) : null}
          <button type="button" className="btn btn-accent btn-sm" onClick={downloadCsv} disabled={!rows.length}>
            <FontAwesomeIcon icon={faDownload} /> Export CSV
          </button>
        </div>
      </div>

      <div className="summary-card">
        <p className="panel-kicker">Members booked</p>
        <strong>{rows.length}</strong>
        <div className="summary-stat">{totalSeats} seat{totalSeats === 1 ? "" : "s"} reserved in total</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Revenue collected</p>
        <strong>{formatCurrency(totalRevenue)}</strong>
        <div className="summary-stat">From confirmed payments only</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Awaiting payment</p>
        <strong>{pendingCount}</strong>
        <div className="summary-stat">Orders started but not yet paid</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Checked in</p>
        <strong>{checkedInCount}</strong>
        <div className="summary-stat">Out of {rows.length} registered</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Pending registrations</p>
        <strong>{pendingRegistrations}</strong>
        <div className="summary-stat">Awaiting approval</div>
      </div>

      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Attendees</p>
            <h3>{event.title}</h3>
          </div>
        </div>
        <div className="toolbar">
          <div className="toolbar-search">
            <div className="search-box">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone" />
            </div>
          </div>
          <div className="toolbar-filters">
            <select className="select-filter" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All payment statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <select className="select-filter" value={registrationFilter} onChange={(e) => setRegistrationFilter(e.target.value)}>
              <option value="">All registrations</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            {filtersActive ? (
              <button
                type="button"
                className="filter-reset"
                onClick={() => {
                  setQuery("");
                  setPaymentFilter("");
                  setRegistrationFilter("");
                }}
              >
                <FontAwesomeIcon icon={faXmark} />
                Clear
              </button>
            ) : null}
          </div>
          <div className="toolbar-meta">
            <span className="table-chip">
              Showing <strong>{rows.length}</strong>
            </span>
          </div>
        </div>

        {actionMessage ? <div className="form-msg show error" style={{ margin: "0 20px 12px" }}>{actionMessage}</div> : null}

        {error ? (
          <div className="empty-state">
            <div className="glyph">
              <FontAwesomeIcon icon={faCircleExclamation} />
            </div>
            {error}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student Attendee</th>
                  <th>Seats</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Registration</th>
                  <th>Check-in</th>
                  <th>Submitted At</th>
                  <th style={{ textAlign: "right" }}>Form Details</th>
                </tr>
              </thead>
              <tbody>
                {bookings === null ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">Loading attendees...</div>
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((booking) => {
                    const responseEntries = Object.entries(booking.responses || {});
                    return (
                      <tr key={booking.id}>
                        <td>
                          <div className="event-name-cell" style={{ gap: 12 }}>
                            <div className="avatar-ring" style={{ width: 42, height: 42 }}>
                              <div className="avatar-ring-inner">
                                {booking.name.slice(0, 1).toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <div className="event-title">{booking.name}</div>
                              <div className="event-sub">{booking.email} {booking.phone ? `· ${booking.phone}` : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="mono">{booking.seats}</td>
                        <td className="mono">{booking.amount > 0 ? formatCurrency(booking.amount) : "Free"}</td>
                        <td>
                          <span className={`pay-badge ${booking.paymentStatus}`}>{booking.paymentStatus}</span>
                        </td>
                        <td>
                          <select
                            className="select-filter"
                            style={{ minWidth: 110, padding: "4px 28px 4px 10px" }}
                            value={booking.registrationStatus}
                            onChange={(e) => handleRegistrationStatus(booking, e.target.value as "pending" | "approved" | "rejected")}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${booking.checkedIn ? "btn-accent" : "btn-ghost"}`}
                            onClick={() => handleToggleCheckIn(booking)}
                          >
                            {booking.checkedIn ? "Checked in" : "Check in"}
                          </button>
                        </td>
                        <td>
                          <span className="event-sub">{fmtDateTime(booking.createdAt)}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-vibrant btn-sm"
                            style={{ padding: "6px 14px", fontSize: 12 }}
                            onClick={() => setSelectedStudent(booking)}
                          >
                            <FontAwesomeIcon icon={faEye} /> View Form ({responseEntries.length})
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="glyph">Tickets</div>
                        No one has booked this event yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- STUDENT SUBMITTED FORM DETAILS MODAL --- */}
      {selectedStudent ? (
        <div className="student-modal-backdrop" onClick={() => setSelectedStudent(null)}>
          <div className="student-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div className="student-avatar-meta">
                <div className="student-dp-xl">
                  {selectedStudent.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="student-header-text">
                  <h3>{selectedStudent.name}</h3>
                  <p>Submitted Form & Ticket Registration Details</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedStudent(null)}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="student-modal-body">
              <div className="registration-summary-pills">
                <div className="summary-pill-item">
                  <div className="lbl"><FontAwesomeIcon icon={faEnvelope} /> Email Address</div>
                  <div className="val">{selectedStudent.email}</div>
                </div>
                <div className="summary-pill-item">
                  <div className="lbl"><FontAwesomeIcon icon={faPhone} /> Phone</div>
                  <div className="val">{selectedStudent.phone || "Not provided"}</div>
                </div>
                <div className="summary-pill-item">
                  <div className="lbl"><FontAwesomeIcon icon={faTicket} /> Reserved Seats</div>
                  <div className="val">{selectedStudent.seats} Seat{selectedStudent.seats > 1 ? "s" : ""}</div>
                </div>
                <div className="summary-pill-item">
                  <div className="lbl"><FontAwesomeIcon icon={faCreditCard} /> Payment Method</div>
                  <div className="val">
                    {PAYMENT_METHOD_LABELS[selectedStudent.paymentMethod]} ({selectedStudent.amount > 0 ? formatCurrency(selectedStudent.amount) : "Free"})
                  </div>
                </div>
                <div className="summary-pill-item">
                  <div className="lbl"><FontAwesomeIcon icon={faClock} /> Submitted At</div>
                  <div className="val">{fmtDateTime(selectedStudent.createdAt)}</div>
                </div>
                <div className="summary-pill-item">
                  <div className="lbl"><FontAwesomeIcon icon={faUserCheck} /> Check-in Status</div>
                  <div className="val" style={{ color: selectedStudent.checkedIn ? "var(--success)" : "var(--text-soft)" }}>
                    {selectedStudent.checkedIn ? "Checked In" : "Not Checked In"}
                  </div>
                </div>
              </div>

              <div>
                <div className="form-answers-section-title">
                  <FontAwesomeIcon icon={faFileLines} style={{ color: "var(--accent)" }} />
                  Student Form Submissions & Answers
                </div>
                <div className="form-answers-grid" style={{ marginTop: 12 }}>
                  {Object.entries(selectedStudent.responses || {}).length ? (
                    Object.entries(selectedStudent.responses || {}).map(([question, answer]) => (
                      <div className="answer-card" key={question}>
                        <div className="q-title">
                          <FontAwesomeIcon icon={faCheck} /> {question}
                        </div>
                        <div className="a-value">
                          {typeof answer === "boolean" ? (answer ? "Yes / Confirmed" : "No") : String(answer)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state" style={{ gridColumn: "1 / -1", padding: 20 }}>
                      No custom registration questions were specified for this event.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedStudent.checkedIn ? "btn-accent" : "btn-ghost"}`}
                  onClick={() => handleToggleCheckIn(selectedStudent)}
                >
                  <FontAwesomeIcon icon={faUserCheck} /> {selectedStudent.checkedIn ? "Mark Not Checked In" : "Mark Checked In"}
                </button>
                <button
                  type="button"
                  className="btn btn-vibrant btn-sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

