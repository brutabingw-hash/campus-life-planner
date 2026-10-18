/* app.js
 * The entry point. It subscribes the renderer to the store and attaches every
 * event listener. Validation rules come from validators.js, rendering from
 * ui.js, so this file only decides what happens when the user does something.
 */

import {
  getState, subscribe, addRecord, updateRecord, deleteRecord,
  replaceRecords, clearAllRecords, setSettings, setSearch, setSort, setEditing
} from './state.js';

import { wasSeeded, markSeeded } from './storage.js';
import { validateRecord, validateTitle, validateDate, validateDuration,
         validateTag, validateCap, validateTagList, validateImport,
         normalizeText } from './validators.js';
import {
  els, render, syncSettingsForm, announce, announceError, clearAnnouncements,
  setFieldError, clearFormErrors, readForm, focusFirstError,
  readRowValues, showRowErrors, applyTheme, FORM_FIELDS
} from './ui.js';

const FIELD_VALIDATORS = {
  title: validateTitle,
  dueDate: validateDate,
  duration: validateDuration,
  tag: validateTag
};

/* ---------- helpers ---------- */

function debounce(fn, wait = 120) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function plural(count, word = 'activity') {
  return `${count} ${count === 1 ? word : 'activities'}`;
}

/* Put the keyboard back on something sensible after a row is saved or removed. */
function focusRowButton(id) {
  const button = els.tbody.querySelector(`button[data-action="edit"][data-id="${id}"]`);
  if (button) {
    button.focus();
    return;
  }
  (els.tbody.querySelector('button[data-action="edit"]') || els.search).focus();
}

/* ---------- add form ---------- */

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearAnnouncements();

  const values = readForm();
  const { valid, errors } = validateRecord(values);

  FORM_FIELDS.forEach((field) => setFieldError(field, errors[field] || ''));

  if (!valid) {
    const count = Object.keys(errors).length;
    announceError(`${count} ${count === 1 ? 'field needs' : 'fields need'} attention before this can be saved.`);
    focusFirstError(errors);
    return;
  }

  const record = addRecord(values);
  els.form.reset();
  clearFormErrors();
  announce(`Added "${record.title}". ${plural(getState().records.length)} saved.`);
  document.getElementById('title').focus();
});

els.form.addEventListener('reset', () => {
  window.setTimeout(clearFormErrors, 0);
});

/* Validate on blur, and clear a message as soon as the value becomes valid. */
FORM_FIELDS.forEach((field) => {
  const input = document.getElementById(field);

  input.addEventListener('blur', () => {
    if (input.value.trim() === '') {
      setFieldError(field, '');
      return;
    }
    const result = FIELD_VALIDATORS[field](input.value);
    setFieldError(field, result.ok ? '' : result.message);
  });

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') !== 'true') return;
    if (FIELD_VALIDATORS[field](input.value).ok) setFieldError(field, '');
  });
});

/* ---------- search and sort ---------- */

els.search.addEventListener('input', debounce((event) => {
  setSearch(event.target.value, els.caseToggle.checked);
}));

els.search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.search.value !== '') {
    els.search.value = '';
    setSearch('', els.caseToggle.checked);
  }
});

els.caseToggle.addEventListener('change', () => {
  setSearch(els.search.value, els.caseToggle.checked);
});

els.clearSearch.addEventListener('click', () => {
  els.search.value = '';
  setSearch('', els.caseToggle.checked);
  els.search.focus();
});

els.sortSelect.addEventListener('change', (event) => {
  const [key, dir] = event.target.value.split(':');
  setSort(key, dir);
});

/* Clicking a column heading sorts by it, and clicking again reverses it. */
els.table.querySelectorAll('.sort-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const state = getState();
    const key = button.dataset.sort;
    const dir = state.sortKey === key && state.sortDir === 'asc' ? 'desc' : 'asc';
    setSort(key, dir);
    els.table.querySelector(`.sort-btn[data-sort="${key}"]`).focus();
  });
});

/* ---------- inline edit and delete ---------- */

function saveRow(row, id) {
  const values = readRowValues(row);
  const { valid, errors } = validateRecord(values);

  if (!valid) {
    showRowErrors(row, errors);
    announceError('This row could not be saved. Check the highlighted fields.');
    return;
  }

  const record = updateRecord(id, values);
  announce(`Saved changes to "${record.title}".`);
  focusRowButton(id);
}

els.tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const row = button.closest('tr');
  clearAnnouncements();

  if (action === 'edit') {
    setEditing(id);
    els.tbody.querySelector(`tr[data-id="${id}"] input[data-field="title"]`)?.focus();
    announce('Row open for editing. Press Enter to save or Escape to cancel.');
    return;
  }

  if (action === 'cancel') {
    setEditing(null);
    focusRowButton(id);
    return;
  }

  if (action === 'save') {
    saveRow(row, id);
    return;
  }

  if (action === 'delete') {
    const record = getState().records.find((item) => item.id === id);
    if (!record) return;
    if (!window.confirm(`Delete "${record.title}"? This cannot be undone.`)) return;

    deleteRecord(id);
    announce(`Deleted "${record.title}". ${plural(getState().records.length)} left.`);
    (els.tbody.querySelector('button[data-action="edit"]') || els.search).focus();
  }
});

