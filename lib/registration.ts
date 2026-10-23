export function registrationClosed(event: { registrationClosed?: boolean; registrationDeadline?: string | null }, now = Date.now()) { return !!event.registrationClosed || (!!event.registrationDeadline && new Date(event.registrationDeadline).getTime() <= now); }
export function isDobField(field: { type: string; name: string; label: string }) { return field.type === "date" && /(^|[^a-z])(dob|date[ _-]*of[ _-]*birth|birth[ _-]*date)([^a-z]|$)/i.test(field.name + " " + field.label); }
export function ageThisYear(value: unknown, now = new Date()): number | null {
 if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
 const date = new Date(value + "T00:00:00Z");
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > now.toISOString().slice(0,10)) return null;
 return now.getFullYear() - date.getUTCFullYear();
}
