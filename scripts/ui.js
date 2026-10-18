/* ui.js
 * Everything that writes to the DOM. It reads the store and renders; it never
 * changes data. Buttons it draws carry data-action and data-id attributes, and
 * app.js listens for them once on the table body.
 */

import { getState } from './state.js';
import { filterRecords, sortRecords, highlight, escapeHtml } from './search.js';
import {
  computeStats, sevenDayTrend, capStatus, formatDuration, todayISO
} from './stats.js';

/* ---------- cached elements ---------- */

const $ = (id) => document.getElementById(id);

export const els = {
  html: document.documentElement,
  status: $('statusRegion'),
  error: $('errorRegion'),

  statCount: $('statCount'),
  statTotal: $('statTotal'),
  statTopTag: $('statTopTag'),
  statUpcoming: $('statUpcoming'),
  capFill: $('capFill'),
  capPolite: $('capPolite'),
  capAlert: $('capAlert'),
  chart: $('chart'),
  chartTable: $('chartTable'),

  search: $('searchInput'),
  searchError: $('searchError'),
  searchStatus: $('searchStatus'),
  caseToggle: $('caseToggle'),
  sortSelect: $('sortSelect'),
  clearSearch: $('clearSearch'),
  table: $('recordsTable'),
  tbody: $('recordsBody'),
  emptyState: $('emptyState'),

  form: $('activityForm'),
  tagOptions: $('tagOptions'),

  capInput: $('capInput'),
  unitSelect: $('unitSelect'),
  tagsInput: $('tagsInput'),
  themeToggle: $('themeToggle'),
  importFile: $('importFile')
};

/** The four form fields, used for validation and for reading values. */
export const FORM_FIELDS = ['title', 'dueDate', 'duration', 'tag'];

/* ---------- announcements ---------- */

/* Re-setting identical text is not announced by screen readers, so the region
   is cleared first and filled on the next tick. */
function speak(region, message) {
  region.textContent = '';
  if (!message) return;
  window.setTimeout(() => { region.textContent = message; }, 60);
}

export function announce(message) {
  els.status.classList.toggle('is-ok', Boolean(message));
  speak(els.status, message);
}

export function announceError(message) {
  speak(els.error, message);
}

export function clearAnnouncements() {
  els.status.textContent = '';
  els.error.textContent = '';
  els.status.classList.remove('is-ok');
}

/* ---------- form field errors ---------- */

