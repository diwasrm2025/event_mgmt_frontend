"use client";
import { ProgressLoader } from "@/components/ui/ProgressLoader";

import { registrationClosed, formatRegistrationDeadline, isDobField, pairDobAndAgeFields, calculateAgeWithMonths } from "@/lib/registration";
import { ShareEventLink } from "./ShareEventLink";
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

  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick(n => n + 1), 1000); return () => window.clearInterval(timer); }, []);

  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [phone, setPhone] = useState("");

  const [responses, setResponses] = useState<
    Record<string, string | boolean | string[]>
  >({});

  const [stage, setStage] = useState<Stage>("details");

  const [receipt, setReceipt] = useState<BookingItem | null>(null);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
            <ProgressLoader label="Loading event" />
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

  if (registrationClosed(event) || event.status === "completed") return <><PublicTopBar /><main className="event-closed-page"><section className="event-closed-banner" aria-labelledby="registration-closed-title"><div className="closed-status-icon"><FontAwesomeIcon icon={faClock} /></div><span className="closed-eyebrow">REGISTRATION CLOSED</span><h1 id="registration-closed-title">Registration for this event has closed.</h1><p>The registration period has ended. New registrations are no longer available.</p>{event.registrationDeadline && <p className="closed-deadline">Last date of registration: <strong>{formatRegistrationDeadline(event.registrationDeadline)}</strong></p>}<Link href="/events" className="btn btn-accent">Explore other events</Link></section></main></>;


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
    value: string | boolean | string[],
  ) => {
    setResponses((current) => ({
      ...current,
      [field.name]: value,
    }));
  };

  /*
   * Registration details validation
   */
  function reportDetailsError(message: string, fieldName?: string) {
    setError(message);
    if (fieldName) setFieldErrors((prev) => ({ ...prev, [fieldName]: message }));
  }

  /*
   * Move from Details → Payment
   */
  function continueToPayment(e: FormEvent) {
    e.preventDefault();

    setError("");
    setFieldErrors({});

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
      if (message) return reportDetailsError(message, field.name);
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
        className="event-detail-shell event-experience"
        style={
          {
            "--event-category-color":
              CATEGORY_COLORS[event.category] || "var(--accent)",
          } as CSSProperties
        }
      >
        <Link className="experience-back" href="/events"><FontAwesomeIcon icon={faArrowLeft} /> Explore all events</Link>
        <ShareEventLink />
        <div className="experience-banner"><EventBannerSlider banners={event.banners || []} title={event.title} />{!event.banners?.length && <div className="experience-banner-fallback"><span>LIVE / {event.category}</span><strong>Your next great experience</strong></div>}</div>
        <header className="experience-heading">
          <div>            <span className="vip-badge-tag">
              {event.category}
            </span>

            <h1>{event.title}</h1>

            <p className="event-sub">
              Hosted by <strong>{event.host}</strong>
            </p></div>
          <div className="experience-entry"><span>{isFree ? "FREE ENTRY" : "YOUR ACCESS PASS"}</span><strong>{formatCurrency(event.price)}</strong><a href="#event-registration" className="btn btn-vibrant">{soldOut ? "View availability" : "Click Here to Register"}</a></div>
        </header>
        {event.registrationDeadline && <div className="experience-deadline"><FontAwesomeIcon icon={faClock} /><div><span>Last date of registration</span><strong>{formatRegistrationDeadline(event.registrationDeadline)}</strong></div></div>}
        <div className="public-event-grid">
          {/* =========================
              EVENT INFORMATION
          ========================== */}

          <section className="experience-story">


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

            {!!event.agenda?.length && <section className="experience-agenda"><p className="chart-kicker">THE LINEUP</p><h2>Your event, moment by moment</h2><ol>{event.agenda.map((item, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol></section>}
            <div className="experience-host"><p className="chart-kicker">BROUGHT TO YOU BY</p><h3>{event.host}</h3><p>One event. A shared experience. Make it yours.</p></div>
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

          <section id="event-registration" className="booking-card booking-form-card">
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

                    {(() => {
                      const fields = event.fields ?? [];
                      const { dobToAge, ageToDob } = pairDobAndAgeFields(fields);
                      return fields.map((field) => {
                        // Age fields paired to a DOB are hidden — they auto-fill
                        if (ageToDob[field.name]) return null;
                        // If this DOB field has a paired age field, pass its name and the computed value
                        const pairedAgeName = dobToAge[field.name];
                        const autoAge = (pairedAgeName && calculateAgeWithMonths(responses[field.name])) || undefined;
                        return (
                          <RegistrationField
                            key={field.id}
                            field={field}
                            value={responses[field.name]}
                            autoAge={autoAge}
                            pairedAgeName={pairedAgeName}
                            error={fieldErrors[field.name]}
                            onChange={(f, v) => {
                              setResponse(f, v);
                              // Clear per-field error on change
                              if (fieldErrors[f.name]) setFieldErrors((prev) => { const n = { ...prev }; delete n[f.name]; return n; });
                              // When DOB changes, also update paired age field
                              if (pairedAgeName) {
                                const computed = calculateAgeWithMonths(v as string);
                                setResponses((cur) => ({ ...cur, [pairedAgeName]: computed ?? "" }));
                              }
                            }}
                          />
                        );
                      });
                    })()}

                    <button
                      className="btn btn-vibrant"
                      type="submit"
                      disabled={submitting}
                    >
                      {isFree ? "Register for free" : "Continue to payment"}
                    </button>
                    {error && <p className="form-error-message" role="alert">{error}</p>}
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
  autoAge,
  pairedAgeName,
  error,
  onChange,
}: {
  field: EventFormFieldItem;
  value: string | boolean | string[] | undefined;
  autoAge?: string;
  pairedAgeName?: string;
  error?: string;
  onChange: (
    field: EventFormFieldItem,
    value: string | boolean | string[],
  ) => void;
}) {
  const id = useId();
  const hasError = !!error;

  if (field.type === "textarea") {
    return (
      <div className={`field${hasError ? " field-has-error" : ""}`}>
        <label htmlFor={id}>
          {field.label}
          {field.required ? <span className="field-required-star"> *</span> : ""}
        </label>
        <textarea
          id={id}
          value={String(value ?? "")}
          required={field.required}
          aria-invalid={hasError}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          onChange={(e) => onChange(field, e.target.value)}
          rows={4}
        />
        {hasError && <p className="field-inline-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (field.type === "checkbox") {
    if (field.options.length) {
      const selected = Array.isArray(value) ? value : [];
      return (
        <fieldset className={`registration-choice-group${hasError ? " field-has-error" : ""}`}>
          <legend>
            {field.label}
            {field.required ? <span className="field-required-star"> *</span> : ""}
          </legend>
          <div className="choice-options-list">
            {field.options.map((option) => (
              <label key={option} className="choice-option-row">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={(e) =>
                    onChange(
                      field,
                      e.target.checked
                        ? [...selected, option]
                        : selected.filter((item) => item !== option),
                    )
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {hasError && <p className="field-inline-error" role="alert">{error}</p>}
        </fieldset>
      );
    }
    // Single boolean checkbox
    return (
      <div className={`field${hasError ? " field-has-error" : ""}`}>
        <label className="registration-checkbox">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(field, e.target.checked)}
          />
          <span>
            {field.label}
            {field.required ? <span className="field-required-star"> *</span> : ""}
          </span>
        </label>
        {hasError && <p className="field-inline-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={`field${hasError ? " field-has-error" : ""}`}>
        <label htmlFor={id}>
          {field.label}
          {field.required ? <span className="field-required-star"> *</span> : ""}
        </label>
        <select
          id={id}
          value={String(value ?? "")}
          aria-invalid={hasError}
          onChange={(e) => onChange(field, e.target.value)}
        >
          <option value="">Choose {field.label.toLowerCase()}…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {hasError && <p className="field-inline-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <fieldset className={`registration-choice-group${hasError ? " field-has-error" : ""}`}>
        <legend>
          {field.label}
          {field.required ? <span className="field-required-star"> *</span> : ""}
        </legend>
        <div className="choice-options-list">
          {field.options.map((option) => (
            <label key={option} className="choice-option-row">
              <input
                type="radio"
                name={field.name}
                checked={value === option}
                onChange={() => onChange(field, option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {hasError && <p className="field-inline-error" role="alert">{error}</p>}
      </fieldset>
    );
  }

  // DOB field — show paired age auto-computed below
  if (isDobField(field)) {
    return (
      <div className={`field${hasError ? " field-has-error" : ""}`}>
        <label htmlFor={id}>
          {field.label}
          {field.required ? <span className="field-required-star"> *</span> : ""}
        </label>
        <input
          id={id}
          type="date"
          value={String(value ?? "")}
          required={field.required}
          aria-invalid={hasError}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange(field, e.target.value)}
        />
        {pairedAgeName && (
          <div className="dob-age-badge">
            <span className="dob-age-label">Age (auto-calculated)</span>
            <input
              type="text"
              readOnly
              value={autoAge ?? ""}
              placeholder="Fills automatically"
              className="dob-age-readonly"
              tabIndex={-1}
            />
          </div>
        )}
        {hasError && <p className="field-inline-error" role="alert">{error}</p>}
      </div>
    );
  }

  // Generic text / number / email / tel / date fields
  return (
    <div className={`field${hasError ? " field-has-error" : ""}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required ? <span className="field-required-star"> *</span> : ""}
      </label>
      <input
        id={id}
        type={field.type === "phone" ? "tel" : field.type || "text"}
        value={String(value ?? "")}
        required={field.required}
        aria-invalid={hasError}
        placeholder={field.type === "date" ? undefined : `Enter ${field.label.toLowerCase()}`}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {hasError && <p className="field-inline-error" role="alert">{error}</p>}
    </div>
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

  const statusClass = paymentCompleted ? "is-completed" : isRejected ? "is-rejected" : "is-pending";
  const bookingRef = receipt.id ? String(receipt.id).slice(0, 8).toUpperCase() : "—";

  return (
    <div className="ticket-stub-wrap">
      {/* Status banner */}
      <div className={`payment-review-banner ${statusClass}`}>
        <FontAwesomeIcon icon={faCircleCheck} />{" "}
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

      {!isFree && isRejected && receipt.rejectionReason && (
        <p className="payment-review-banner is-rejected">
          Reason: {receipt.rejectionReason}
        </p>
      )}

      {/* ── Premium Ticket Card ── */}
      <div className="ticket-card">
        {/* Ticket header */}
        <div className="ticket-card-header">
          <div className="ticket-card-eyebrow">✦ Admission Ticket</div>
          <div className="ticket-card-event-name">{event.title}</div>
          <div className="ticket-card-meta">
            <span>📅 {date.full}</span>
            <span>📍 {event.eventMode === "online" ? "Online Event" : (event.venue || "TBA")}</span>
            {event.time && <span>⏰ {timeLabel(event.time ?? "")}</span>}
          </div>
        </div>

        {/* Perforated divider */}
        <div className="ticket-card-perforation">
          <div className="ticket-perf-circle ticket-perf-left" />
          <div className="ticket-perf-dashes" />
          <div className="ticket-perf-circle ticket-perf-right" />
        </div>

        {/* Ticket body */}
        <div className="ticket-card-body">
          <div className="ticket-card-attendee">
            <span className="ticket-card-field-label">Attendee</span>
            <span className="ticket-card-field-value">{receipt.name}</span>
          </div>
          <div className="ticket-card-row">
            <div className="ticket-card-col">
              <span className="ticket-card-field-label">Booking Ref</span>
              <span className="ticket-card-field-value mono"># {bookingRef}</span>
            </div>
            <div className="ticket-card-col">
              <span className="ticket-card-field-label">Status</span>
              <span className={`ticket-card-status-pill ${statusClass}`}>
                {isFree ? "Confirmed" : PAYMENT_STATUS_LABELS[receipt.paymentStatus]}
              </span>
            </div>
          </div>

          {(isPaid || isFree) && event.eventMode === "online" && event.onlineUrl && (
            <a
              href={event.onlineUrl}
              target="_blank"
              rel="noreferrer"
              className="ticket-card-join-btn"
            >
              Join Online Event →
            </a>
          )}
        </div>

        {/* Barcode strip */}
        <div className="ticket-card-barcode-strip">
          <div className="ticket-barcode-lines" aria-hidden="true">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="ticket-barcode-bar"
                style={{ height: i % 5 === 0 ? "38px" : i % 3 === 0 ? "28px" : "22px" } as CSSProperties}
              />
            ))}
          </div>
          <div className="ticket-barcode-num">{receipt.id ? String(receipt.id).toUpperCase() : "—"}</div>
        </div>
      </div>
    </div>
  );
}
