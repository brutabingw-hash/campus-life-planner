/* storage.js
 * The only file that talks to localStorage. Everything is wrapped in
 * try/catch because storage can be full, disabled (private mode) or hold
 * leftover text that is not valid JSON.
 */

const RECORDS_KEY = 'clp:records';
const SETTINGS_KEY = 'clp:settings';

export const DEFAULT_SETTINGS = {
  cap: 1200,                 // weekly target, in minutes
  unit: 'minutes',           // 'minutes' or 'hours'
  tags: ['Study', 'Class', 'Club', 'Sport', 'Social', 'Admin'],
  theme: 'light'
};

/** Read the saved activities. Returns [] if there is nothing usable. */
export function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Could not read saved activities, starting empty.', err);
    return [];
  }
}

/** Write the activities. Returns true when the write succeeded. */
export function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch (err) {
    console.error('Could not save activities.', err);
    return false;
  }
}

/** Read settings, filling in any key the saved object is missing. */
export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    if (!Array.isArray(merged.tags) || merged.tags.length === 0) {
      merged.tags = [...DEFAULT_SETTINGS.tags];
    }
    if (merged.unit !== 'hours') merged.unit = 'minutes';
    if (merged.theme !== 'dark') merged.theme = 'light';
    if (!Number.isFinite(Number(merged.cap))) merged.cap = DEFAULT_SETTINGS.cap;
    merged.cap = Number(merged.cap);
    return merged;
  } catch (err) {
    console.warn('Could not read settings, using defaults.', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Could not save settings.', err);
    return false;
  }
}

/** Remove the activities but keep the user's preferences. */
export function clearRecords() {
  try {
    localStorage.removeItem(RECORDS_KEY);
    return true;
  } catch (err) {
    console.error('Could not clear activities.', err);
    return false;
  }
}

/* ---------- first-run flag ---------- */

const SEEDED_KEY = 'clp:seeded';

/** True once the sample data has been offered, so it is never forced back. */
export function wasSeeded() {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1';
  } catch (err) {
    return true;
  }
}

export function markSeeded() {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch (err) {
    /* nothing to do: the flag is only a convenience */
  }
}