export function setFieldError(field, message) {
  const input = $(field);
  const error = $(`${field}Error`);
  if (!input || !error) return;

  error.textContent = message || '';
  if (message) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

export function clearFormErrors() {
  FORM_FIELDS.forEach((field) => setFieldError(field, ''));
}

export function readForm() {
  const values = {};
  FORM_FIELDS.forEach((field) => { values[field] = $(field).value; });
  return values;
}

export function focusFirstError(errors) {
  const first = FORM_FIELDS.find((field) => errors[field]);
  if (first) $(first).focus();
}

/* ---------- table rows ---------- */

function readRow(record, regex, unit) {
  const title = highlight(record.title, regex);
  const date = highlight(record.dueDate, regex);
  const duration = highlight(formatDuration(record.duration, unit), regex);
  const tag = highlight(record.tag, regex);
  const safeTitle = escapeHtml(record.title);

  return `
    <tr data-id="${record.id}">
      <td class="cell-title" data-label="Title">${title}</td>
      <td class="cell-date" data-label="Due date">${date}</td>
      <td class="cell-duration" data-label="Duration">${duration}</td>
      <td class="cell-tag" data-label="Tag"><span class="tag-pill">${tag}</span></td>
      <td class="cell-actions">
        <button type="button" class="btn btn-small" data-action="edit" data-id="${record.id}">
          Edit<span class="visually-hidden"> ${safeTitle}</span>
        </button>
        <button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="${record.id}">
          Delete<span class="visually-hidden"> ${safeTitle}</span>
        </button>
      </td>
    </tr>`;
}

function editCell({ record, field, label, value, extra = '' }) {
  const errorId = `rowError-${field}`;
  return `
    <td class="cell-${field}" data-label="${label}">
      <div>
        <input type="text" value="${escapeHtml(value)}" data-field="${field}"
               aria-label="${label} for ${escapeHtml(record.title)}"
               aria-describedby="${errorId}" ${extra} />
        <span class="row-error" id="${errorId}" data-error="${field}"></span>
      </div>
    </td>`;
}

function editRow(record) {
  return `
    <tr class="is-editing" data-id="${record.id}">
      ${editCell({ record, field: 'title', label: 'Title', value: record.title })}
      ${editCell({ record, field: 'dueDate', label: 'Due date', value: record.dueDate, extra: 'inputmode="numeric" placeholder="YYYY-MM-DD"' })}
      ${editCell({ record, field: 'duration', label: 'Duration in minutes', value: record.duration, extra: 'inputmode="decimal"' })}
      ${editCell({ record, field: 'tag', label: 'Tag', value: record.tag, extra: 'list="tagOptions"' })}
      <td class="cell-actions">
        <button type="button" class="btn btn-small btn-primary" data-action="save" data-id="${record.id}">Save</button>
        <button type="button" class="btn btn-small btn-ghost" data-action="cancel" data-id="${record.id}">Cancel</button>
      </td>
    </tr>`;
}

/** Read the four inputs of a row that is open for editing. */
export function readRowValues(row) {
  const values = {};
  row.querySelectorAll('input[data-field]').forEach((input) => {
    values[input.dataset.field] = input.value;
  });
  return values;
}

/** Show per-field messages inside an editing row and focus the first problem. */
export function showRowErrors(row, errors) {
  row.querySelectorAll('input[data-field]').forEach((input) => {
    const message = errors[input.dataset.field] || '';
    const target = row.querySelector(`[data-error="${input.dataset.field}"]`);
    if (target) target.textContent = message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  });

  const firstField = FORM_FIELDS.find((field) => errors[field]);
  if (firstField) row.querySelector(`input[data-field="${firstField}"]`)?.focus();
}

/* ---------- renderers ---------- */

/* The row animation should play when records are added or removed, not on
   every keystroke in the search box, so it is tied to the record count. */
let lastRecordCount = -1;

function renderRecords(state) {
  const { matches, regex, tag, error } = filterRecords(
    state.records, state.query, state.caseInsensitive
  );
  const sorted = sortRecords(matches, state.sortKey, state.sortDir);
  const unit = state.settings.unit;

  const isFresh = state.records.length !== lastRecordCount;
  lastRecordCount = state.records.length;
  els.tbody.classList.toggle('is-fresh', isFresh);

  els.tbody.innerHTML = sorted
    .map((record) => (record.id === state.editingId ? editRow(record) : readRow(record, regex, unit)))
    .join('');

  els.searchError.textContent = error;
  /* The table itself stays in the page even when empty, so the sort buttons
     never disappear from the tab order. */
  els.emptyState.hidden = sorted.length > 0;

  renderSearchStatus(state, sorted.length, tag, error);
}

function renderSearchStatus(state, shown, tag, error) {
  const total = state.records.length;

  if (error) {
    els.searchStatus.textContent = '';
    return;
  }
  if (!state.query.trim()) {
    els.searchStatus.textContent = total === 0
      ? 'No activities saved yet.'
      : `Showing all ${total} ${total === 1 ? 'activity' : 'activities'}.`;
    return;
  }

  const tagPart = tag ? ` tagged "${tag}"` : '';
  els.searchStatus.textContent =
    `${shown} of ${total} ${total === 1 ? 'activity' : 'activities'}${tagPart} match your search.`;
}

function renderStats(state) {
  const unit = state.settings.unit;
  const stats = computeStats(state.records);

  els.statCount.textContent = String(stats.count);
  els.statTotal.textContent = formatDuration(stats.totalMinutes, unit);
  els.statTopTag.textContent = stats.topTag
    ? `${stats.topTag} (${stats.topTagCount})`
    : '–';
  els.statUpcoming.textContent = String(stats.upcomingCount);

  renderCap(state, stats);
  renderChart(state);
}

function renderCap(state, stats) {
  const unit = state.settings.unit;
  const status = capStatus(stats.upcomingMinutes, state.settings.cap);

  els.capFill.style.width = `${status.percent}%`;
  els.capFill.classList.toggle('is-over', status.over);

  const used = formatDuration(status.used, unit);
  const target = formatDuration(status.cap, unit);
  const gap = formatDuration(status.difference, unit);

  if (status.over) {
    /* assertive region: the user needs to know straight away */
    els.capPolite.textContent = '';
    els.capAlert.textContent = `Over target: ${used} planned against ${target}. That is ${gap} too much.`;
  } else {
    els.capAlert.textContent = '';
    els.capPolite.textContent = `${used} of ${target} planned for the next 7 days. ${gap} still free.`;
  }
}

function renderChart(state) {
  const unit = state.settings.unit;
  const days = sevenDayTrend(state.records);
  const peak = Math.max(...days.map((day) => day.minutes), 1);
  const today = todayISO();

  /* The bars are decoration; the table below carries the same numbers. */
  els.chart.setAttribute('aria-hidden', 'true');
  els.chart.innerHTML = days.map((day) => {
    const height = day.minutes === 0 ? 0 : Math.max(4, Math.round((day.minutes / peak) * 100));
    const mark = day.iso === today ? ' title="Today"' : '';
    return `
      <div class="bar-col"${mark}>
        <div class="bar" style="height:${height}%"></div>
        <span class="bar-label">${day.iso === today ? 'Today' : day.label}</span>
      </div>`;
  }).join('');

  els.chartTable.querySelector('tbody').innerHTML = days.map((day) => `
    <tr><th scope="row">${day.label} ${day.iso}</th><td>${formatDuration(day.minutes, unit)}</td></tr>
  `).join('');
}

function renderSortIndicators(state) {
  els.table.querySelectorAll('th[data-key]').forEach((th) => {
    const arrow = th.querySelector('.arrow');
    if (th.dataset.key === state.sortKey) {
      th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
      if (arrow) arrow.textContent = state.sortDir === 'asc' ? ' ▲' : ' ▼';
    } else {
      th.removeAttribute('aria-sort');
      if (arrow) arrow.textContent = '';
    }
  });

  const value = `${state.sortKey}:${state.sortDir}`;
  if (els.sortSelect.value !== value) els.sortSelect.value = value;
}

function renderTagOptions(state) {
  els.tagOptions.innerHTML = state.settings.tags
    .map((tag) => `<option value="${escapeHtml(tag)}"></option>`)
    .join('');
}

export function applyTheme(theme) {
  els.html.setAttribute('data-theme', theme);
  const dark = theme === 'dark';
  els.themeToggle.setAttribute('aria-pressed', String(dark));
  els.themeToggle.textContent = dark ? 'Light mode' : 'Dark mode';
}

/** Copy the saved settings into the settings form. Called on load and on save. */
export function syncSettingsForm(state = getState()) {
  els.capInput.value = state.settings.cap;
  els.unitSelect.value = state.settings.unit;
  els.tagsInput.value = state.settings.tags.join(', ');
}

/** The master render, subscribed to the store. */
export function render(state = getState()) {
  renderTagOptions(state);
  renderRecords(state);
  renderStats(state);
  renderSortIndicators(state);
  applyTheme(state.settings.theme);

  if (!state.storageOk) {
    announceError('Changes could not be saved to this browser. Export your data as a backup.');
  }
}
