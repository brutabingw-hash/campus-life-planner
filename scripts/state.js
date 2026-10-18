/* state.js
 * One store for the whole app. Views never change data directly: they call a
 * function here, the change is written to localStorage, and every subscriber
 * re-renders. That keeps the table, the dashboard and the settings panel from
 * drifting apart.
 */

import {
  loadRecords, saveRecords,
  loadSettings, saveSettings,
  clearRecords
} from './storage.js';
import { normalizeRecord } from './validators.js';

const listeners = new Set();

const state = {
  records: loadRecords(),
  settings: loadSettings(),
  query: '',
  caseInsensitive: true,
  sortKey: 'dueDate',
  sortDir: 'asc',
  editingId: null,      // id of the row currently open for inline editing
  storageOk: true       // false once a write to localStorage has failed
};

export function getState() {
  return state;
}

/** Register a render function. Returns a function that removes it again. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('A subscriber failed to render.', err);
    }
  }
}

function persist() {
  state.storageOk = saveRecords(state.records);
  return state.storageOk;
}

/** Build the next sequential id, for example act_0007. */
export function nextId(records = state.records) {
  const highest = records.reduce((max, record) => {
    const digits = String(record.id).match(/(\d+)$/);
    const value = digits ? Number(digits[1]) : 0;
    return value > max ? value : max;
  }, 0);
  return `act_${String(highest + 1).padStart(4, '0')}`;
}

/* ---------- record changes ---------- */

export function addRecord(input) {
  const now = new Date().toISOString();
  const record = {
    id: nextId(),
    ...normalizeRecord(input),
    createdAt: now,
    updatedAt: now
  };

  state.records.push(record);
  persist();
  notify();
  return record;
}

export function updateRecord(id, input) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return null;

  Object.assign(record, normalizeRecord(input), { updatedAt: new Date().toISOString() });
  state.editingId = null;
  persist();
  notify();
  return record;
}

export function deleteRecord(id) {
  const before = state.records.length;
  state.records = state.records.filter((record) => record.id !== id);
  if (state.records.length === before) return false;

  if (state.editingId === id) state.editingId = null;
  persist();
  notify();
  return true;
}

/** Used by import and by the sample data button. */
export function replaceRecords(records) {
  state.records = records.map((record) => ({ ...record }));
  state.editingId = null;
  persist();
  notify();
  return state.records.length;
}

export function clearAllRecords() {
  state.records = [];
  state.editingId = null;
  clearRecords();
  notify();
}

/* ---------- settings and view changes ---------- */

export function setSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  saveSettings(state.settings);
  notify();
  return state.settings;
}

export function setSearch(query, caseInsensitive = state.caseInsensitive) {
  state.query = query;
  state.caseInsensitive = caseInsensitive;
  notify();
}

export function setSort(key, dir) {
  state.sortKey = key;
  state.sortDir = dir;
  notify();
}

export function setEditing(id) {
  state.editingId = id;
  notify();
}