/* Enter saves an editing row, Escape abandons it. */
els.tbody.addEventListener('keydown', (event) => {
  const input = event.target.closest('input[data-field]');
  if (!input) return;

  const row = input.closest('tr');
  const id = row.dataset.id;

  if (event.key === 'Enter') {
    event.preventDefault();
    saveRow(row, id);
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    setEditing(null);
    focusRowButton(id);
  }
});

/* ---------- settings ---------- */

els.themeToggle.addEventListener('click', () => {
  const next = getState().settings.theme === 'dark' ? 'light' : 'dark';
  setSettings({ theme: next });
  applyTheme(next);
});

els.unitSelect.addEventListener('change', (event) => {
  setSettings({ unit: event.target.value });
  announce(`Durations now shown in ${event.target.value}.`);
});

document.getElementById('saveSettings').addEventListener('click', () => {
  clearAnnouncements();

  const capResult = validateCap(els.capInput.value);
  const tagsResult = validateTagList(els.tagsInput.value);

  const mark = (input, result) => {
    if (result.ok) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  };

  document.getElementById('capError').textContent = capResult.ok ? '' : capResult.message;
  document.getElementById('tagsError').textContent = tagsResult.ok ? '' : tagsResult.message;
  mark(els.capInput, capResult);
  mark(els.tagsInput, tagsResult);

  if (!capResult.ok || !tagsResult.ok) {
    announceError('Preferences not saved. Fix the highlighted settings.');
    (capResult.ok ? els.tagsInput : els.capInput).focus();
    return;
  }

  const tags = els.tagsInput.value.split(',').map(normalizeText).filter(Boolean);
  setSettings({ cap: Number(els.capInput.value), unit: els.unitSelect.value, tags });
  syncSettingsForm();
  announce('Preferences saved.');
});

/* ---------- export, import, sample data ---------- */

document.getElementById('exportJson').addEventListener('click', () => {
  const records = getState().records;
  if (records.length === 0) {
    announceError('There is nothing to export yet.');
    return;
  }
  download(`campus-planner-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(records, null, 2), 'application/json');
  announce(`Exported ${plural(records.length)} as JSON.`);
});

/* A CSV field is quoted whenever it holds a comma, a quote or a line break,
   and inner quotes are doubled. */
function toCsvField(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

document.getElementById('exportCsv').addEventListener('click', () => {
  const records = getState().records;
  if (records.length === 0) {
    announceError('There is nothing to export yet.');
    return;
  }

  const columns = ['id', 'title', 'dueDate', 'duration', 'tag', 'createdAt', 'updatedAt'];
  const rows = [
    columns.join(','),
    ...records.map((record) => columns.map((column) => toCsvField(record[column])).join(','))
  ];

  download(`campus-planner-${new Date().toISOString().slice(0, 10)}.csv`,
    rows.join('\r\n'), 'text/csv;charset=utf-8');
  announce(`Exported ${plural(records.length)} as CSV.`);
});

function applyImport(data, source) {
  const { ok, errors, records } = validateImport(data);

  if (!ok) {
    const shown = errors.slice(0, 4).join(' ');
    const more = errors.length > 4 ? ` Plus ${errors.length - 4} more problems.` : '';
    announceError(`Nothing was imported from ${source}. ${shown}${more}`);
    return false;
  }

  replaceRecords(records);
  announce(`Imported ${plural(records.length)} from ${source}.`);
  return true;
}

els.importFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  clearAnnouncements();

  try {
    const text = await file.text();
    applyImport(JSON.parse(text), file.name);
  } catch (err) {
    announceError(`${file.name} is not valid JSON, so nothing was changed.`);
  } finally {
    event.target.value = '';   // allow re-importing the same file
  }
});

async function loadSeed(announceResult = true) {
  try {
    const response = await fetch('seed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const loaded = applyImport(data, 'seed.json');
    if (loaded) markSeeded();
    return loaded;
  } catch (err) {
    if (announceResult) {
      announceError('Could not read seed.json. Serve the folder over http, or import a JSON file instead.');
    }
    console.warn('Seed load failed.', err);
    return false;
  }
}

document.getElementById('loadSeed').addEventListener('click', () => {
  clearAnnouncements();
  if (getState().records.length > 0
      && !window.confirm('Loading the sample data replaces everything saved here. Continue?')) {
    return;
  }
  loadSeed();
});

document.getElementById('clearData').addEventListener('click', () => {
  const count = getState().records.length;
  if (count === 0) {
    announceError('There is nothing to delete.');
    return;
  }
  if (!window.confirm(`Delete all ${plural(count)}? This cannot be undone.`)) return;

  clearAllRecords();
  markSeeded();      // do not quietly bring the samples back on the next visit
  announce('All activities deleted. Your preferences were kept.');
});

/* ---------- start up ---------- */

subscribe(render);
syncSettingsForm();
applyTheme(getState().settings.theme);
render();

/* A first-time visitor gets the sample data so the dashboard is not empty. */
if (getState().records.length === 0 && !wasSeeded()) {
  loadSeed(false);
}
