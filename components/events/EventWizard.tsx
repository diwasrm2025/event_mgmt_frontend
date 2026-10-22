"use client";
import Link from "next/link";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Swal } from "@/lib/swal";
import {
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowDown,
  faCheck,
  faCloudArrowUp,
  faCopy,
  faPlus,
  faSpinner,
  faTrash,
  faUsers,
  faCircleInfo,
  faCalendarDays,
  faClock,
  faMapPin,
  faMicrophone,
  faTag,
  faAlignLeft,
  faTicket,
  faBullhorn,
  faListCheck,
  faStar,
  faGlobe,
  faImage,
  faClipboardList,
  faShareNodes,
} from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createDraftEvent,
  createEventField,
  finalizeEvent,
  formatCurrency,
  getEvent,
  getEventLinkAbsolute,
  removeEvent,
  removeEventBanner,
  removeEventField,
  reorderEventFields,
  updateEvent,
  updateEventField,
  uploadEventBanner,
  type EventCategory,
  type EventMode,
  type EventType,
  type EventFormFieldItem,
  type EventItem,
  type EventStatus,
  type FieldType,
} from "@/lib/events";
import { isValidCapacity, isValidDate, isValidHttpUrl, isValidTicketPrice } from "@/lib/event-validation";
import { getApiBaseUrl } from "@/lib/api";
import { EventBannerSlider } from "./EventBannerSlider";
import { SharedMembersPanel } from "./SharedMembersPanel";
import { EventDashboardSummary } from "./EventDashboardSummary";

const STEPS = [
  {
    id: 1,
    label: "Event Info & Pricing",
    icon: faTag,
    desc: "Format, pricing, schedule & venue",
  },
  {
    id: 2,
    label: "Agenda, Details & Media",
    icon: faImage,
    desc: "Status, agenda, cover & banner images",
  },
  {
    id: 3,
    label: "Registration Form",
    icon: faClipboardList,
    desc: "Custom booking fields for attendees",
  },
  {
    id: 4,
    label: "Review & Publish",
    icon: faShareNodes,
    desc: "Confirm everything and go live",
  },
] as const;

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio buttons" },
];

type InfoForm = {
  title: string;
  category: EventCategory;
  description: string;
  date: string;
  timeHour: string;
  timeMinute: string;
  timePeriod: "AM" | "PM";
  eventMode: EventMode;
  onlineUrl: string;
  venue: string;
  host: string;
  capacity: number;
  eventType: EventType;
  price: number;
};

type DetailsForm = {
  status: EventStatus;
  featured: boolean;
  agenda: string;
};

type NewFieldForm = {
  label: string;
  type: FieldType;
  required: boolean;
  options: string;
};

function emptyNewField(): NewFieldForm {
  return { label: "", type: "text", required: false, options: "" };
}

function parse24HrTime(time: string): { timeHour: string; timeMinute: string; timePeriod: "AM" | "PM" } {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { timeHour: "12", timeMinute: "00", timePeriod: "PM" };
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period: "AM" | "PM" = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { timeHour: String(h).padStart(2, "0"), timeMinute: m, timePeriod: period };
}

