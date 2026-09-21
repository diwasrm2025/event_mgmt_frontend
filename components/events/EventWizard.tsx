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
  type EventFormFieldItem,
  type EventItem,
  type EventStatus,
  type FieldType,
} from "@/lib/events";
import { EventBannerSlider } from "./EventBannerSlider";
import { SharedMembersPanel } from "./SharedMembersPanel";
import { EventDashboardSummary } from "./EventDashboardSummary";

const STEPS = [
  {
    id: 1,
    label: "Event format",
    icon: faGlobe,
    desc: "Choose online or in-person",
  },
  {
    id: 2,
    label: "Event Info",
    icon: faTag,
    desc: "Core details — title, category, schedule & venue",
  },
  {
    id: 3,
    label: "Capacity & Banners",
    icon: faImage,
    desc: "Seats, pricing and event cover images",
  },
  {
    id: 4,
    label: "Details",
    icon: faListCheck,
    desc: "Status, agenda & featured visibility",
  },
  {
    id: 5,
    label: "Registration",
    icon: faClipboardList,
    desc: "Custom fields for your booking form",
  },
  {
    id: 6,
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
};

type CapacityForm = {
  capacity: number;
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
  });
  const [capacity, setCapacity] = useState<CapacityForm>({ capacity: 0, price: 0 });
  const [details, setDetails] = useState<DetailsForm>({ status: "draft", featured: false, agenda: "" });

  const [fields, setFields] = useState<EventFormFieldItem[]>([]);
  const [newField, setNewField] = useState<NewFieldForm>(emptyNewField());
  const [savingField, setSavingField] = useState(false);

  const hydrateFromEvent = useCallback((loaded: EventItem) => {
    setEvent(loaded);
    const tParts = parse24HrTime(loaded.time || "");
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
    });
    setCapacity({ capacity: loaded.capacity, price: loaded.price });
    setDetails({ status: loaded.status, featured: loaded.featured, agenda: loaded.agenda.join("\n") });
    setFields((loaded.fields ?? []).slice().sort((a, b) => a.order - b.order));
    setMaxStepReached((current) => Math.max(current, loaded.slug ? 6 : Math.min(loaded.wizardStep || 1, 6)));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      try {
        const loaded = await getEvent(eventId);
        if (loaded) {
          hydrateFromEvent(loaded);
          setStep(loaded.slug ? 6 : Math.min(loaded.wizardStep || 1, 6));
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
    if (target > maxStepReached) return;
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
    if (!info.title.trim()) errs.title = "Event title is required.";
    if (!info.date) errs.date = "Please select an event date.";
    if (info.eventMode === "online" && !info.onlineUrl.trim()) errs.onlineUrl = "Online event link is required.";
    if (info.eventMode === "offline" && !info.venue.trim()) errs.venue = "Venue is required.";
    return errs;
  };

  const submitInfo = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
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
      }
      const time24 = to24HrTime(info.timeHour, info.timeMinute, info.timePeriod);
      const updated = await updateEvent(current.id, {
        title: info.title.trim(),
        category: info.category,
        description: info.description.trim(),
        date: info.date,
        time: time24,
        eventMode: info.eventMode,
        onlineUrl: info.onlineUrl.trim(),
        venue: info.venue.trim(),
        host: info.host.trim() || "Organizer",
        wizardStep: 3,
      });
      if (updated) setEvent(current => ({ ...updated, isOwner: current?.isOwner, sharedPermissions: current?.sharedPermissions }));
      advance(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event info.");
    } finally {
      setSaving(false);
    }
  };

  const validateStep2 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!capacity.capacity || capacity.capacity < 1) errs.capacity = "Capacity must be at least 1.";
    if (capacity.price < 0) errs.price = "Price cannot be negative.";
    return errs;
  };

  const submitCapacity = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event) return;
    const errs = validateStep2();
    if (Object.keys(errs).length) {
      setStepErrors(errs);
      return;
    }
    setStepErrors({});
    setError("");
    setSaving(true);
    try {
      const updated = await updateEvent(event.id, {
        capacity: Number(capacity.capacity),
        price: Number(capacity.price),
        wizardStep: 4,
      });
      if (updated) setEvent(current => ({ ...updated, isOwner: current?.isOwner, sharedPermissions: current?.sharedPermissions }));
      advance(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save capacity.");
    } finally {
      setSaving(false);
    }
  };

  const [bannerDragActive, setBannerDragActive] = useState(false);

  const handleBannerFile = async (file: File | undefined | null) => {
    if (!file || !event) return;
    if (!file.type.startsWith("image/")) {
      onToast("Only image files can be used as banners.");
      return;
    }
    setUploadingBanner(true);
    try {
      const updated = await uploadEventBanner(event.id, file);
      setEvent(current => ({ ...updated, isOwner: current?.isOwner, sharedPermissions: current?.sharedPermissions }));
      onToast("Banner added.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleRemoveBanner = async (url: string) => {
    if (!event) return;
    if (!(await Swal.confirm("Remove this event photo?", "This photo will no longer appear on the event page.", "Remove photo")).isConfirmed) return;
    try {
      const updated = await removeEventBanner(event.id, url);
      setEvent(current => ({ ...updated, isOwner: current?.isOwner, sharedPermissions: current?.sharedPermissions }));
    } catch {
      onToast("Could not remove that banner.");
    }
  };

  const submitDetails = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event) return;
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
        wizardStep: 5,
      });
      if (updated) setEvent(current => ({ ...updated, isOwner: current?.isOwner, sharedPermissions: current?.sharedPermissions }));
      advance(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save these details.");
    } finally {
      setSaving(false);
    }
  };

  const addField = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event) return;
    if (!newField.label.trim()) {
      onToast("Give the field a label.");
      return;
    }
    setSavingField(true);
    try {
      const created = await createEventField(event.id, {
        label: newField.label.trim(),
        type: newField.type,
        required: newField.required,
        options:
          newField.type === "select"
            ? newField.options
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean)
            : [],
      });
      setFields((current) => [...current, created]);
      setNewField(emptyNewField());
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
    } catch {
      onToast("Could not update that field.");
    }
  };

  const deleteField = async (field: EventFormFieldItem) => {
    if (!event) return;
    if (!(await Swal.confirm("Remove this registration field?", field.label, "Remove field")).isConfirmed) return;
    try {
      await removeEventField(event.id, field.id);
      setFields((current) => current.filter((item) => item.id !== field.id));
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
        next.map((field) => field.id),
      );
      setFields(reordered);
    } catch {
      onToast("Could not reorder fields.");
    }
  };

  const finishFields = () => {
    advance(6);
  };

  const publish = async () => {
    if (!event) return;
    setError("");
    setSaving(true);
    try {
      const finalized = await finalizeEvent(event.id, details.status);
      setEvent(finalized);
      onToast(finalized.slug ? "Event published with a live booking link." : "Event saved.");
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
    await navigator.clipboard.writeText(url);
    onToast("Booking link copied.");
  };

  const handleDelete = async () => {
    if (!event) return;
    const res = await Swal.confirm(`Delete "${event.title}"?`, "This event will be permanently deleted.");
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
    return <section className="panel"><div className="panel-body">
      <EventBannerSlider banners={event.banners || []} title={event.title} />
      <h1>{event.title}</h1><p>{event.description}</p>
      <dl><dt>Date</dt><dd>{event.date} {event.time}</dd><dt>Venue</dt><dd>{event.venue || "Online event"}</dd><dt>Host</dt><dd>{event.host}</dd><dt>Registration fee</dt><dd>{event.price}</dd></dl>
      <Link className="btn btn-accent" href={`/dashboard/events/${event.id}/attendees`}>View attendees</Link>
    </div></section>;
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
                  Step {step} of 5
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT CONTENT AREA (70%) ────────────────────────── */}
      <div className="wizard-content">
        <FeedbackNotice message={error} icon="error" />

        {/* ── Step 1: Event Info ─────────────────────────────── */}
        {step === 1 ? (
          <form onSubmit={(formEvent) => { formEvent.preventDefault(); advance(2); }} className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 1 of 6</div>
              <h3>Choose your event format</h3>
              <p className="hint">Start by telling us how attendees will experience this event.</p>
            </div>
            <div className="wizard-section event-mode-section">
              <div className="wizard-section-title"><FontAwesomeIcon icon={faGlobe} /> Event format</div>
              <div className="event-mode-choice-grid">
                <button type="button" className={`event-mode-choice ${info.eventMode === "online" ? "selected" : ""}`} onClick={() => setInfo({ ...info, eventMode: "online" })}>
                  <strong>Online event</strong><span>Attendees join using a meeting link.</span>
                </button>
                <button type="button" className={`event-mode-choice ${info.eventMode === "offline" ? "selected" : ""}`} onClick={() => setInfo({ ...info, eventMode: "offline" })}>
                  <strong>In-person event</strong><span>Attendees arrive at a physical venue.</span>
                </button>
              </div>
            </div>
            <div className="wizard-foot"><span /><button className="btn btn-accent" type="submit">Continue <FontAwesomeIcon icon={faArrowRight} /></button></div>
          </form>
        ) : null}

        {step === 2 ? (
          <form onSubmit={submitInfo} noValidate className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 2 of 6</div>
              <h3>Event Information</h3>
              <p className="hint">Fill in the core details — title, category, date, time and venue.</p>
            </div>

            {/* Basic Info */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faTag} /> Basic Info
              </div>
              <div className="field">
                <label htmlFor="w-title">
                  Event Title <span className="required-star">*</span>
                </label>
                <input
                  id="w-title"
                  value={info.title}
                  onChange={(e) => setInfo({ ...info, title: e.target.value })}
                  placeholder="e.g. Autumn Sound Sessions 2026"
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
                    <FontAwesomeIcon icon={faMicrophone} className="field-icon" /> Host / Organization
                  </label>
                  <input
                    id="w-host"
                    value={info.host}
                    onChange={(e) => setInfo({ ...info, host: e.target.value })}
                    placeholder="e.g. Northline Events Pvt. Ltd."
                  />
                </div>
              </div>
            </div>

            {/* Schedule & Venue */}
            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faCalendarDays} /> Schedule &amp; Venue
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
                      {["01","02","03","04","05","06","07","08","09","10","11","12"].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="time-sep">:</span>
                    <select
                      value={info.timeMinute}
                      onChange={(e) => setInfo({ ...info, timeMinute: e.target.value })}
                      aria-label="Minute"
                    >
                      {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => (
                        <option key={m} value={m}>{m}</option>
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

              {info.eventMode === "online" ? <div className="field">
                <label htmlFor="w-online-url"><FontAwesomeIcon icon={faGlobe} className="field-icon" /> Online event link <span className="required-star">*</span></label>
                <input id="w-online-url" type="url" value={info.onlineUrl} onChange={(e) => setInfo({ ...info, onlineUrl: e.target.value })} placeholder="https://meet.example.com/event" className={stepErrors.onlineUrl ? "input-error" : ""} />
                <FieldErr name="onlineUrl" />
              </div> : <div className="field">
                <label htmlFor="w-venue">
                  <FontAwesomeIcon icon={faMapPin} className="field-icon" /> Venue Location{" "}
                  <span className="required-star">*</span>
                </label>
                <input
                  id="w-venue"
                  value={info.venue}
                  onChange={(e) => setInfo({ ...info, venue: e.target.value })}
                  placeholder="e.g. Riverside Amphitheatre, Downtown Main Stage"
                  className={stepErrors.venue ? "input-error" : ""}
                />
                <FieldErr name="venue" />
              </div>}
            </div>

            {/* Description */}
            <div className="wizard-section">
              <div className="wizard-section-title" style={{ justifyContent: "space-between" }}>
                <span><FontAwesomeIcon icon={faAlignLeft} /> About &amp; Description</span>
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
                  placeholder="Tell attendees what to expect — the key highlights, who it's for, and why they shouldn't miss it."
                />
              </div>
            
            </div>

            <div className="wizard-foot">
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null} Continue{" "}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </form>
        ) : null}

        {/* ── Step 2: Capacity & Banners ─────────────────────── */}
        {step === 3 && event ? (
          <form onSubmit={submitCapacity} noValidate className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 3 of 6</div>
              <h3>Capacity, Pricing &amp; Banners</h3>
              <p className="hint">Set the number of available seats, ticket price, and upload cover imagery.</p>
            </div>

            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faTicket} /> Seats &amp; Pricing
              </div>
              <div className="wizard-field-row">
                <div className="field">
                  <label htmlFor="w-capacity">
                    <FontAwesomeIcon icon={faUsers} className="field-icon" /> Total Seats{" "}
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="w-capacity"
                    type="number"
                    min="1"
                    placeholder="e.g. 500"
                    value={capacity.capacity === 0 ? "" : capacity.capacity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCapacity({ ...capacity, capacity: val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0) });
                    }}
                    className={stepErrors.capacity ? "input-error" : ""}
                  />
                  <FieldErr name="capacity" />
                </div>
                <div className="field">
                  <label htmlFor="w-price">
                    <FontAwesomeIcon icon={faTicket} className="field-icon" /> Ticket Price (₹)
                  </label>
                  <input
                    id="w-price"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0 for free events"
                    value={capacity.price === 0 ? "" : capacity.price}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCapacity({ ...capacity, price: val === "" ? 0 : Math.max(0, parseFloat(val) || 0) });
                    }}
                    className={stepErrors.price ? "input-error" : ""}
                  />
                  <FieldErr name="price" />
                  <div className="hint">Enter 0 for a free event.</div>
                </div>
              </div>
            </div>

            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faImage} /> Banner Images / Slides
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                Add up to 8 images. The first one is used as the main hero banner.
              </p>
              <div className="banner-grid">
                {event.banners.map((url) => (
                  <div className="banner-tile" key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "")}${url}`}
                      alt="Event banner"
                    />
                    <button
                      type="button"
                      className="banner-remove"
                      onClick={() => handleRemoveBanner(url)}
                      aria-label="Remove banner"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
                {event.banners.length < 8 ? (
                  <button
                    type="button"
                    className={`banner-dropzone ${bannerDragActive ? "drag-active" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingBanner}
                    onDragOver={(e) => { e.preventDefault(); setBannerDragActive(true); }}
                    onDragLeave={() => setBannerDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setBannerDragActive(false);
                      void handleBannerFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <FontAwesomeIcon icon={uploadingBanner ? faSpinner : faCloudArrowUp} spin={uploadingBanner} />
                    {uploadingBanner ? "Uploading..." : "Drag & drop, or click to add"}
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void handleBannerFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(2)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null} Continue{" "}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </form>
        ) : null}

        {/* ── Step 3: Details ─────────────────────────────────── */}
        {step === 4 && event ? (
          <form onSubmit={submitDetails} noValidate className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 4 of 6</div>
              <h3>Event Details</h3>
              <p className="hint">Set the current status, schedule agenda items, and visibility settings.</p>
            </div>

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
                  <option value="sold-out">🔴 Sold Out — no more seats</option>
                </select>
              </div>
            </div>

            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faListCheck} /> Agenda / Schedule
              </div>
              <div className="field">
                <textarea
                  id="w-agenda"
                  rows={6}
                  value={details.agenda}
                  onChange={(e) => setDetails({ ...details, agenda: e.target.value })}
                  placeholder={"9:00 AM – Welcome & Registration\n10:00 AM – Keynote Address\n11:30 AM – Panel Discussion\n1:00 PM – Lunch Break\n2:30 PM – Workshops"}
                />
                <div className="hint">One schedule item per line. These appear on the public event page.</div>
              </div>
            </div>

            <div className="wizard-section">
              <div className="wizard-section-title">
                <FontAwesomeIcon icon={faStar} /> Visibility
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={details.featured}
                  onChange={(e) => setDetails({ ...details, featured: e.target.checked })}
                />
                ⭐ Feature this event — display it prominently on the dashboard and public listing
              </label>
            </div>

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(3)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null} Continue{" "}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </form>
        ) : null}

        {/* ── Step 4: Registration Fields ───────────────────────── */}
        {step === 5 && event ? (
          <div className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 5 of 6</div>
              <h3>Registration Form Fields</h3>
              <p className="hint">Build the form guests fill out to book a seat.</p>
            </div>

            <div className="registration-notice-banner">
              <FontAwesomeIcon icon={faCircleInfo} style={{ color: "var(--accent)", fontSize: 16, flexShrink: 0 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Default Fields Already Included:</strong> Full Name, Mobile Number and Email Address are automatically collected for every booking. Only add <em>extra</em> fields your attendees need.
              </div>
            </div>

            <div className="reg-builder-grid">
              {/* Left: Field List + Add Form */}
              <div className="reg-builder-left">
                <div className="wizard-section">
                  <div className="wizard-section-title">
                    <FontAwesomeIcon icon={faListCheck} /> Custom Registration Fields
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
                        No custom fields added yet.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="add-field-card">
                  <div className="wizard-section-title" style={{ marginBottom: 14 }}>
                    <FontAwesomeIcon icon={faPlus} /> Add New Field
                  </div>
                  <form onSubmit={addField} noValidate>
                    <div className="wizard-field-row ratio-2-1">
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="nf-label">Field Label</label>
                        <input
                          id="nf-label"
                          value={newField.label}
                          onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                          placeholder="e.g. T-shirt Size, Company"
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
                        <label htmlFor="nf-options">{newField.type === "radio" ? "Radio" : "Dropdown"} Options (comma-separated)</label>
                        <input
                          id="nf-options"
                          value={newField.options}
                          onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                          placeholder="e.g. Small, Medium, Large, XL"
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
                        Required
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
                  <span className="panel-kicker" style={{ margin: 0, fontSize: 11 }}>Live Preview</span>
                  <span className="badge" style={{ fontSize: 10 }}>Guest Booking Form</span>
                </div>
                <div className="preview-form-box" style={{ opacity: 0.9, pointerEvents: "none" }}>
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label style={{ fontSize: 12 }}>Full Name *</label>
                    <input readOnly placeholder="John Doe" style={{ padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label style={{ fontSize: 12 }}>Mobile Number *</label>
                    <input readOnly placeholder="+91 98765 43210" style={{ padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label style={{ fontSize: 12 }}>Email Address *</label>
                    <input readOnly placeholder="john@example.com" style={{ padding: "8px 12px", fontSize: 13 }} />
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
                          {f.options.map((opt) => <label key={opt}><input type="radio" disabled name={`preview-${f.id}`} /> {opt}</label>)}
                        </div>
                      ) : f.type === "checkbox" ? (
                        <label><input type="checkbox" disabled /> {f.label}</label>
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
                    Complete Booking &amp; Register
                  </button>
                </div>
              </div>
            </div>

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(4)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button className="btn btn-accent" type="button" onClick={finishFields}>
                Continue <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        ) : null}

        {/* ── Step 5: Review & Publish ─────────────────────────── */}
        {step === 6 && event ? (
          <div className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 6 of 6</div>
              <h3>Review &amp; Publish</h3>
              <p className="hint">Everything looks good? Publish your event to go live.</p>
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
                  <div className="label">Date &amp; Time</div>
                  <strong>
                    {info.date || "No date"} · {info.timeHour}:{info.timeMinute} {info.timePeriod}
                  </strong>
                </div>
                <div className="detail-card">
                  <div className="label">Venue</div>
                  <strong>{info.venue || "—"}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Capacity</div>
                  <strong>{capacity.capacity} seats</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Ticket Price</div>
                  <strong>{capacity.price === 0 ? "Free" : formatCurrency(capacity.price)}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Custom Fields</div>
                  <strong>{fields.length} field{fields.length !== 1 ? "s" : ""}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Booked Seats</div>
                  <strong>{event.attendees}</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Fill Rate</div>
                  <strong>{event.capacity ? Math.round((event.attendees / event.capacity) * 100) : 0}%</strong>
                </div>
                <div className="detail-card">
                  <div className="label">Revenue</div>
                  <strong>{formatCurrency(event.attendees * event.price)}</strong>
                </div>
              </div>
            </div>

            {event.slug ? (
              <div className="wizard-section">
                <div className="wizard-section-title">
                  <FontAwesomeIcon icon={faGlobe} /> Public Booking URL
                </div>
                <div className="share-url-box">
                  <span style={{ flex: 1 }}>{getEventLinkAbsolute(event)}</span>
                  <button type="button" className="icon-btn" onClick={copyShareLink} aria-label="Copy link">
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                </div>
                <div className="hint" style={{ marginTop: 6 }}>
                  Guests can book through this link directly, or after signing in.
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
                Publishing generates a unique booking URL like{" "}
                <code>myapp.com/events/{"{slug}"}</code>.
              </div>
            )}

            <EventDashboardSummary eventId={event.id} />
            {event.isOwner !== false && <SharedMembersPanel eventId={event.id} onToast={onToast} />}

            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(5)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <div className="btn-row">
                <button className="btn btn-ghost" type="button" onClick={() => router.push("/dashboard/events")}>
                  Save &amp; exit
                </button>
                <button hidden={event.isOwner === false} className="btn btn-danger-outline" type="button" onClick={handleDelete}>
                  Delete event
                </button>
                <button className="btn btn-accent" type="button" onClick={publish} disabled={saving}>
                  {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : null}{" "}
                  {event.slug ? "Save changes" : "Publish & generate link"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
