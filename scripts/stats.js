/* stats.js
 * Date helpers, unit conversion and the numbers shown on the dashboard.
 * Pure functions only, which is what makes them easy to assert in tests.html.
 */

/** Today as YYYY-MM-DD, using the browser's local date rather than UTC. */
export function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Move an ISO date by a number of days: addDays('2025-12-31', 1) -> '2026-01-01'. */
export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

/* ---------- units: minutes <-> hours ---------- */

export function minutesToHours(minutes) {
  return Number(minutes) / 60;
}

export function hoursToMinutes(hours) {
  return Number(hours) * 60;
}

/**
 * Render a duration in the unit chosen in Settings.
 * formatDuration(90) -> "90m"; formatDuration(90, 'hours') -> "1h 30m".
 */
export function formatDuration(minutes, unit = 'minutes') {
  const total = Number(minutes) || 0;
  const rounded = Math.round(total * 100) / 100;

  if (unit !== 'hours') return `${rounded}m`;

  const whole = Math.floor(rounded / 60);
  const rest = Math.round((rounded - whole * 60) * 100) / 100;

  if (whole === 0) return `${rest}m`;
  if (rest === 0) return `${whole}h`;
  return `${whole}h ${rest}m`;
}

/* ---------- dashboard numbers ---------- */

/** The tag used most often. Ties are broken alphabetically for a stable result. */
export function topTag(records) {
  const counts = new Map();
  for (const record of records) {
    counts.set(record.tag, (counts.get(record.tag) || 0) + 1);
  }

  let best = '';
  let bestCount = 0;
  for (const [tag, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return { tag: best, count: bestCount };
}

export function sumMinutes(records) {
  return records.reduce((total, record) => total + (Number(record.duration) || 0), 0);
}

/** Records due from today up to and including today + 6. */
export function upcomingWeek(records, from = todayISO()) {
  const end = addDays(from, 6);
  return records.filter((record) => record.dueDate >= from && record.dueDate <= end);
}

export function computeStats(records, from = todayISO()) {
  const upcoming = upcomingWeek(records, from);
  const best = topTag(records);

  return {
    count: records.length,
    totalMinutes: sumMinutes(records),
    topTag: best.tag,
    topTagCount: best.count,
    upcomingCount: upcoming.length,
    upcomingMinutes: sumMinutes(upcoming)
  };
}

/**
 * Seven buckets for the chart, one per day starting today.
 * @returns {{iso:string, label:string, minutes:number}[]}
 */
export function sevenDayTrend(records, from = todayISO()) {
  const days = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const iso = addDays(from, offset);
    const [y, m, d] = iso.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
    const minutes = sumMinutes(records.filter((record) => record.dueDate === iso));
    days.push({ iso, label, minutes });
  }
  return days;
}

/**
 * Compare the coming week against the weekly target.
 * @returns {{used:number, cap:number, percent:number, over:boolean, difference:number}}
 */
export function capStatus(usedMinutes, cap) {
  const target = Number(cap) || 0;
  const used = Number(usedMinutes) || 0;
  const percent = target > 0 ? Math.min(100, Math.round((used / target) * 100)) : 0;

  return {
    used,
    cap: target,
    percent,
    over: target > 0 && used > target,
    difference: Math.abs(Math.round((used - target) * 100) / 100)
  };
}
