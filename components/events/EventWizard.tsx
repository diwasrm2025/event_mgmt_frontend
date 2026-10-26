"use client";
import { EventStatusBadge } from "@/components/ui/EventStatusBadge";
import { ProgressLoader } from "@/components/ui/ProgressLoader";
import Link from "next/link";
import { downloadQr } from "@/lib/qr";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Swal } from "@/lib/swal";
import {
  faArrowLeft,
  faArrowRight,
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
  faGripVertical,
  faPen,
  faArrowUp,
  faArrowDown,
  faRotateRight,
  faXmark,
  faFont,
  faEnvelope,
  faPhone,
  faHashtag,
  faCircleDot,
  faSquareCheck,
  faChevronDown,
  faT,
  faToggleOn,
  faToggleOff,
} from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isDobField, isAgeField, calculateAgeWithMonths, pairDobAndAgeFields } from "@/lib/registration";
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
    label: "Shared Access",
    icon: faUsers,
    desc: "Share access and manage your team",
  },
  {
    id: 5,
    label: "Event Summary",
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

// Icon for each field type shown on the field card
const fieldTypeIconMap = {
  text:     faFont,
  textarea: faAlignLeft,
  email:    faEnvelope,
  phone:    faPhone,
  number:   faHashtag,
  date:     faCalendarDays,
  select:   faChevronDown,
  checkbox: faSquareCheck,
  radio:    faCircleDot,
} as const;
function getFieldTypeIcon(type: string) {
  return (fieldTypeIconMap as Record<string, typeof faFont>)[type] ?? faT;
}

type InfoForm = {
  title: string;
  category: EventCategory;
  description: string;
  date: string;
  registrationDeadline: string;
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
  const [savingField, setSavingField] = useState(false);

  const [info, setInfo] = useState<InfoForm>({
    title: "",
    category: "Music",
    description: "",
    date: "",
    registrationDeadline: "",
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
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
    options: string;
  } | null>(null);
  const [updatingField, setUpdatingField] = useState(false);
  const [previewResponses, setPreviewResponses] = useState<Record<string, any>>({});
  const pairedPreviewFields = useMemo(() => pairDobAndAgeFields(fields), [fields]);

  const hydrateFromEvent = useCallback((loaded: EventItem) => {
    setEvent(loaded);
    const tParts = parse24HrTime(loaded.time || "");
    const evtType: EventType = loaded.eventType ?? (loaded.price > 0 ? "paid" : "free");
    setInfo({
      title: loaded.title,
      category: loaded.category,
      description: loaded.description,
      date: loaded.date,
      registrationDeadline: loaded.registrationDeadline ? new Date(new Date(loaded.registrationDeadline).getTime() - new Date(loaded.registrationDeadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
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
    setMaxStepReached((current) => Math.max(current, loaded.slug ? 5 : Math.min(loaded.wizardStep || 1, 5)));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      try {
        const loaded = await getEvent(eventId);
        if (loaded) {
          hydrateFromEvent(loaded);
          setStep(loaded.slug ? 5 : Math.min(loaded.wizardStep || 1, 5));
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

  const goToStep = async (target: number) => {
    if (saving || uploadingBanner || savingField || target === step) return;
    if (!eventId) {
      if (target > maxStepReached) return;
      if (target > step && (step === 1 || step === 2)) {
        setError("Save this step using Continue before moving forward.");
        return;
      }
    } else {
      const errors = validateStep1();
      if (Object.keys(errors).length) {
        setStep(1);
        setStepErrors(errors);
        setError("Complete the required event information before switching steps.");
        return;
      }
      if (step === 1) { await submitInfo(undefined, target); return; }
      if (step === 2) { await submitDetails(undefined, target); return; }
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
    if (!info.category.trim()) errs.category = "Select or enter a category.";
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

  const submitInfo = async (formEvent?: FormEvent, target = 2) => {
    formEvent?.preventDefault();
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
        registrationDeadline: info.registrationDeadline ? new Date(info.registrationDeadline).toISOString() : null,
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
      advance(target);
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
        if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
          onToast(`Skipped ${file.name}: choose an image up to 5 MB.`);
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

  const submitDetails = async (formEvent?: FormEvent, target = 3) => {
    formEvent?.preventDefault();
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
      advance(target);
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
    const options = [...new Set(newField.options.split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean))];
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
        options: ["select", "radio", "checkbox"].includes(newField.type) ? options : [],
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

  const reorderFields = async (draggedId: string, targetId: string) => {
    if (!event || draggedId === targetId) return;
    const previous = fields;
    const from = previous.findIndex((field) => field.id === draggedId);
    const to = previous.findIndex((field) => field.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...previous];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFields(next);
    try {
      const reordered = await reorderEventFields(
        event.id,
        next.map((f) => f.id),
      );
      setFields(reordered);
    } catch {
      setFields(previous);
      onToast("Could not reorder fields.");
    }
  };

  const openEditFieldModal = (field: EventFormFieldItem) => {
    setEditingField({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options.join("\n"),
    });
  };

  const handleSaveEditField = async (e: FormEvent) => {
    e.preventDefault();
    if (!event || !editingField) return;
    if (!editingField.label.trim()) {
      onToast("Give the field a label.");
      return;
    }
    const options = [...new Set(editingField.options.split(/\r?\n|,/).map((o) => o.trim()).filter(Boolean))];
    if (["select", "radio"].includes(editingField.type) && options.length < 2) {
      onToast("Add at least two distinct choices for this field.");
      return;
    }
    setUpdatingField(true);
    try {
      const updated = await updateEventField(event.id, editingField.id, {
        label: editingField.label.trim(),
        type: editingField.type,
        required: editingField.required,
        options: ["select", "radio", "checkbox"].includes(editingField.type) ? options : [],
      });
      setFields((current) => current.map((f) => (f.id === editingField.id ? updated : f)));
      setEditingField(null);
      onToast("Custom field updated successfully.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not update that field.");
    } finally {
      setUpdatingField(false);
    }
  };

  const moveField = async (index: number, direction: "up" | "down") => {
    if (!event) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const reordered = [...fields];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setFields(reordered);
    try {
      const serverReordered = await reorderEventFields(
        event.id,
        reordered.map((f) => f.id)
      );
      setFields(serverReordered);
    } catch {
      setFields(fields);
      onToast("Could not reorder fields.");
    }
  };

  const handlePreviewChange = (fieldName: string, value: any, fieldType: string) => {
    setPreviewResponses((prev) => {
      const next = { ...prev, [fieldName]: value };
      const pairedAgeName = pairedPreviewFields.dobToAge[fieldName];
      if (pairedAgeName && fieldType === "date") {
        const calcAge = calculateAgeWithMonths(value);
        next[pairedAgeName] = calcAge ?? "";
      }
      return next;
    });
  };

  const editFieldOptions = async (field: EventFormFieldItem) => {
    const decision = await Swal.fire({
      title: `Edit ${field.type === "checkbox" ? "checkbox" : field.type === "radio" ? "radio" : "dropdown"} choices`,
      input: "textarea",
      inputValue: field.options.join("\n"),
      inputPlaceholder: "One choice per line",
      showCancelButton: true,
    });
    if (!decision.isConfirmed) return;
    const options = [...new Set(String(decision.value ?? "").split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean))];
    if ((field.type === "select" || field.type === "radio") && options.length < 2) {
      onToast("Add at least two distinct choices for this field.");
      return;
    }
    try {
      const updated = await updateEventField(event!.id, field.id, { options });
      setFields((current) => current.map((item) => item.id === field.id ? updated : item));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not update choices.");
    }
  };

  const saveProgress = async (target: number) => {
    if (!event || saving) return;
    setSaving(true);
    setError("");
    try {
      await updateEvent(event.id, { wizardStep: Math.max(event.wizardStep || 1, target) });
      setEvent(current => current ? { ...current, wizardStep: Math.max(current.wizardStep || 1, target) } : current);
      advance(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your progress.");
    } finally { setSaving(false); }
  };

  const finishFields = () => { void saveProgress(4); };

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
      <div className="wizard-loading"><ProgressLoader label="Loading event" />
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
              const isLocked = (!eventId && item.id > maxStepReached) || saving || uploadingBanner || savingField;
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
              <EventStatusBadge event={{ ...event, status: details.status }} />
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

        {/* ── Step 1: Event Info, Format & Pricing ─────────────────────────────── */}
        {step === 1 ? (
          <form onSubmit={submitInfo} noValidate className="wizard-form">
            <div className="field"><label htmlFor="registration-deadline">Registration closure date and time (your local time)</label><input id="registration-deadline" type="datetime-local" value={info.registrationDeadline} onChange={e => setInfo({ ...info, registrationDeadline: e.target.value })} /><p className="hint">Leave empty for no deadline. Applies to free and paid events.</p></div>
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 1 of 5</div>
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
                  <label htmlFor="w-category">Category</label>
                  <input id="w-category" list="event-category-options" value={info.category} maxLength={100} required placeholder="Select or type a category" onChange={e => setInfo({ ...info, category: e.target.value })} />
                  <datalist id="event-category-options">{["Music", "Conference", "Workshop", "Sports", "Festival", "Community"].map(category => <option key={category} value={category} />)}</datalist>
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
              <div className="wizard-step-badge-pill">Step 2 of 5</div>
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
              <div className="wizard-step-badge-pill">Step 3 of 5</div>
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
                    {fields.map((field, idx) => {
                      const isReq = field.required;
                      return (
                        <div
                          className={`field-card ${draggedFieldId === field.id ? "dragging" : ""} ${dragOverFieldId === field.id ? "drag-over" : ""}`}
                          key={field.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedFieldId(field.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", field.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverFieldId !== field.id) setDragOverFieldId(field.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverFieldId === field.id) setDragOverFieldId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData("text/plain") || draggedFieldId;
                            if (draggedId) void reorderFields(draggedId, field.id);
                            setDraggedFieldId(null);
                            setDragOverFieldId(null);
                          }}
                          onDragEnd={() => {
                            setDraggedFieldId(null);
                            setDragOverFieldId(null);
                          }}
                        >
                          {/* Drag + reorder column */}
                          <div className="field-card-drag-col">
                            <span className="field-drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
                              <FontAwesomeIcon icon={faGripVertical} />
                            </span>
                            <button
                              type="button"
                              className="field-reorder-btn"
                              disabled={idx === 0}
                              onClick={() => moveField(idx, "up")}
                              title="Move up"
                              aria-label="Move up"
                            >
                              <FontAwesomeIcon icon={faArrowUp} />
                            </button>
                            <button
                              type="button"
                              className="field-reorder-btn"
                              disabled={idx === fields.length - 1}
                              onClick={() => moveField(idx, "down")}
                              title="Move down"
                              aria-label="Move down"
                            >
                              <FontAwesomeIcon icon={faArrowDown} />
                            </button>
                          </div>

                          {/* Type icon badge */}
                          <div className="field-card-icon-badge">
                            <FontAwesomeIcon icon={getFieldTypeIcon(field.type)} />
                          </div>

                          {/* Main content */}
                          <div className="field-card-body">
                            <div className="field-card-label">{field.label}</div>
                            <div className="field-card-chips">
                              <span className="field-type-chip">
                                {FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}
                              </span>
                              {field.options.length > 0 && (
                                <span className="field-options-chip">
                                  {field.options.slice(0, 3).join(" · ")}{field.options.length > 3 ? ` +${field.options.length - 3}` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Required toggle + actions */}
                          <div className="field-card-controls">
                            {/* Toggle switch for required */}
                            <button
                              type="button"
                              className={`field-required-toggle ${isReq ? "is-required" : "is-optional"}`}
                              onClick={() => toggleFieldRequired(field)}
                              title={isReq ? "Click to make optional" : "Click to make required"}
                              aria-pressed={isReq}
                            >
                              <span className="frt-track">
                                <span className="frt-thumb" />
                              </span>
                              <span className="frt-label">
                                {isReq ? (
                                  <><FontAwesomeIcon icon={faCheck} /> Required</>
                                ) : (
                                  <><span className="frt-q">?</span> Optional</>
                                )}
                              </span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-ghost btn-sm field-card-edit-btn"
                              onClick={() => openEditFieldModal(field)}
                              title="Edit field"
                            >
                              <FontAwesomeIcon icon={faPen} /> Edit
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => deleteField(field)}
                              aria-label="Delete field"
                              title="Delete field"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!fields.length ? (
                      <div className="field-empty-state">
                        <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 28, opacity: 0.35 }} />
                        <span>No custom fields yet.<br />Name, Email &amp; Phone are always collected.</span>
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
                          placeholder="e.g. Date of Birth"
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
                    {["select", "radio", "checkbox"].includes(newField.type) ? (
                      <div className="field" style={{ marginTop: 10 }}>
                        <label htmlFor="nf-options">
                          {newField.type === "checkbox" ? "Checkbox" : newField.type === "radio" ? "Radio" : "Dropdown"} Choices (one per line or comma-separated)
                        </label>
                        <input
                          id="nf-options"
                          value={newField.options}
                          onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                          placeholder="e.g. Vegetarian, Vegan, Gluten-free"
                        />
                      </div>
                    ) : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                      {/* Required toggle for Add Field form */}
                      <button
                        type="button"
                        className={`field-required-toggle ${newField.required ? "is-required" : "is-optional"}`}
                        onClick={() => setNewField({ ...newField, required: !newField.required })}
                        title={newField.required ? "Click to make optional" : "Click to make required"}
                        aria-pressed={newField.required}
                      >
                        <span className="frt-track">
                          <span className="frt-thumb" />
                        </span>
                        <span className="frt-label">
                          {newField.required ? (
                            <><FontAwesomeIcon icon={faCheck} /> Required</>
                          ) : (
                            <><span className="frt-q">?</span> Optional</>
                          )}
                        </span>
                      </button>
                      <button className="btn btn-accent btn-sm" type="submit" disabled={savingField}>
                        <FontAwesomeIcon icon={savingField ? faSpinner : faPlus} spin={savingField} /> Add Field
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right: Interactive Live Preview */}
              <div className="reg-builder-right">
                <div className="reg-preview-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span className="panel-kicker" style={{ margin: 0, fontSize: 11 }}>Live Form Preview</span>
                    <span className="badge" style={{ fontSize: 10, marginLeft: 6 }}>Attendee View</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "3px 8px", fontSize: 11, gap: 4 }}
                    onClick={() => setPreviewResponses({})}
                    title="Clear test inputs in preview"
                  >
                    <FontAwesomeIcon icon={faRotateRight} /> Reset preview
                  </button>
                </div>

                <div className="preview-form-box" style={{ opacity: 1 }}>
                  <div className="field" style={{ margin: "0 0 12px" }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Full Name *</label>
                    <input
                      value={previewResponses["name"] ?? ""}
                      onChange={(e) => setPreviewResponses((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Priya Sharma"
                      style={{ padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                  <div className="field" style={{ margin: "0 0 12px" }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Email Address *</label>
                    <input
                      type="email"
                      value={previewResponses["email"] ?? ""}
                      onChange={(e) => setPreviewResponses((p) => ({ ...p, email: e.target.value }))}
                      placeholder="priya@example.com"
                      style={{ padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                  <div className="field" style={{ margin: "0 0 12px" }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Mobile Number *</label>
                    <input
                      type="tel"
                      value={previewResponses["phone"] ?? ""}
                      onChange={(e) => setPreviewResponses((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      style={{ padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>

                  {fields.map((f) => {
                    const isPairedAge = Boolean(pairedPreviewFields.ageToDob[f.name]);
                    const val = previewResponses[f.name];

                    return (
                      <div className="field" style={{ margin: "0 0 14px" }} key={f.id}>
                        <label style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                          <span>
                            {f.label} {f.required ? <span className="required-star">*</span> : <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(Optional)</span>}
                          </span>
                          {isPairedAge ? (
                            <span className="autofill-badge">Autofilled from DOB</span>
                          ) : null}
                        </label>

                        {f.type === "textarea" ? (
                          <textarea
                            value={String(val ?? "")}
                            onChange={(e) => handlePreviewChange(f.name, e.target.value, f.type)}
                            placeholder={`Enter ${f.label.toLowerCase()}`}
                            rows={2}
                            style={{ padding: "8px 12px", fontSize: 13 }}
                          />
                        ) : f.type === "select" ? (
                          <select
                            value={String(val ?? "")}
                            onChange={(e) => handlePreviewChange(f.name, e.target.value, f.type)}
                            style={{ padding: "8px 12px", fontSize: 13 }}
                          >
                            <option value="">Select {f.label}…</option>
                            {f.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "radio" ? (
                          <div className="choice-options-list">
                            {f.options.map((opt) => {
                              const isChecked = val === opt;
                              return (
                                <label key={opt} className={`choice-option-row ${isChecked ? "is-selected" : ""}`}>
                                  <input
                                    type="radio"
                                    name={`preview-${f.id}`}
                                    value={opt}
                                    checked={isChecked}
                                    onChange={() => handlePreviewChange(f.name, opt, f.type)}
                                    className="choice-native-input"
                                  />
                                  <span className="choice-label-text">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : f.type === "checkbox" ? (
                          f.options.length ? (
                            <div className="choice-options-list">
                              {f.options.map((opt) => {
                                const arr = Array.isArray(val) ? val : [];
                                const isChecked = arr.includes(opt);
                                return (
                                  <label key={opt} className={`choice-option-row ${isChecked ? "is-selected" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) =>
                                        handlePreviewChange(
                                          f.name,
                                          e.target.checked ? [...arr, opt] : arr.filter((x) => x !== opt),
                                          f.type
                                        )
                                      }
                                      className="choice-native-input"
                                    />
                                    <span className="choice-label-text">{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <label className={`choice-option-row single-checkbox ${val === true ? "is-selected" : ""}`}>
                              <input
                                type="checkbox"
                                checked={val === true}
                                onChange={(e) => handlePreviewChange(f.name, e.target.checked, f.type)}
                                className="choice-native-input"
                              />
                              <span className="choice-label-text">{f.label}</span>
                            </label>
                          )
                        ) : isPairedAge ? (
                          <input
                            readOnly
                            type="text"
                            value={String(val ?? "")}
                            placeholder="Auto-calculated (Years.Months)"
                            className="readonly-autofilled-input"
                            style={{ padding: "8px 12px", fontSize: 13 }}
                          />
                        ) : (
                          <input
                            type={f.type === "phone" ? "tel" : f.type}
                            value={String(val ?? "")}
                            onChange={(e) => handlePreviewChange(f.name, e.target.value, f.type)}
                            placeholder={`Enter ${f.label.toLowerCase()}`}
                            style={{ padding: "8px 12px", fontSize: 13 }}
                          />
                        )}
                      </div>
                    );
                  })}

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
                Continue to Shared Access <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>

            {/* Custom Field Edit Popup Modal */}
            {editingField ? (
              <div className="custom-field-modal-backdrop" onClick={() => !updatingField && setEditingField(null)}>
                <div className="custom-field-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="custom-field-modal-header">
                    <h3>Edit Custom Field</h3>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => !updatingField && setEditingField(null)}
                      aria-label="Close modal"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditField} noValidate>
                    <div className="field">
                      <label htmlFor="ef-label">Field Label</label>
                      <input
                        id="ef-label"
                        value={editingField.label}
                        onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                        placeholder="e.g. Date of Birth"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor="ef-type">Field Type</label>
                      <select
                        id="ef-type"
                        value={editingField.type}
                        onChange={(e) => setEditingField({ ...editingField, type: e.target.value as FieldType })}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {["select", "radio", "checkbox"].includes(editingField.type) ? (
                      <div className="field" style={{ marginTop: 12 }}>
                        <label htmlFor="ef-options">
                          {editingField.type === "checkbox" ? "Checkbox" : editingField.type === "radio" ? "Radio" : "Dropdown"} Choices (one per line or comma-separated)
                        </label>
                        <textarea
                          id="ef-options"
                          rows={4}
                          value={editingField.options}
                          onChange={(e) => setEditingField({ ...editingField, options: e.target.value })}
                          placeholder="e.g. Option 1&#10;Option 2"
                          style={{ padding: "8px 12px", fontSize: 13, minHeight: 80 }}
                        />
                      </div>
                    ) : null}

                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Visibility</div>
                      <button
                        type="button"
                        className={`field-required-toggle lg ${editingField.required ? "is-required" : "is-optional"}`}
                        onClick={() => setEditingField({ ...editingField, required: !editingField.required })}
                        aria-pressed={editingField.required}
                      >
                        <span className="frt-track">
                          <span className="frt-thumb" />
                        </span>
                        <span className="frt-label">
                          {editingField.required ? (
                            <><FontAwesomeIcon icon={faCheck} /> <strong>Required</strong> — attendees must fill this</>  
                          ) : (
                            <><span className="frt-q">?</span> <strong>Optional</strong> — attendees can skip this</>
                          )}
                        </span>
                      </button>
                    </div>

                    <div className="custom-field-modal-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setEditingField(null)}
                        disabled={updatingField}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-accent"
                        disabled={updatingField}
                      >
                        {updatingField ? <FontAwesomeIcon icon={faSpinner} spin /> : null} Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── Step 4: Review & Publish ─────────────────────────── */}
        {step === 4 && event ? (
          <div className="wizard-form shared-access-step">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 4 of 5</div>
              <h3>Shared Access</h3>
              <p className="hint">Choose who can help manage this event and set their permissions. You can continue without sharing.</p>
            </div>
            {event.isOwner !== false ? (
              <SharedMembersPanel eventId={event.id} isFree={info.eventType === "free" || info.price <= 0} onToast={onToast} />
            ) : <p className="hint">Only the event owner or super admin can manage shared access.</p>}
            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(3)}><FontAwesomeIcon icon={faArrowLeft} /> Back</button>
              <button className="btn btn-accent" type="button" disabled={saving} onClick={() => void saveProgress(5)}>Continue to Event Summary <FontAwesomeIcon icon={faArrowRight} /></button>
            </div>
          </div>
        ) : null}

        {step === 5 && event ? (
          <div className="wizard-form">
            <div className="wizard-form-header">
              <div className="wizard-step-badge-pill">Step 5 of 5</div>
              <h3>Event Summary</h3>
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
                  <EventStatusBadge event={{ ...event, status: details.status }} />
                </div>
              </div>
            </div>

            {event.slug ? (
              <div className="wizard-section">
                <div className="wizard-section-title">
                  <FontAwesomeIcon icon={faGlobe} /> Public Booking Link &amp; Download QR
                </div>
                <div className="share-url-box">
                  <span style={{ flex: 1, wordBreak: "break-all" }}>{getEventLinkAbsolute(event)}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void downloadQr(event.title, getEventLinkAbsolute(event)!).catch(() => onToast("Could not download QR code."))}>Download QR Code</button>
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


            <div className="wizard-foot">
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(4)}>
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
