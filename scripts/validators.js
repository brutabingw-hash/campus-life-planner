/* validators.js
 * Every regular expression used for input validation lives here, so the form,
 * the inline row editor, the settings panel and tests.html all check a value
 * the same way. Each validator returns { ok, message }.
 */

export const PATTERNS = {
  /* Rule 1 - no leading or trailing whitespace. */
  title: /^\S(?:.*\S)?$/,

  /* Rule 2 - a whole number, or up to two decimals. */
  number: /^(0|[1-9]\d*)(\.\d{1,2})?$/,

  /* Rule 3 - an ISO calendar date, YYYY-MM-DD. */
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,

  /* Rule 4 - letters separated by single spaces or hyphens. */
  tag: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,

  /* Rule 5 (advanced, back-reference) - the same word twice in a row,
     for example "study study group". \1 repeats whatever group 1 captured. */
  duplicateWord: /\b(\w+)\s+\1\b/i,

  /* Rule 6 (advanced, lookahead) - at least one letter somewhere in the
     string and a total length of 3 to 80 characters, checked without
     consuming any characters. */
  titleShape: /^(?=.*[A-Za-z])(?=.{3,80}$)[\s\S]+$/,

  /* A positive whole number, used for the weekly target. */
  wholeNumber: /^[1-9]\d*$/,

  /* Two or more whitespace characters in a row, collapsed on normalise. */
  doubleSpace: /\s{2,}/g,

  /* Search helpers, also used by search.js. */
  tagQuery: /^@tag:([A-Za-z][A-Za-z-]*)\s*/i,
  timeToken: /\b([01]\d|2[0-3]):[0-5]\d\b/
};

export const MAX_DURATION = 1440;   // minutes in a day
export const MAX_CAP = 10080;       // minutes in a week

/* ---------- small helpers ---------- */

/** Trim the ends and squash runs of whitespace down to one space. */
export function normalizeText(value) {
  return String(value ?? '').trim().replace(PATTERNS.doubleSpace, ' ');
}

/** The date regex allows 2025-02-30, so check the calendar as well. */
export function isRealDate(iso) {
  if (!PATTERNS.date.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y
      && date.getUTCMonth() === m - 1
      && date.getUTCDate() === d;
}

const ok = () => ({ ok: true, message: '' });
const bad = (message) => ({ ok: false, message });

/* ---------- field validators ---------- */

export function validateTitle(raw) {
  const value = String(raw ?? '');
  if (value.trim() === '') return bad('Title is required.');
  if (!PATTERNS.title.test(value)) return bad('Title cannot start or end with a space.');
  if (!PATTERNS.titleShape.test(value)) {
    return bad('Title needs at least one letter and must be 3 to 80 characters long.');
  }
  const repeat = value.match(PATTERNS.duplicateWord);
  if (repeat) return bad(`Remove the repeated word "${repeat[1]}".`);
  return ok();
}

export function validateDuration(raw) {
  const value = String(raw ?? '').trim();
  if (value === '') return bad('Duration is required.');
  if (!PATTERNS.number.test(value)) {
    return bad('Use digits only, with up to two decimals, for example 90 or 7.5.');
  }
  const minutes = Number(value);
  if (minutes === 0) return bad('Duration must be more than 0 minutes.');
  if (minutes > MAX_DURATION) return bad(`Keep a single activity under ${MAX_DURATION} minutes.`);
  return ok();
}

export function validateDate(raw) {
  const value = String(raw ?? '').trim();
  if (value === '') return bad('Due date is required.');
  if (!PATTERNS.date.test(value)) return bad('Use the format YYYY-MM-DD, for example 2025-10-20.');
  if (!isRealDate(value)) return bad('That date does not exist on the calendar.');
  return ok();
}

export function validateTag(raw) {
  const value = normalizeText(raw);
  if (value === '') return bad('Tag is required.');
  if (value.length > 24) return bad('Keep the tag under 25 characters.');
  if (!PATTERNS.tag.test(value)) {
    return bad('Letters only, separated by single spaces or hyphens, for example Group-Work.');
  }
  return ok();
}

export function validateCap(raw) {
  const value = String(raw ?? '').trim();
  if (value === '') return bad('Set a weekly target in minutes.');
  if (!PATTERNS.wholeNumber.test(value)) return bad('Use a whole number above zero.');
  if (Number(value) > MAX_CAP) return bad(`A week only has ${MAX_CAP} minutes.`);
  return ok();
}

export function validateTagList(raw) {
  const parts = String(raw ?? '').split(',').map(normalizeText).filter(Boolean);
  if (parts.length === 0) return bad('Keep at least one tag.');
  const broken = parts.find((part) => !validateTag(part).ok);
  if (broken) return bad(`"${broken}" is not a valid tag name.`);
  return ok();
}

/* ---------- whole-record validation ---------- */

/**
 * Validate the four editable fields of an activity.
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateRecord(input) {
  const checks = {
    title: validateTitle(input.title),
    dueDate: validateDate(input.dueDate),
    duration: validateDuration(input.duration),
    tag: validateTag(input.tag)
  };

  const errors = {};
  for (const [field, result] of Object.entries(checks)) {
    if (!result.ok) errors[field] = result.message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Turn raw form strings into the shape stored in localStorage. */
export function normalizeRecord(input) {
  return {
    title: normalizeText(input.title),
    dueDate: String(input.dueDate ?? '').trim(),
    duration: Number(input.duration),
    tag: normalizeText(input.tag)
  };
}

/**
 * Validate an imported JSON payload before any of it reaches the app.
 * Nothing is accepted unless every record passes.
 * @returns {{ ok: boolean, errors: string[], records: object[] }}
 */
export function validateImport(data) {
  const errors = [];

  if (!Array.isArray(data)) {
    return { ok: false, errors: ['The file must contain a JSON array of activities.'], records: [] };
  }
  if (data.length === 0) {
    return { ok: false, errors: ['The file contains no activities.'], records: [] };
  }

  const records = [];
  const seenIds = new Set();
  const now = new Date().toISOString();

  data.forEach((row, index) => {
    const label = `Record ${index + 1}`;

    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${label} is not an object.`);
      return;
    }

    const id = String(row.id ?? '').trim();
    if (id === '') {
      errors.push(`${label} is missing an id.`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`${label} repeats the id "${id}".`);
      return;
    }

    const { valid, errors: fieldErrors } = validateRecord(row);
    if (!valid) {
      for (const [field, message] of Object.entries(fieldErrors)) {
        errors.push(`${label} (${id}) - ${field}: ${message}`);
      }
      return;
    }

    seenIds.add(id);
    records.push({
      id,
      ...normalizeRecord(row),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : now,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : now
    });
  });

  return { ok: errors.length === 0, errors, records };
}
