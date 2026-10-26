export function registrationClosed(event: { registrationClosed?: boolean; registrationDeadline?: string | null }, now = Date.now()) {
  return !!event.registrationClosed || (!!event.registrationDeadline && new Date(event.registrationDeadline).getTime() <= now);
}

export function isDobField(field: { type: string; name?: string; label?: string }): boolean {
  if (field.type !== "date") return false;
  const text = `${field.name || ""} ${field.label || ""}`.toLowerCase();
  return /(^|[^a-z])(dob|date[ _-]*of[ _-]*birth|birth[ _-]*date)([^a-z]|$)/i.test(text);
}

export function isAgeField(field: { type: string; name?: string; label?: string }): boolean {
  const text = `${field.name || ""} ${field.label || ""}`.toLowerCase();
  // Match standalone "age" or prefixed/suffixed "child age", "father's age", "age in years", etc.
  return /(^|[^a-z])age([^a-z]|$)/i.test(text);
}

/**
 * Calculates completed whole years from DOB.
 */
export function calculateAgeWithMonths(value: unknown, now = new Date()): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dob = new Date(value + "T00:00:00");
  if (!Number.isFinite(dob.getTime())) return null;

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Reject future birthdates
  if (years < 0 || (years === 0 && months < 0)) return null;

  return `${years}`;
}

export function ageThisYear(value: unknown, now = new Date()): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > now.toISOString().slice(0, 10)) return null;
  return now.getFullYear() - date.getUTCFullYear();
}

export function formatRegistrationDeadline(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace("Sept", "Sep");
  return day;
}

/**
 * Pairs DOB date fields with corresponding Age fields.
 * If 1 DOB and 1 Age: pairs directly.
 * If multiple DOBs and multiple Ages: compares labels by stripped contextual qualifiers (e.g. "child", "father", "applicant")
 * or fallback to relative index order.
 */
export function pairDobAndAgeFields(fields: Array<{ id?: string; name: string; label: string; type: string }>) {
  const dobFields = fields.filter((f) => isDobField(f));
  const ageFields = fields.filter((f) => isAgeField(f));

  const dobToAge: Record<string, string> = {}; // dob.name -> age.name
  const ageToDob: Record<string, string> = {}; // age.name -> dob.name

  if (!dobFields.length || !ageFields.length) {
    return { dobToAge, ageToDob };
  }

  const cleanDobQualifier = (label: string) =>
    label
      .toLowerCase()
      .replace(/(^|[^a-z])(dob|date[ _-]*of[ _-]*birth|birth[ _-]*date)([^a-z]|$)/gi, " ")
      .replace(/[^a-z0-9]/g, " ")
      .trim();

  const cleanAgeQualifier = (label: string) =>
    label
      .toLowerCase()
      .replace(/(^|[^a-z])age([^a-z]|$)/gi, " ")
      .replace(/[^a-z0-9]/g, " ")
      .trim();

  const availableAges = [...ageFields];

  for (const dob of dobFields) {
    const dobQualifier = cleanDobQualifier(dob.label);
    let matchedAgeIndex = -1;

    if (dobQualifier) {
      matchedAgeIndex = availableAges.findIndex((age) => {
        const ageQualifier = cleanAgeQualifier(age.label);
        return (
          ageQualifier === dobQualifier ||
          (ageQualifier && (dobQualifier.includes(ageQualifier) || ageQualifier.includes(dobQualifier)))
        );
      });
    }

    if (matchedAgeIndex === -1 && availableAges.length > 0) {
      matchedAgeIndex = 0; // pair first available by index
    }

    if (matchedAgeIndex !== -1) {
      const [matchedAge] = availableAges.splice(matchedAgeIndex, 1);
      dobToAge[dob.name] = matchedAge.name;
      ageToDob[matchedAge.name] = dob.name;
    }
  }

  return { dobToAge, ageToDob };
}