function to24HrTime(hour: string, minute: string, period: "AM" | "PM"): string {
  let h = parseInt(hour, 10) || 12;
  if (period === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, "0")}:${minute}`;
}

type EventWizardProps = {
  eventId?: string;
  onToast: (message: string) => void;
};

export function EventWizard({ eventId, onToast }: EventWizardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(Boolean(eventId));
  const [event, setEvent] = useState<EventItem | null>(null);
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [info, setInfo] = useState<InfoForm>({
    title: "",
    category: "Music",
    description: "",
    date: "",
    timeHour: "10",
    timeMinute: "00",
    timePeriod: "AM",
    eventMode: "offline",
    onlineUrl: "",
    venue: "",
    host: "",
    capacity: 100,
    eventType: "free",
    price: 0,
  });
  const [details, setDetails] = useState<DetailsForm>({ status: "published", featured: false, agenda: "" });

  const [fields, setFields] = useState<EventFormFieldItem[]>([]);
  const [newField, setNewField] = useState<NewFieldForm>(emptyNewField());
  const [savingField, setSavingField] = useState(false);

  const hydrateFromEvent = useCallback((loaded: EventItem) => {
    setEvent(loaded);
    const tParts = parse24HrTime(loaded.time || "");
    const evtType: EventType = loaded.eventType ?? (loaded.price > 0 ? "paid" : "free");
    setInfo({
      title: loaded.title,
      category: loaded.category,
      description: loaded.description,
      date: loaded.date,
      timeHour: tParts.timeHour,
      timeMinute: tParts.timeMinute,
      timePeriod: tParts.timePeriod,
      eventMode: loaded.eventMode,
      onlineUrl: loaded.onlineUrl,
      venue: loaded.venue,
      host: loaded.host,
      capacity: loaded.capacity,
      eventType: evtType,
      price: loaded.price,
    });
    setDetails({ status: !loaded.slug && loaded.status === "draft" ? "published" : loaded.status, featured: loaded.featured, agenda: loaded.agenda.join("\n") });
    setFields((loaded.fields ?? []).slice().sort((a, b) => a.order - b.order));
    setMaxStepReached((current) => Math.max(current, loaded.slug ? 4 : Math.min(loaded.wizardStep || 1, 4)));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      try {
        const loaded = await getEvent(eventId);
        if (loaded) {
          hydrateFromEvent(loaded);
          setStep(loaded.slug ? 4 : Math.min(loaded.wizardStep || 1, 4));
        } else {
          setError("This event could not be found.");
        }
      } catch {
        setError("Could not load this event.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, hydrateFromEvent]);

  const goToStep = (target: number) => {
    if (target > maxStepReached || saving || uploadingBanner || savingField) return;
    if (target > step && (step === 1 || step === 2)) {
      setError("Save this step using Continue before moving forward.");
      return;
    }
    setStep(target);
    setError("");
    setStepErrors({});
  };

  const advance = (target: number) => {
    setMaxStepReached((current) => Math.max(current, target));
    setStep(target);
    setError("");
    setStepErrors({});
  };

  const validateStep1 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (info.title.trim().length < 2) errs.title = "Event title must be at least 2 characters.";
    if (!isValidDate(info.date)) errs.date = "Please select a valid event date.";
    if (info.eventMode === "online" && !isValidHttpUrl(info.onlineUrl)) errs.onlineUrl = "Enter a valid http or https meeting URL.";
    if (info.eventMode === "offline" && !info.venue.trim()) errs.venue = "Venue location is required.";
    if (!isValidCapacity(info.capacity)) errs.capacity = "Total seats must be a whole number between 1 and 2,147,483,647.";
    else if (info.capacity < (event?.attendees ?? 0)) errs.capacity = "Total seats cannot be fewer than booked seats.";
    if (info.eventType === "paid" && !isValidTicketPrice(info.price)) {
      errs.price = "Enter a ticket price greater than zero with at most two decimal places.";
    }
    return errs;
  };

  const submitInfo = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (saving) return;
    const errs = validateStep1();
    if (Object.keys(errs).length) {
      setStepErrors(errs);
      return;
    }
    setStepErrors({});
    setError("");
    setSaving(true);
    try {
      let current = event;
      if (!current) {
        current = await createDraftEvent(info.title.trim());
        setEvent(current);
      }
      const time24 = to24HrTime(info.timeHour, info.timeMinute, info.timePeriod);
      const updated = await updateEvent(current.id, {
        title: info.title.trim(),
        category: info.category,
        description: info.description.trim(),
        date: info.date,
        time: time24,
        eventMode: info.eventMode,
        onlineUrl: info.eventMode === "online" ? info.onlineUrl.trim() : "",
        venue: info.eventMode === "offline" ? info.venue.trim() : "",
        host: info.host.trim() || "Organizer",
        capacity: Number(info.capacity),
        eventType: info.eventType,
        price: info.eventType === "paid" ? Number(info.price) : 0,
        wizardStep: 2,
      });
      setEvent((c) => ({ ...updated, isOwner: c?.isOwner, sharedPermissions: c?.sharedPermissions }));
      advance(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event info.");
    } finally {
      setSaving(false);
    }
  };

  const [bannerDragActive, setBannerDragActive] = useState(false);

  const handleBannerFiles = async (files: FileList | File[] | File | undefined | null) => {
    if (!files || !event || uploadingBanner) return;
    const fileList = files instanceof File ? [files] : Array.from(files);
    if (!fileList.length) return;
    setUploadingBanner(true);
    try {
      let latestEvent = event;
      for (const file of fileList) {
        if (!/\.(jpe?g|png|webp|gif)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
          onToast(`Skipped ${file.name}: use JPG, PNG, WebP or GIF images up to 5 MB.`);
          continue;
        }
        if ((latestEvent.banners ?? []).length >= 8) {
          onToast("You can add up to 8 banner images.");
          break;
        }
        latestEvent = await uploadEventBanner(latestEvent.id, file);
        setEvent((current) => ({ ...latestEvent, isOwner: current?.isOwner, sharedPermissions: current?.sharedPermissions }));
      }
      setEvent((c) => ({ ...latestEvent, isOwner: c?.isOwner, sharedPermissions: c?.sharedPermissions }));
      onToast("Photo(s) added.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setUploadingBanner(false);
    }
  };
  const handleBannerFile = (file: File | undefined | null) => void handleBannerFiles(file);

  const handleRemoveBanner = async (url: string) => {
    if (!event) return;
    if (!(await Swal.confirm("Are you sure want to delete", "This photo will no longer appear on the event page.", "Remove photo")).isConfirmed) return;
    try {
      const updated = await removeEventBanner(event.id, url);
      setEvent((c) => ({ ...updated, isOwner: c?.isOwner, sharedPermissions: c?.sharedPermissions }));
      onToast("Banner removed.");
    } catch {
      onToast("Could not remove that banner.");
    }
  };

  const submitDetails = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event || saving || uploadingBanner) return;
    if (details.agenda.split("\n").filter((line) => line.trim()).length > 30) {
      setError("Add no more than 30 agenda items.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const updated = await updateEvent(event.id, {
        status: details.status,
        featured: details.featured,
        agenda: details.agenda
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        wizardStep: 3,
      });
      setEvent((c) => ({ ...updated, isOwner: c?.isOwner, sharedPermissions: c?.sharedPermissions }));
      advance(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save these details.");
    } finally {
      setSaving(false);
    }
  };

  // Reorder banners to put chosen URL at index 0 (= default slide)
  const setDefaultSlide = async (url: string) => {
    if (!event) return;
    const banners = event.banners ?? [];
    const idx = banners.indexOf(url);
    if (idx <= 0) return; // already default
    const reordered = [url, ...banners.filter((b) => b !== url)];
    try {
      const updated = await updateEvent(event.id, { banners: reordered });
      setEvent((c) => ({ ...updated, isOwner: c?.isOwner, sharedPermissions: c?.sharedPermissions }));
      onToast("Default slide updated.");
    } catch {
      onToast("Could not update default slide.");
    }
  };

  // Build a full URL from a possibly-relative banner path
  const bannerSrc = (url: string) => {
    if (/^https?:\/\//i.test(url)) return url;
    const base = getApiBaseUrl().replace(/\/api$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const addField = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event) return;
    if (!newField.label.trim()) {
      onToast("Give the field a label.");
      return;
    }
    const options = [...new Set(newField.options.split(",").map((option) => option.trim()).filter(Boolean))];
    if (["select", "radio"].includes(newField.type) && options.length < 2) {
      onToast("Add at least two distinct options for this field.");
      return;
    }
    if (savingField) return;
    setSavingField(true);
    try {
      const created = await createEventField(event.id, {
        label: newField.label.trim(),
        type: newField.type,
        required: newField.required,
        options: ["select", "radio"].includes(newField.type) ? options : [],
      });
      setFields((current) => [...current, created]);
      setNewField(emptyNewField());
      onToast("Field added to registration form.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not add that field.");
    } finally {
      setSavingField(false);
    }
  };

  const toggleFieldRequired = async (field: EventFormFieldItem) => {
    if (!event) return;
    try {
      const updated = await updateEventField(event.id, field.id, { required: !field.required });
      setFields((current) => current.map((item) => (item.id === field.id ? updated : item)));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not update that field.");
    }
  };

  const deleteField = async (field: EventFormFieldItem) => {
    if (!event) return;
    if (!(await Swal.confirm("Are you sure want to delete", field.label, "Remove field")).isConfirmed) return;
    try {
      await removeEventField(event.id, field.id);
      setFields((current) => current.filter((item) => item.id !== field.id));
      onToast("Registration field removed.");
    } catch {
      onToast("Could not remove that field.");
    }
  };

  const moveField = async (index: number, direction: -1 | 1) => {
    if (!event) return;
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    try {
      const reordered = await reorderEventFields(
        event.id,
        next.map((f) => f.id),
      );
      setFields(reordered);
    } catch {
      setFields(fields);
      onToast("Could not reorder fields.");
    }
  };

  const finishFields = () => {
    advance(4);
  };

  const publish = async () => {
    if (!event || saving || uploadingBanner) return;
    setError("");
    setSaving(true);
    try {
      const finalized = await finalizeEvent(event.id, details.status);
      setEvent(finalized);
      onToast(finalized.status === "draft" ? "Draft saved. Publish it to accept bookings." : "Event saved with a booking link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish this event.");
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = async () => {
    if (!event) return;
    const url = getEventLinkAbsolute(event);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onToast("Booking link copied.");
    } catch {
      onToast("Could not copy the link. Copy it from the link box.");
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const res = await Swal.confirm("Are you sure want to delete", `Event "${event.title}" will be permanently deleted.`);
    if (!res.isConfirmed) return;
    try {
      await removeEvent(event.id);
      onToast("Event deleted.");
      router.push("/dashboard/events");
    } catch {
      onToast("Could not delete this event.");
    }
  };

  if (loading) {
    return (
      <div className="wizard-loading">
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 24, color: "var(--accent)" }} />
        <p style={{ marginTop: 12, color: "var(--text-faint)" }}>Loading event…</p>
      </div>
    );
  }

  if (event && event.isOwner === false && !event.sharedPermissions?.includes("EDIT")) {
    return (
      <section className="panel">
        <div className="panel-body">
          <EventBannerSlider banners={event.banners || []} title={event.title} />
          <h1>{event.title}</h1>
          <p>{event.description}</p>
          <dl>
            <dt>Date</dt>
            <dd>
              {event.date} {event.time}
            </dd>
            <dt>Venue</dt>
            <dd>{event.venue || "Online event"}</dd>
            <dt>Host</dt>
            <dd>{event.host}</dd>
            <dt>Event type</dt>
            <dd>{event.eventType === "free" ? "Free Event" : formatCurrency(event.price)}</dd>
          </dl>
          <Link className="btn btn-accent" href={`/dashboard/events/${event.id}/attendees`}>
            View attendees
          </Link>
        </div>
      </section>
    );
  }

  const FieldErr = ({ name }: { name: string }) =>
    stepErrors[name] ? <div className="field-error">{stepErrors[name]}</div> : null;

  return (
    <div className="wizard-shell">
      {/* ── LEFT SIDEBAR (30%) ─────────────────────────────── */}
      <aside className="wizard-sidebar">
        <div className="wizard-sidebar-inner">
          <div className="wizard-sidebar-title">
            <span>{eventId ? "Edit Event" : "Create Event"}</span>
          </div>

          <nav className="wizard-step-nav">
            {STEPS.map((item) => {
              const isDone = item.id < step && item.id <= maxStepReached;
              const isActive = item.id === step;
              const isLocked = item.id > maxStepReached;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`wizard-step-item ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${isLocked ? "locked" : ""}`}
                  onClick={() => goToStep(item.id)}
                  disabled={isLocked}
                >
                  <span className="wsb-num">
                    {isDone ? <FontAwesomeIcon icon={faCheck} /> : item.id}
                  </span>
                  <span className="wsb-text">
                    <span className="wsb-label">{item.label}</span>
                    <span className="wsb-desc">{item.desc}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {event && (
            <div className="wizard-sidebar-status">
              <div className="wss-label">Current status</div>
              <span className={`status-badge status-${details.status}`}>
                {details.status === "published" ? "✅" : details.status === "sold-out" ? "🔴" : "📝"}{" "}
                {details.status === "sold-out" ? "Sold Out" : details.status.charAt(0).toUpperCase() + details.status.slice(1)}
              </span>
              {event.slug && (
                <div className="hint" style={{ marginTop: 8, fontSize: 11 }}>
                  Step {step} of 4
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT CONTENT AREA (70%) ────────────────────────── */}
      <div className="wizard-content">
        <FeedbackNotice message={error} icon="error" />

        {/* ── Step 1: Event Info, Format & Pricing ─────────────────────────────── */}
        {step === 1 ? (
          <form onSubmit={submitInfo} noValidate className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 1 of 4</div>
              <h3>Event Details &amp; Pricing</h3>
              <p className="hint">Set your event format, pricing model, venue, schedule, and basic info.</p>
            </div>

            {/* Group 1: Format & Pricing (Side-by-side) */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faGlobe} /> Event Format &amp; Pricing
              </div>
              <div className="wizard-format-pricing-grid">
                {/* Column 1: Event Format */}
                <div className="format-subgroup">
                  <label className="subgroup-label">Event Mode</label>
                  <div className="event-mode-choice-grid">
                    <button
                      type="button"
                      className={`event-mode-choice ${info.eventMode === "offline" ? "selected" : ""}`}
                      onClick={() => setInfo({ ...info, eventMode: "offline" })}
                    >
                      <strong>In-person event</strong>
                      <span>Attendees arrive at a physical venue.</span>
                    </button>
                    <button
                      type="button"
                      className={`event-mode-choice ${info.eventMode === "online" ? "selected" : ""}`}
                      onClick={() => setInfo({ ...info, eventMode: "online" })}
                    >
                      <strong>Online event</strong>
                      <span>Attendees join via video / meeting link.</span>
                    </button>
                  </div>
                </div>

                {/* Column 2: Event Pricing */}
                <div className="format-subgroup">
                  <label className="subgroup-label">Pricing Type</label>
                  <div className="event-mode-choice-grid">
                    <button
                      type="button"
                      className={`event-mode-choice ${info.eventType === "free" ? "selected" : ""}`}
                      onClick={() => setInfo({ ...info, eventType: "free", price: 0 })}
                    >
                      <strong>Free Event</strong>
                      <span>No registration fee or payment required.</span>
                    </button>
                    <button
                      type="button"
                      className={`event-mode-choice ${info.eventType === "paid" ? "selected" : ""}`}
                      onClick={() => setInfo({ ...info, eventType: "paid" })}
                    >
                      <strong>Paid Event</strong>
                      <span>Attendees pay an admission fee.</span>
                    </button>
                  </div>

                  {info.eventType === "paid" && (
                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor="w-price">
                        <FontAwesomeIcon icon={faTicket} className="field-icon" /> Ticket Price (₹){" "}
                        <span className="required-star">*</span>
                      </label>
                      <input
                        id="w-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="e.g. 499"
                        value={info.price === 0 ? "" : info.price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInfo({ ...info, price: val === "" ? 0 : Math.max(0, parseFloat(val) || 0) });
                        }}
                        className={stepErrors.price ? "input-error" : ""}
                        required
                      />
                      <FieldErr name="price" />
                      <div className="hint">Attendees will be directed to payment checkout during registration.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Group 2: Basic Info */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faTag} /> Basic Information
              </div>
              <div className="field">
                <label htmlFor="w-title">
                  Event Title <span className="required-star">*</span>
                </label>
                <input
                  id="w-title"
                  value={info.title}
                  onChange={(e) => setInfo({ ...info, title: e.target.value })}
                  placeholder="e.g. SRM Tech Fusion Symposium 2026"
                  className={stepErrors.title ? "input-error" : ""}
                  required
                />
                <FieldErr name="title" />
              </div>

              <div className="wizard-field-row">
                <div className="field">
                  <label htmlFor="w-category">
                    <FontAwesomeIcon icon={faBullhorn} className="field-icon" /> Category
                  </label>
                  <select
                    id="w-category"
                    value={info.category}
                    onChange={(e) => setInfo({ ...info, category: e.target.value as EventCategory })}
                  >
                    <option value="Music">🎵 Music</option>
                    <option value="Conference">💼 Conference</option>
                    <option value="Workshop">🛠 Workshop</option>
                    <option value="Sports">🏆 Sports</option>
                    <option value="Festival">🎪 Festival</option>
                    <option value="Community">🤝 Community</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="w-host">
                    <FontAwesomeIcon icon={faMicrophone} className="field-icon" /> Host / Department
                  </label>
                  <input
                    id="w-host"
                    value={info.host}
                    onChange={(e) => setInfo({ ...info, host: e.target.value })}
                    placeholder="e.g. SRM Trichy Department of CS"
                  />
                </div>
              </div>
            </div>

            {/* Group 3: Schedule & Venue */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faCalendarDays} /> Schedule &amp; Location
              </div>

              <div className="wizard-field-row">
                <div className="field">
                  <label htmlFor="w-date">
                    Event Date <span className="required-star">*</span>
                  </label>
                  <input
                    id="w-date"
                    type="date"
                    value={info.date}
                    onChange={(e) => setInfo({ ...info, date: e.target.value })}
                    className={stepErrors.date ? "input-error" : ""}
                  />
                  <FieldErr name="date" />
                </div>
                <div className="field">
                  <label>
                    <FontAwesomeIcon icon={faClock} className="field-icon" /> Event Time
                  </label>
                  <div className="time-picker-row">
                    <select
                      value={info.timeHour}
                      onChange={(e) => setInfo({ ...info, timeHour: e.target.value })}
                      aria-label="Hour"
                    >
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="time-sep">:</span>
                    <select
                      value={info.timeMinute}
                      onChange={(e) => setInfo({ ...info, timeMinute: e.target.value })}
                      aria-label="Minute"
                    >
                      {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={info.timePeriod}
                      onChange={(e) => setInfo({ ...info, timePeriod: e.target.value as "AM" | "PM" })}
                      aria-label="AM or PM"
                      className="time-period-select"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {info.eventMode === "online" ? (
                <div className="field">
                  <label htmlFor="w-online-url">
                    <FontAwesomeIcon icon={faGlobe} className="field-icon" /> Online Event Link / Meeting URL{" "}
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="w-online-url"
                    type="url"
                    value={info.onlineUrl}
                    onChange={(e) => setInfo({ ...info, onlineUrl: e.target.value })}
                    placeholder="https://meet.google.com/xyz-abc or Zoom link"
                    className={stepErrors.onlineUrl ? "input-error" : ""}
                  />
                  <FieldErr name="onlineUrl" />
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="w-venue">
                    <FontAwesomeIcon icon={faMapPin} className="field-icon" /> Venue Location{" "}
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="w-venue"
                    value={info.venue}
                    onChange={(e) => setInfo({ ...info, venue: e.target.value })}
                    placeholder="e.g. Auditorium Hall B, SRM Trichy Campus"
                    className={stepErrors.venue ? "input-error" : ""}
                  />
                  <FieldErr name="venue" />
                </div>
              )}
            </div>

            {/* Group 4: Capacity & Seats */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faUsers} /> Capacity &amp; Registration Limit
              </div>
              <div className="field">
                <label htmlFor="w-capacity">
                  Total Available Seats <span className="required-star">*</span>
                </label>
                <input
                  id="w-capacity"
                  type="number"
                  min="1"
                  placeholder="e.g. 250"
                  value={info.capacity === 0 ? "" : info.capacity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInfo({ ...info, capacity: val === "" ? 0 : Number(val) });
                  }}
                  className={stepErrors.capacity ? "input-error" : ""}
                />
                <FieldErr name="capacity" />
                <div className="hint">Maximum number of attendees allowed to register.</div>
              </div>
            </div>

            {/* Group 5: Description */}
            <div className="wizard-section">
              <div className="wizard-section-title" style={{ justifyContent: "space-between" }}>
                <span>
                  <FontAwesomeIcon icon={faAlignLeft} /> About &amp; Description
                </span>
                <span className="hint" style={{ fontSize: "0.75rem", fontWeight: 400 }}>
                  {info.description.length} chars
                </span>
              </div>
              <div className="field">
                <textarea
                  id="w-description"
                  rows={4}
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                  placeholder="Tell attendees what to expect — highlights, schedule details, guidelines, and who should attend."
                />
              </div>
            </div>

            <div className="wizard-foot">
              <span />
              <button className="btn btn-accent" type="submit" disabled={saving || uploadingBanner}>
                {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null} Continue to Agenda &amp; Media{" "}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </form>
        ) : null}

        {/* ── Step 2: Agenda, Details & Media (cover + banners merged in) ──────── */}
        {step === 2 && event ? (
          <form onSubmit={submitDetails} noValidate className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 2 of 4</div>
              <h3>Agenda, Details &amp; Media</h3>
              <p className="hint">Set publication status, agenda, visibility, and upload your event cover &amp; banner images.</p>
            </div>

            {/* ── Publication Status ──────────────────── */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faGlobe} /> Publication Status
              </div>
              <div className="field">
                <label htmlFor="w-status">Status</label>
                <select
                  id="w-status"
                  value={details.status}
                  onChange={(e) => setDetails({ ...details, status: e.target.value as EventStatus })}
                >
                  <option value="draft">📝 Draft — not visible to the public</option>
                  <option value="published">✅ Published — open for registrations</option>
                  <option value="sold-out">🔴 Sold Out — no more seats available</option>
                </select>
              </div>
            </div>

            {/* ── Agenda ──────────────────────────────── */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faListCheck} /> Agenda &amp; Program Schedule
              </div>
              <div className="field">
                <textarea
                  id="w-agenda"
                  rows={6}
                  value={details.agenda}
                  onChange={(e) => setDetails({ ...details, agenda: e.target.value })}
                  placeholder={"09:00 AM – Registration & Welcome\n10:00 AM – Keynote Address\n11:30 AM – Panel Session\n01:00 PM – Networking Lunch\n02:30 PM – Interactive Workshop"}
                />
                <div className="hint">One item per line. These will be formatted on the public event page.</div>
              </div>
            </div>

            {/* ── Cover & Banners ─────────────────────── */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faImage} /> Cover &amp; Banner Images
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                Upload cover photos. The <strong>first image</strong> is used as the default slide. Click{" "}
                <strong>Set as Default</strong> on any thumbnail to make it the primary banner.
              </p>

              <div className="banner-thumb-grid">
                {(event.banners || []).map((url, idx) => (
                  <div key={url} className={`banner-thumb-item ${idx === 0 ? "banner-thumb-active" : ""}`}>
                    <img src={bannerSrc(url)} alt={`Banner ${idx + 1}`} />
                    {idx === 0 ? (
                      <span className="banner-default-badge">⭐ Default</span>
                    ) : (
                      <button
                        type="button"
                        className="banner-set-default-btn"
                        onClick={() => setDefaultSlide(url)}
                        title="Set as default slide"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      className="banner-remove-btn"
                      onClick={() => handleRemoveBanner(url)}
                      title="Remove photo"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}

                {/* Compact Add Image Card with "+" matching slide preview card size */}
                <div
                  className={`banner-thumb-add ${bannerDragActive ? "drag-active" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setBannerDragActive(true);
                  }}
                  onDragLeave={() => setBannerDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setBannerDragActive(false);
                    void handleBannerFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload cover / banner image"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <FontAwesomeIcon
                    icon={uploadingBanner ? faSpinner : faPlus}
                    spin={uploadingBanner}
                    className="banner-add-icon"
                  />
                  <span className="banner-add-label">
                    {uploadingBanner ? "Uploading…" : "Add Image"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      void handleBannerFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── Featured Toggle ─────────────────────── */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faStar} /> Feature &amp; Promotion
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={details.featured}
                  onChange={(e) => setDetails({ ...details, featured: e.target.checked })}
                />
                ⭐ Highlight as Featured Event — displayed prominently on the home page and public lists
              </label>
            </div>

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(1)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button className="btn btn-accent" type="submit" disabled={saving || uploadingBanner}>
                {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null} Continue to Registration Form{" "}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </form>
        ) : null}

        {/* ── Step 3: Custom Registration Fields ───────────────────────── */}
        {step === 3 && event ? (
          <div className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 3 of 4</div>
              <h3>Registration Form Fields</h3>
              <p className="hint">
                Customize the attendee questions. Name and Email are always collected automatically.
              </p>
            </div>

            <div className="registration-notice-banner">
              <FontAwesomeIcon icon={faCircleInfo} style={{ color: "var(--accent)", fontSize: 16, flexShrink: 0 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Always Collected:</strong> Full Name and Email Address, Phone Number are automatically collected for every attendee. Add any extra information you need (e.g. Department, Roll No, T-Shirt Size).
              </div>
            </div>

            <div className="reg-builder-grid">
              {/* Left: Fields List + Add New Field */}
              <div className="reg-builder-left">
                <div className="wizard-section">
                  <div className="wizard-section-title">
                    <FontAwesomeIcon icon={faListCheck} /> Custom Fields ({fields.length})
                  </div>
                  <div className="field-builder-list">
                    {fields.map((field, index) => (
                      <div className="field-builder-row" key={field.id}>
                        <div className="grow">
                          <div className="field-name">{field.label}</div>
                          <div className="field-meta">
                            <span className="type-chip">{field.type}</span>
                            {field.required ? "Required" : "Optional"}
                            {field.type === "select" && field.options.length ? ` · ${field.options.join(", ")}` : ""}
                          </div>
                        </div>
                        <div className="field-builder-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => moveField(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                          >
                            <FontAwesomeIcon icon={faArrowUp} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => moveField(index, 1)}
                            disabled={index === fields.length - 1}
                            aria-label="Move down"
                          >
                            <FontAwesomeIcon icon={faArrowDown} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => toggleFieldRequired(field)}
                            aria-label="Toggle required"
                          >
                            {field.required ? "Req" : "Opt"}
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => deleteField(field)}
                            aria-label="Delete field"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!fields.length ? (
                      <div
                        className="hint"
                        style={{
                          padding: "16px",
                          border: "1px dashed var(--border-strong)",
                          borderRadius: 12,
                          textAlign: "center",
                        }}
                      >
                        No custom fields yet. The default Name &amp; Email are sufficient for most events.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="add-field-card">
                  <div className="wizard-section-title" style={{ marginBottom: 14 }}>
                    <FontAwesomeIcon icon={faPlus} /> Add Custom Field
                  </div>
                  <form onSubmit={addField} noValidate>
                    <div className="wizard-field-row ratio-2-1">
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="nf-label">Field Label</label>
                        <input
                          id="nf-label"
                          value={newField.label}
                          onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                          placeholder="e.g. Student Register Number"
                        />
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="nf-type">Type</label>
                        <select
                          id="nf-type"
                          value={newField.type}
                          onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {newField.type === "select" || newField.type === "radio" ? (
                      <div className="field" style={{ marginTop: 10 }}>
                        <label htmlFor="nf-options">
                          {newField.type === "radio" ? "Radio" : "Dropdown"} Options (comma-separated)
                        </label>
                        <input
                          id="nf-options"
                          value={newField.options}
                          onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                          placeholder="e.g. 1st Year, 2nd Year, 3rd Year, 4th Year"
                        />
                      </div>
                    ) : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
                      <label className="check-row" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={newField.required}
                          onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                        />
                        Required field
                      </label>
                      <button className="btn btn-accent btn-sm" type="submit" disabled={savingField}>
                        <FontAwesomeIcon icon={savingField ? faSpinner : faPlus} spin={savingField} /> Add Field
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="reg-builder-right">
                <div className="reg-preview-header">
                  <span className="panel-kicker" style={{ margin: 0, fontSize: 11 }}>Live Form Preview</span>
                  <span className="badge" style={{ fontSize: 10 }}>Attendee View</span>
                </div>
                <div className="preview-form-box" style={{ opacity: 0.95, pointerEvents: "none" }}>
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label style={{ fontSize: 12 }}>Full Name *</label>
                    <input readOnly placeholder="e.g. Priya Sharma" style={{ padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label style={{ fontSize: 12 }}>Email Address *</label>
                    <input readOnly placeholder="priya@example.com" style={{ padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label style={{ fontSize: 12 }}>Mobile Number *</label>
                    <input readOnly placeholder="e.g. 9876543210" style={{ padding: "8px 12px", fontSize: 13 }} />
                  </div>

                  {fields.map((f) => (
                    <div className="field" style={{ margin: "0 0 10px" }} key={f.id}>
                      <label style={{ fontSize: 12 }}>
                        {f.label} {f.required ? "*" : "(Optional)"}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea readOnly placeholder={`Enter ${f.label.toLowerCase()}`} rows={2} style={{ padding: "8px 12px", fontSize: 13 }} />
                      ) : f.type === "select" ? (
                        <select disabled style={{ padding: "8px 12px", fontSize: 13 }}>
                          <option>Select {f.label}…</option>
                          {f.options.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : f.type === "radio" ? (
                        <div className="preview-choice-list">
                          {f.options.map((opt) => (
                            <label key={opt}>
                              <input type="radio" disabled name={`preview-${f.id}`} /> {opt}
                            </label>
                          ))}
                        </div>
                      ) : f.type === "checkbox" ? (
                        <label>
                          <input type="checkbox" disabled /> {f.label}
                        </label>
                      ) : (
                        <input
                          readOnly
                          type={f.type === "email" ? "email" : f.type === "number" ? "number" : "text"}
                          placeholder={`Enter ${f.label.toLowerCase()}`}
                          style={{ padding: "8px 12px", fontSize: 13 }}
                        />
                      )}
                    </div>
                  ))}

                  <button className="btn btn-accent btn-sm" style={{ width: "100%", marginTop: 12 }} disabled>
                    {info.eventType === "free" ? "Register for Free" : `Pay & Register (${formatCurrency(info.price)})`}
                  </button>
                </div>
              </div>
            </div>

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(2)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button className="btn btn-accent" type="button" onClick={finishFields}>
                Continue to Review <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        ) : null}

        {/* ── Step 4: Review & Publish ─────────────────────────── */}
        {step === 4 && event ? (
          <div className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 4 of 4</div>
              <h3>Review &amp; Publish</h3>
              <p className="hint">Review your complete event configuration before publishing to attendees.</p>
            </div>

            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faListCheck} /> Event Summary
              </div>
              <div className="detail-grid" style={{ marginTop: 8 }}>
                <div className="detail-card">
                  <div className="label">Title</div>
                  <strong>{info.title}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Format &amp; Mode</div>
                  <strong>{info.eventMode === "online" ? "🌐 Online Event" : "📍 In-Person Event"}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Pricing Model</div>
                  <strong>{info.eventType === "free" ? "🎉 Free Event" : `💳 Paid Event · ${formatCurrency(info.price)}`}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Date &amp; Time</div>
                  <strong>
                    {info.date || "TBD"} · {info.timeHour}:{info.timeMinute} {info.timePeriod}
                  </strong>
                </div>
                <div className="detail-card">
                  <div className="label">{info.eventMode === "online" ? "Meeting URL" : "Venue"}</div>
                  <strong>{info.eventMode === "online" ? (info.onlineUrl || "—") : (info.venue || "—")}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Capacity</div>
                  <strong>{info.capacity} seats</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Registration Fields</div>
                  <strong>{fields.length} custom field{fields.length !== 1 ? "s" : ""}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Booked Seats</div>
                  <strong>{event.attendees}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Status</div>
                  <strong style={{ textTransform: "capitalize" }}>{details.status}</strong>
                </div>
              </div>
            </div>

            {event.slug ? (
              <div className="wizard-section">
                <div className="wizard-section-title">
                  <FontAwesomeIcon icon={faGlobe} /> Public Booking Link
                </div>
                <div className="share-url-box">
                  <span style={{ flex: 1, wordBreak: "break-all" }}>{getEventLinkAbsolute(event)}</span>
                  <button type="button" className="icon-btn" onClick={copyShareLink} aria-label="Copy link">
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                </div>
                <div className="hint" style={{ marginTop: 6 }}>
                  Share this link with attendees. Free registrations require no payment.
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => router.push(`/dashboard/events/${event.id}/attendees`)}
                >
                  <FontAwesomeIcon icon={faUsers} /> View attendees ({event.attendees})
                </button>
              </div>
            ) : (
              <div className="hint" style={{ margin: "12px 0" }}>
                Publishing generates a live booking URL for attendees to register.
              </div>
            )}

            <EventDashboardSummary eventId={event.id} />
            {event.isOwner !== false && <SharedMembersPanel eventId={event.id} isFree={info.eventType === "free" || info.price <= 0} onToast={onToast} />}

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(3)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <div className="btn-row">
                <button className="btn btn-ghost" type="button" onClick={() => router.push("/dashboard/events")}>
                  Save &amp; exit
                </button>
                <button hidden={event.isOwner === false} className="btn btn-danger-outline" type="button" onClick={handleDelete}>
                  Delete event
                </button>
                <button className="btn btn-accent" type="button" onClick={publish} disabled={saving || uploadingBanner}>
                  {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null}{" "}
                  {event.slug ? "Save changes" : details.status === "draft" ? "Save draft & generate link" : "Publish & generate link"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
