/* search.js
 * Query parsing, safe regex compiling, filtering, sorting and match
 * highlighting. Nothing in this file touches the DOM.
 */

import { PATTERNS } from './validators.js';

/**
 * Compile user input into a RegExp. A broken pattern returns null instead of
 * throwing, so typing "(" while searching never breaks the page.
 */
export function compileRegex(input, flags = 'i') {
  if (!input) return null;
  try {
    return new RegExp(input, flags);
  } catch (err) {
    return null;
  }
}

/**
 * Split a raw query into an optional "@tag:Name" filter and the rest, which
 * is treated as a regular expression.
 * "@tag:Study lab" -> { tag: 'Study', pattern: 'lab' }
 */
export function parseQuery(raw) {
  const input = String(raw ?? '').trim();
  const tagMatch = input.match(PATTERNS.tagQuery);
  if (tagMatch) {
    return { tag: tagMatch[1], pattern: input.slice(tagMatch[0].length).trim() };
  }
  return { tag: '', pattern: input };
}

/** The fields a search pattern is tested against. */
function searchableFields(record) {
  return [record.title, record.tag, record.dueDate, String(record.duration)];
}

/**
 * Filter records by the raw query string.
 * @returns {{ matches: object[], regex: RegExp|null, tag: string, error: string }}
 *          On an invalid pattern every record is kept and `error` explains why.
 */
export function filterRecords(records, raw, caseInsensitive = true) {
  const { tag, pattern } = parseQuery(raw);
  const flags = caseInsensitive ? 'i' : '';

  let list = records;
  if (tag) {
    list = list.filter((record) => record.tag.toLowerCase() === tag.toLowerCase());
  }

  if (!pattern) {
    return { matches: list, regex: null, tag, error: '' };
  }

  const regex = compileRegex(pattern, flags);
  if (!regex) {
    return {
      matches: list,
      regex: null,
      tag,
      error: `"${pattern}" is not a valid regular expression yet.`
    };
  }

  const matches = list.filter((record) =>
    searchableFields(record).some((field) => regex.test(field))
  );
  return { matches, regex, tag, error: '' };
}

/** Sort a copy of the list. key: title | dueDate | duration | tag. */
export function sortRecords(records, key = 'dueDate', dir = 'asc') {
  const factor = dir === 'desc' ? -1 : 1;

  return [...records].sort((a, b) => {
    let result = 0;

    if (key === 'duration') {
      result = Number(a.duration) - Number(b.duration);
    } else if (key === 'dueDate') {
      result = a.dueDate.localeCompare(b.dueDate);   // ISO dates sort as text
    } else {
      result = String(a[key]).localeCompare(String(b[key]), undefined, { sensitivity: 'base' });
    }

    if (result === 0) result = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    if (result === 0) result = a.id.localeCompare(b.id);
    return result * factor;
  });
}

/** Escape text before it is written with innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

/**
 * Wrap every match in <mark>. The text is escaped first, so a record
 * containing markup can never inject HTML. A pattern that can match an empty
 * string is ignored, because wrapping nothing is meaningless.
 */
export function highlight(text, regex) {
  const safe = escapeHtml(text);
  if (!regex) return safe;

  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const global = new RegExp(regex.source, flags);

  const matchesEmpty = global.test('');
  global.lastIndex = 0;
  if (matchesEmpty) return safe;

  return safe.replace(global, (match) => (match ? `<mark>${match}</mark>` : match));
}
