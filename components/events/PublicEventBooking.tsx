"use client";

import { EventBannerSlider } from "./EventBannerSlider";
import { apiRequest } from "@/lib/api";
import { PaymentStatusActions } from "@/components/payments/PaymentStatusActions";
import { PaymentNotice } from "@/components/payments/PaymentNotice";
import { paymentStatusLink } from "@/lib/payment-status";
import Link from "next/link";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { isValidEmail, isValidPhone, validateRegistrationField } from "@/lib/event-validation";
import {
  useEffect,
  useMemo,
  useRef,
  useId,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCalendarDays,
  faCircleCheck,
  faClock,
  faGlobe,
  faLocationDot,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { PublicTopBar } from "@/components/layout/PublicTopBar";
import { Loader } from "@/components/ui/Loader";
import { getSession } from "@/lib/auth";
import {
  CATEGORY_COLORS,
  PAYMENT_STATUS_LABELS,
  createBooking,
  formatCurrency,
  formatDateLabel,
  getPublicEvent,
  type BookingItem,
  type EventFormFieldItem,
  type EventItem,
} from "@/lib/events";

type Stage = "details" | "payment" | "processing" | "success";

const timeLabel = (value: string) => {
  const m = value?.match(/^(\d{1,2}):(\d{2})/);

  if (!m) return "TBA";

  let h = Number(m[1]);
  const p = h < 12 ? "AM" : "PM";

  if (h === 0) {
    h = 12;
  } else if (h > 12) {
    h -= 12;
  }

  return `${h}:${m[2]} ${p}`;
};

export function PublicEventBooking({ slug }: { slug: string }) {
  const session = useMemo(() => getSession(), []);

  const [event, setEvent] = useState<EventItem | null | undefined>();

  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [phone, setPhone] = useState("");

  const [responses, setResponses] = useState<
    Record<string, string | boolean>
  >({});

  const [stage, setStage] = useState<Stage>("details");

  const [receipt, setReceipt] = useState<BookingItem | null>(null);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bookingInFlight = useRef(false);

  const [notice, setNotice] = useState<{
    title: string;
    message?: string;
    success?: boolean;
  } | null>(null);

  /*
   * Load public event
   */
  useEffect(() => {
    let active = true;
    setEvent(undefined);
    setStage("details");
    setReceipt(null);
    setResponses({});
    setError("");
    void getPublicEvent(slug).then((loaded) => { if (active) setEvent(loaded); });
    return () => { active = false; };
  }, [slug]);

  /*
   * Check payment/registration status
   *
   * Refresh the receipt after an authorized reviewer approves or rejects payment.
   */
  useEffect(() => {
    const bookingId = receipt?.id;
    const accessToken = receipt?.paymentAccessToken;
    if (!bookingId || receipt?.paymentStatus !== "pending" || !accessToken) {
      return;
    }

    const refresh = async () => {
      try {
        const updated = await apiRequest<
          Pick<
            BookingItem,
            | "paymentStatus"
            | "registrationStatus"
            | "paidAt"
            | "status"
            | "rejectionReason"
          >
        >(
          `/public/bookings/${bookingId}/payment-status`,
          {
            auth: false,
            query: {
              token: accessToken,
            },
          },
        );

        setReceipt((current) =>
          current ? { ...current, ...updated } : current,
        );
      } catch {
        /*
         * Retry on the next interval if the network
         * is temporarily unavailable.
         */
      }
    };

    const timer = window.setInterval(() => {
      void refresh();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [
    receipt?.id,
    receipt?.paymentStatus,
    receipt?.paymentAccessToken,
  ]);

  /*
   * Loading state
   */
  if (event === undefined) {
    return (
      <>
        <PublicTopBar />

        <main className="event-detail-shell">
          <div className="empty-state">
            Loading event...
          </div>
        </main>
      </>
    );
  }

  /*
   * Event not found
   */
  if (!event) {
    return (
      <>
        <PublicTopBar />

        <main className="event-detail-shell">
          <div className="panel">
            <div className="panel-body empty-state">
              This event could not be found.
            </div>
          </div>
        </main>
      </>
    );
  }

  const bookedEvent = event;

  const date = formatDateLabel(event.date);

  const seatsLeft = Math.max(
    0,
    event.capacity - event.attendees,
  );

  const isFree = event.eventType === "free";

  const soldOut =
    event.status === "sold-out" ||
    (event.capacity > 0 && seatsLeft === 0);

  const closed = event.status !== "published" && event.status !== "sold-out";

  /*
   * Update dynamic registration field
   */
  const setResponse = (
    field: EventFormFieldItem,
    value: string | boolean,
  ) => {
    setResponses((current) => ({
      ...current,
      [field.name]: value,
    }));
  };

  /*
   * Registration details validation
   */
  function reportDetailsError(message: string) {
    setError(message);
  }

  /*
   * Move from Details → Payment
   */
  function continueToPayment(e: FormEvent) {
    e.preventDefault();

    setError("");

    if (name.trim().length < 2 || !email.trim() || !phone.trim()) {
      return reportDetailsError(
        "Enter a name with at least 2 characters, email, and phone number.",
      );
    }

    if (!isValidEmail(email)) return reportDetailsError("Enter a valid email address.");
    if (!isValidPhone(phone)) return reportDetailsError("Enter a valid phone number with 7 to 15 digits.");
    if (closed || soldOut) return reportDetailsError("Registration is unavailable for this event.");
    if (!isFree && (!Number.isFinite(bookedEvent.price) || bookedEvent.price <= 0)) {
      return reportDetailsError("Ticket pricing is unavailable. Please contact the organizer.");
    }
    for (const field of bookedEvent.fields ?? []) {
      const message = validateRegistrationField(field, responses[field.name]);
      if (message) return reportDetailsError(message);
    }

    if (isFree) {
      void placeBooking();
      return;
    }
    setStage("payment");
  }

  async function placeBooking() {
    if (bookingInFlight.current) {
      return;
    }

    bookingInFlight.current = true;
    setError("");
    setSubmitting(true);
    setStage("processing");

    try {
      const result = await createBooking(slug, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          responses: Object.fromEntries(Object.entries(responses).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])),
          ...(isFree
            ? {}
            : {
                paymentMethod: "sbiepay" as const,
              }),
        });
      const booking = result.booking;
      setReceipt(booking);
      if (!isFree && result.transactionUrl) {
        try {
          const checkout = new URL(result.transactionUrl, window.location.origin);
          if (!["http:", "https:"].includes(checkout.protocol)) throw new Error("Invalid checkout URL");
          window.location.assign(checkout.href);
          return;
        } catch {
          // Keep the saved order and its status link available if navigation fails.
        }
      }
      setStage("success");

      if (!isFree) {
        setNotice({
          title: "Payment verification pending",
          success: true,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not submit registration.";

      setError(message);

      setStage(isFree ? "details" : "payment");
    } finally {
      bookingInFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    await placeBooking();
  }

  return (
    <>
      <PublicTopBar />

      <main
        className="event-detail-shell"
        style={
          {
            "--event-category-color":
              CATEGORY_COLORS[event.category],
          } as CSSProperties
        }
      >
        <div className="public-event-grid">
          {/* =========================
              EVENT INFORMATION
          ========================== */}

          <section>
            <EventBannerSlider
              banners={event.banners || []}
              title={event.title}
            />

            <span className="vip-badge-tag">
              {event.category}
            </span>

            <h1>{event.title}</h1>

            <p className="event-sub">
              Hosted by <strong>{event.host}</strong>
            </p>

            <div className="detail-grid">
              <Detail
                icon={faCalendarDays}
                label="Date"
                value={date.full || "TBA"}
              />

              <Detail
                icon={faClock}
                label="Time"
                value={timeLabel(event.time)}
              />

              <Detail
                icon={
                  event.eventMode === "online"
                    ? faGlobe
                    : faLocationDot
                }
                label={
                  event.eventMode === "online"
                    ? "Online event"
                    : "Venue"
                }
                value={
                  event.eventMode === "online"
                    ? "Join online"
                    : event.venue || "TBA"
                }
              />

              <Detail
                icon={faUserGroup}
                label="Seats left"
                value={
                  event.capacity
                    ? String(seatsLeft)
                    : "Unlimited"
                }
              />
            </div>

            {event.description ? (
              <div className="event-description">
                <h3>About this event</h3>

                <p className="event-sub">
                  {event.description}
                </p>
              </div>
            ) : null}

            {event.eventMode === "online" ? (
              <p className="hint">
                <FontAwesomeIcon icon={faGlobe} />
                {" "}
                Joining instructions appear after
                registration.
              </p>
            ) : null}
          </section>

          {/* =========================
              BOOKING CARD
          ========================== */}

          <section className="booking-card booking-form-card">
            {closed || soldOut ? (
              <div className="sold-out-banner">
                {closed
                  ? "Registration is closed."
                  : "This event is sold out."}
              </div>
            ) : (
              <>
                <BookingSteps
                  stage={stage}
                  isFree={isFree}
                />

                {/* =====================
                    STEP 1: DETAILS
                ====================== */}

                {stage === "details" && (
                  <form
                    onSubmit={continueToPayment}
                    className="registration-form"
                    noValidate
                  >
                    <p className="chart-kicker">
                      {isFree
                        ? "Free registration"
                        : `${formatCurrency(
                            event.price,
                          )} per attendee`}
                    </p>

                    <h2>
                      Registration details
                    </h2>

                    <p className="hint">
                      {session ? (
                        `Booking as ${session.name}.`
                      ) : (
                        <>
                          Booking as a guest.{" "}
                          <Link href="/signin">
                            Sign in
                          </Link>{" "}
                          to track your booking.
                        </>
                      )}
                    </p>

                    <Field
                      label="Full Name"
                      value={name}
                      onChange={setName}
                      required
                    />

                    <Field
                      label="Email Address"
                      value={email}
                      onChange={setEmail}
                      type="email"
                      required
                    />

                    <Field
                      label="Phone Number"
                      value={phone}
                      onChange={setPhone}
                      type="tel"
                      required
                    />

                    {(event.fields ?? []).map(
                      (field) => (
                        <RegistrationField
                          key={field.id}
                          field={field}
                          value={
                            responses[field.name]
                          }
                          onChange={setResponse}
                        />
                      ),
                    )}

                    <button
                      className="btn btn-vibrant"
                      type="submit"
                      disabled={submitting}
                    >
                      {isFree ? "Register for free" : "Continue to payment"}
                    </button>
                    {error && <p className="hint" role="alert">{error}</p>}
                  </form>
                )}

                {/* =====================
                    STEP 2: PAYMENT
                ====================== */}

                {stage === "payment" && (
                  <form
                    onSubmit={handlePay}
                    className="registration-form"
                    noValidate
                  >
                    <h2>
                      Pay with SBI ePay
                    </h2>

                    <p className="hint">You will be redirected to SBI ePay to complete payment securely.</p>

                    <div className="order-summary pro">
                      <div className="order-summary-row">
                        <span>
                          {event.title}
                        </span>

                        <strong>
                          {formatCurrency(event.price)}
                        </strong>
                      </div>

                      <div className="order-summary-row">
                        <span>Attendee</span>

                        <span>{name}</span>
                      </div>
                    </div>

                    <p className="hint">Your payment will be verified automatically using SBI Order Search before registration is confirmed.</p>

                    <button
                      className="btn btn-vibrant"
                      type="submit"
                      disabled={submitting}
                    >
                      Proceed to SBI ePay
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setStage("details")
                      }
                      disabled={submitting}
                    >
                      <FontAwesomeIcon
                        icon={faArrowLeft}
                      />

                      {" "}
                      Back to details
                    </button>

                    {error && (
                      <p className="hint" role="alert">
                        {error}
                      </p>
                    )}
                  </form>
                )}

                {/* =====================
                    STEP 3: PROCESSING
                ====================== */}

                {stage === "processing" && (
                  <div className="checkout-processing">
                    <Loader size={48} />

                    <strong>
                      {isFree
                        ? "Completing your registration..."
                        : "Starting your SBI ePay payment..."}
                    </strong>
                  </div>
                )}

                {/* =====================
                    STEP 4: SUCCESS
                ====================== */}

                {stage === "success" &&
                  receipt && (
                    <SuccessReceipt
                      event={event}
                      date={date}
                      receipt={receipt}
                    />
                  )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* =========================
          PAYMENT NOTICE
      ========================== */}

      {notice && (
        <PaymentNotice
          title={notice.title}
          onClose={() => setNotice(null)}
        >
          {notice.success && receipt ? (
            <>
              <p>
                Your order has been saved, but SBI checkout could not be opened.
              </p>

              <p>
                We will verify the order automatically. Save your status link and check your booking before starting another payment.
              </p>

              <PaymentStatusActions
                href={paymentStatusLink(receipt)}
              />

              <p className="hint">
                Save this private link to check
                your booking and payment status.
              </p>
            </>
          ) : (
            <p>{notice.message}</p>
          )}
        </PaymentNotice>
      )}
    </>
  );
}

/* =====================================
   EVENT DETAIL
===================================== */

function Detail({
  icon,
  label,
  value,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
}) {
  return (
    <div className="detail-card">
      <FontAwesomeIcon icon={icon} />

      <div className="label">
        {label}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

/* =====================================
   BOOKING STEPS
===================================== */

function BookingSteps({
  stage,
  isFree,
}: {
  stage: Stage;
  isFree: boolean;
}) {
  const steps: [number, string][] = isFree
    ? [
        [1, "Details"],
        [2, "Confirmed"],
      ]
    : [
        [1, "Details"],
        [2, "Payment"],
        [3, "Complete"],
      ];

  const current =
    stage === "details"
      ? 1
      : isFree
        ? 2
        : stage === "payment"
          ? 2
          : 3;

  return (
    <nav
      className="booking-step-nav"
      style={isFree ? { gridTemplateColumns: "repeat(2, 1fr)" } : undefined}
      aria-label="Booking progress"
    >
      {steps.map(([n, label]) => (
        <div
          className={`booking-step ${
            current === n
              ? "active"
              : current > n
                ? "complete"
                : ""
          }`}
          key={String(n)}
        >
          <span>
            {current > n
              ? "✓"
              : n}
          </span>

          <strong>{label}</strong>
        </div>
      ))}
    </nav>
  );
}

/* =====================================
   NORMAL FIELD
===================================== */

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}

        {required && (
          <span className="required-star">
            {" "}
            *
          </span>
        )}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        placeholder={`Enter ${label
          .replace(" *", "")
          .toLowerCase()}`}
        onChange={(e) =>
          onChange(e.target.value)
        }
        required={required}
      />
    </div>
  );
}

/* =====================================
   REGISTRATION FIELD
===================================== */

function RegistrationField({
  field,
  value,
  onChange,
}: {
  field: EventFormFieldItem;
  value: string | boolean | undefined;
  onChange: (
    field: EventFormFieldItem,
    value: string | boolean,
  ) => void;
}) {
  const id = useId();
  if (field.type === "textarea") {
    return (
      <div className="field">
        <label htmlFor={id}>{field.label}{field.required ? " *" : ""}</label>
        <textarea id={id} value={String(value ?? "")} required={field.required}
          onChange={(e) => onChange(field, e.target.value)} rows={4} />
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="registration-checkbox">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) =>
            onChange(
              field,
              e.target.checked,
            )
          }
        />

        <span>
          <b>Checkbox</b> ·{" "}
          {field.label}
          {field.required ? " *" : ""}
        </span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div className="field">
        <label>
          <b>Dropdown</b> ·{" "}
          {field.label}
          {field.required ? " *" : ""}
        </label>

        <select
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(
              field,
              e.target.value,
            )
          }
        >
          <option value="">
            Choose{" "}
            {field.label.toLowerCase()}
            ...
          </option>

          {field.options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <fieldset className="registration-radio">
        <legend>
          <b>Radio</b> ·{" "}
          {field.label}
          {field.required ? " *" : ""}
        </legend>

        {field.options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={field.name}
              checked={value === option}
              onChange={() =>
                onChange(
                  field,
                  option,
                )
              }
            />

            {" "}
            {option}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <Field
      label={`${field.label}${
        field.required ? " *" : ""
      }`}
      value={String(value ?? "")}
      onChange={(v) =>
        onChange(field, v)
      }
      required={field.required}
      type={
        field.type === "phone"
          ? "tel"
          : field.type
      }
    />
  );
}

/* =====================================
   SUCCESS RECEIPT
===================================== */

function SuccessReceipt({
  event,
  date,
  receipt,
}: {
  event: EventItem;
  date: ReturnType<
    typeof formatDateLabel
  >;
  receipt: BookingItem;
}) {
  const isFree = event.eventType === "free";
  const paymentCompleted = receipt.paymentStatus === "paid";
  const isPaid = paymentCompleted && receipt.registrationStatus === "approved";

  const isRejected =
    receipt.registrationStatus ===
    "rejected";

  return (
    <div className="ticket-stub-wrap">
      <div
        className={`payment-review-banner ${
          paymentCompleted
            ? "is-completed"
            : isRejected
              ? "is-rejected"
              : "is-pending"
        }`}
      >
        <FontAwesomeIcon
          icon={faCircleCheck}
        />

        {" "}

        {isFree ? "Registration confirmed" : PAYMENT_STATUS_LABELS[receipt.paymentStatus]}
      </div>

      <p className="event-sub">
        {isFree
          ? "Your free registration is confirmed! A confirmation email with your ticket details has been sent to your email address."
          : isPaid
          ? "Thank you for registering. A confirmation email with your ticket has been sent to your email address."
          : isRejected
            ? "Please contact the organizer about your payment."
            : paymentCompleted
              ? receipt.rejectionReason || "Payment is completed. Please contact the organizer about your registration."
              : "SBI ePay verification is pending. Save your private status link below to track your payment."}
      </p>

      {!isFree && <PaymentStatusActions href={paymentStatusLink(receipt)} />}

      {!isFree && isRejected &&
        receipt.rejectionReason && (
          <p className="payment-review-banner is-rejected">
            Reason:{" "}
            {receipt.rejectionReason}
          </p>
        )}

      <div className="ticket-stub">
        <div className="ticket-stub-hero-title">
          {event.title}
        </div>

        <div className="ticket-stub-hero-meta">
          <span>{date.full}</span>

          <span>
            {event.eventMode === "online"
              ? "Online event"
              : event.venue}
          </span>
        </div>

        <div className="ticket-stub-body">
          <strong>{receipt.name}</strong>

          <span>{isFree ? "Free registration confirmed" : PAYMENT_STATUS_LABELS[receipt.paymentStatus]}</span>

          {(isPaid || isFree) &&
            event.eventMode ===
              "online" &&
            event.onlineUrl && (
              <a
                href={event.onlineUrl}
                target="_blank"
                rel="noreferrer"
              >
                Join online event
              </a>
            )}
        </div>
      </div>
    </div>
  );
}
