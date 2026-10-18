# Campus Life Planner

A responsive, accessible planner for campus tasks and events. Every activity
carries a **due date**, a **duration in minutes** and a **tag**, so the app can
answer the question a to-do list cannot: *how much time have I actually
committed to this week?*

Built with vanilla HTML, CSS and JavaScript ES modules. No frameworks, no
libraries, no build step.

- **Live site:** https://endahiro.github.io/campus-life-planner/
- **Test page:** https://endahiro.github.io/campus-life-planner/tests.html
- **Demo video:** _add the unlisted link here before submitting_
- **Theme:** 2 of 3 - Campus Life Planner (tasks and events, durations, tags, search)

---

## Contents

1. [Features](#features)
2. [Running it](#running-it)
3. [Project structure](#project-structure)
4. [Data model](#data-model)
5. [Regex catalog](#regex-catalog)
6. [Search syntax](#search-syntax)
7. [Keyboard map](#keyboard-map)
8. [Accessibility notes](#accessibility-notes)
9. [Responsive design](#responsive-design)
10. [Tests](#tests)
11. [Known limits](#known-limits)
12. [Credits](#credits)

---

## Features

**Records**

- Add activities through a validated form, with inline error messages per field.
- Edit any row **in place**: the row turns into four inputs with Save and Cancel.
- Delete with a confirmation step; stats, chart and the weekly target all follow.
- `updatedAt` is rewritten on every edit, `createdAt` is written once.

**Search and sort**

- Live search where the query **is** a regular expression, compiled through a
  `try`/`catch` wrapper so a half-typed pattern such as `(` never breaks the page.
- A case-sensitivity toggle, and an `@tag:Name` prefix that filters by tag first.
- Matches are wrapped in `<mark>`, after the record text has been HTML-escaped.
- Sort by title, due date, duration or tag, either from the dropdown or by
  clicking a column heading (click again to reverse). The active column
  reports itself with `aria-sort`.

**Dashboard**

- Total activities, total planned time, the most-used tag, and how many
  activities fall in the coming week.
- A weekly **time target**: planned minutes for the next seven days against the
  target set in Settings, shown as a meter and announced in a live region -
  politely while under, assertively once exceeded.
- A seven-day bar chart drawn in CSS, with the same numbers repeated in a
  visually hidden table for screen readers.

**Units**

- Durations are stored in minutes and can be displayed as minutes (`90m`) or
  hours (`1h 30m`). The choice is saved and applies to the table, the stats,
  the chart and the target message.

**Data**

- Every change is written to `localStorage` immediately.
- Export as **JSON** or as **CSV** (fields containing a comma, a quote or a
  line break are quoted, and inner quotes are doubled).
- Import JSON with full validation: the file must be an array, every record
  must have a unique id and must pass the same four regex rules as the form.
  **If anything fails, nothing is imported** and the problems are announced.
- A "Load sample data" button reads `seed.json`. First-time visitors get it
  automatically; once you delete everything it stays deleted.
- Editable tag list and a light/dark theme, both persisted.

---

## Running it

The app uses ES modules, which browsers refuse to load over `file://`, so serve
the folder over HTTP:

```bash
git clone https://github.com/endahiro/campus-life-planner.git
cd campus-life-planner

python -m http.server 8000      # or: npx serve .
```

Then open <http://localhost:8000/>. There is nothing to install and nothing to build.

Deployment is GitHub Pages from the `main` branch, root folder
(Settings - Pages - Deploy from a branch).

---

## Project structure

```
campus-life-planner/
├── index.html              single page: dashboard, activities, add, settings, about
├── tests.html              assertion page for the pure functions
├── seed.json               13 sample activities
├── styles/
│   └── main.css            mobile-first, 3 breakpoints, light and dark tokens
├── scripts/
│   ├── app.js              entry point: wires every event listener
│   ├── state.js            the single store, autosave, subscribe/notify
│   ├── storage.js          the only file that touches localStorage
│   ├── validators.js       every validation regex and the import validator
│   ├── search.js           query parsing, safe regex, filter, sort, highlight
│   ├── stats.js            dates, unit conversion, dashboard numbers
│   └── ui.js               all DOM rendering and announcements
├── assets/
│   ├── favicon.svg
│   └── seed-invalid.json   a deliberately broken file, to demo import validation
└── docs/
    └── spec.md             M1: wireframes, data model, accessibility plan
```

The data flows one way: an event handler in `app.js` calls a function in
`state.js`, the store saves and notifies, and `ui.js` re-renders from the new
state. Views never mutate data directly, which is why the table, the dashboard
and the target message can never disagree.

---

## Data model

```json
{
  "id": "act_0001",
  "title": "CS 301 lab report",
  "dueDate": "2026-10-19",
  "duration": 120,
  "tag": "Study",
  "createdAt": "2026-10-10T08:15:00.000Z",
  "updatedAt": "2026-10-10T08:15:00.000Z"
}
```

`duration` is always minutes; hours are a display choice, not a stored value.
Storage keys: `clp:records`, `clp:settings`, `clp:seeded`.

---

## Regex catalog

All six live in `scripts/validators.js` as `PATTERNS`, and every row below is
asserted in `tests.html`.

### Rule 1 - title has no outer whitespace

```js
/^\S(?:.*\S)?$/
```

Anchored at both ends, so the first and last characters must be non-space. A
single character passes the regex, which is why Rule 6 also applies.

| Input | Result |
| --- | --- |
| `CS 301 lab report` | pass |
| `" CS 301 lab report"` | fail - "Title cannot start or end with a space." |
| `"CS 301 lab report "` | fail |
| `""` | fail - "Title is required." |

Runs of inner whitespace are not rejected, they are **collapsed** by
`normalizeText()` before saving, so `Lab    report` is stored as `Lab report`.

### Rule 2 - duration is a sane number

```js
/^(0|[1-9]\d*)(\.\d{1,2})?$/
```

Either `0` or a digit string with no leading zero, optionally followed by one
or two decimals.

| Input | Result |
| --- | --- |
| `90` | pass |
| `7.5` | pass |
| `7.555` | fail - three decimals |
| `09` | fail - leading zero |
| `-15` | fail - no sign allowed |
| `ninety` | fail |
| `0` | rejected after the regex: "Duration must be more than 0 minutes." |
| `1500` | rejected after the regex: over 1440 minutes |

### Rule 3 - due date is an ISO calendar date

```js
/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
```

| Input | Result |
| --- | --- |
| `2026-10-20` | pass |
| `2026-13-01` | fail - month out of range |
| `2026-10-32` | fail - day out of range |
| `2026-1-5` | fail - not zero-padded |
| `19/10/2026` | fail - wrong format |
| `2026-02-30` | passes the regex, then fails `isRealDate()` |
| `2028-02-29` | pass - real leap day |

A regex cannot count the days in February, so `isRealDate()` rebuilds the date
and checks that the year, month and day survive the round trip.

### Rule 4 - tag is letters with single separators

```js
/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/
```

| Input | Result |
| --- | --- |
| `Study` | pass |
| `Group-Work` | pass |
| `Study Group` | pass |
| `Study  Group` | collapsed to `Study Group`, then passes |
| `Study2` | fail - digits |
| `-Study` | fail - separator cannot lead |
| `Study-` | fail - separator cannot trail |

### Rule 5 - advanced, back-reference: no repeated word

```js
/\b(\w+)\s+\1\b/i
```

`(\w+)` captures a word, `\s+` crosses the gap, and `\1` demands **the same
word again**. The `i` flag makes the back-reference case-insensitive, so
`Study study` is caught as well.

| Input | Result |
| --- | --- |
| `Revision revision marathon` | fail - "Remove the repeated word "Revision"." |
| `Study study group` | fail - caught across cases |
| `Lab notes lab setup` | pass - the repeat is not adjacent |

The same pattern is useful in the search box: typing `\b(\w+)\s+\1\b` returns
no rows, which is the proof that the validator is doing its job. Import the
deliberately broken `assets/seed-invalid.json` to see it reject data that the
form would never have accepted.

### Rule 6 - advanced, lookahead: title shape

```js
/^(?=.*[A-Za-z])(?=.{3,80}$)[\s\S]+$/
```

Two lookaheads assert from the same starting position without consuming
anything: the first demands at least one letter somewhere, the second pins the
total length to 3 to 80 characters. Only then does `[\s\S]+` match.

| Input | Result |
| --- | --- |
| `Lab 3` | pass |
| `ab` | fail - shorter than 3 |
| `2026` | fail - no letter |
| `----` | fail - no letter |
| 81 characters | fail |

### Supporting patterns

```js
/^@tag:([A-Za-z][A-Za-z-]*)\s*/i   // pulls the tag filter off the front of a query
/\b([01]\d|2[0-3]):[0-5]\d\b/      // a 24-hour time token, e.g. "18:30"
/^[1-9]\d*$/                       // weekly target: a positive whole number
/\s{2,}/g                          // collapses runs of whitespace on save
/[",\r\n]/                         // decides whether a CSV field needs quoting
```

---

## Search syntax

The query **is** a regular expression. It is tested against the title, tag,
due date and duration of every record.

| Type this | To find |
| --- | --- |
| `lab` | anything containing "lab" |
| `lab\|quiz` | either word (a plain pipe, escaped here only for this table) |
| `^CS` | titles starting with CS |
| `\b\d{2}:\d{2}\b` | activities with a time in the title, e.g. `18:30` |
| `\b(\w+)\s+\1\b` | repeated words - returns nothing in clean data |
| `\.\d{1,2}\b` | durations with decimals, e.g. `45.5` |
| `2026-10-2\d` | due dates in the 20s of October |
| `@tag:Study` | only the Study tag |
| `@tag:Study lab` | the Study tag, then "lab" within it |
| `(` | nothing breaks: the row set is kept and the error is explained |

Untick **Ignore case** to make the pattern case-sensitive.

---

## Keyboard map

The whole app is operable without a mouse.

| Key | Where | Action |
| --- | --- | --- |
| `Tab` / `Shift+Tab` | anywhere | move forward and back; the skip link is first |
| `Enter` | skip link | jump to `main`, which receives focus |
| `Enter` / `Space` | any button | activate it (Edit, Delete, Save, Export, ...) |
| `Enter` | add form | submit the form |
| `Enter` | an editing row | save that row |
| `Escape` | an editing row | cancel and leave the record untouched |
| `Escape` | search box | clear the search |
| `Up` / `Down` | sort dropdown, unit dropdown | change the option |
| `Space` | "Ignore case" checkbox | toggle it |
| `Enter` | a column heading | sort by it; press again to reverse |

Focus is moved on purpose, never left stranded: after adding, focus returns to
**Title**; after saving or cancelling a row, to that row's **Edit** button;
after deleting, to the first remaining **Edit** button, or the search box if the
list is now empty.

---

## Accessibility notes

- **Landmarks and headings.** One `header`, `nav`, `main` and `footer`. Every
  panel is a `section` linked to its own heading with `aria-labelledby`. One
  `h1`, then `h2` per section and `h3` per panel, with no skipped levels.
- **Skip link.** The first focusable element, off-screen until focused, jumping
  to `#main` (which carries `tabindex="-1"` so it can hold focus).
- **Labels.** Every control has a `<label for>`. Inline row inputs use
  `aria-label` that names both the field and the record, for example
  "Due date for CS 301 lab report".
- **Errors.** Each message lives in its own `<p>`, referenced by the input's
  `aria-describedby`, and the input gains `aria-invalid="true"`. Messages say
  what to do, not just that something is wrong.
- **Live regions.** `role="status"` with `aria-live="polite"` carries
  confirmations, search counts and the under-target message. `role="alert"`
  with `aria-live="assertive"` carries validation failures and the
  over-target message - the one case where interrupting is the point. Regions
  are cleared before being refilled, otherwise repeating the same sentence is
  not announced at all.
- **Tables.** A `<caption>` explains what the rows are and how to act on them.
  Headings use `scope="col"`, and the sorted column carries `aria-sort`; the
  arrow glyph is `aria-hidden`.
- **The chart** is `aria-hidden="true"` decoration. The same seven numbers sit
  in a visually hidden `<table>` with a caption, so nothing is lost.
- **Highlighting.** Record text is escaped before matches are wrapped in
  `<mark>`, so a title like `<img onerror=...>` renders as text. `<mark>`
  keeps the content in the accessibility tree.
- **Contrast.** Body text 13.9:1 on the page background, brand blue 6.1:1 on
  white, danger red 6.0:1 - all above the 4.5:1 requirement. The dark palette
  was checked separately (brand 7.4:1 on the dark surface).
- **Colour is never the only signal.** Going over the target changes the
  wording, not just the meter colour.
- **Motion.** All transitions and keyframes collapse to near-zero under
  `prefers-reduced-motion: reduce`.
- **Touch targets** are at least 2.6rem tall.

---

## Responsive design

Mobile-first: the base stylesheet targets a ~360px phone, and three
`min-width` breakpoints add to it.

| Width | What changes |
| --- | --- |
| base, ~360px | single column; stats 2-up; **each record is a card**, with its field label drawn from `data-label` via `td::before`; form fields stacked |
| 480px | toolbar becomes a row; the add form goes to two columns |
| 768px | nav moves onto the header row; stats 4-up; the cards **become a real table** with a visible `thead` and sortable headings |
| 1024px | the two dashboard panels sit side by side; the add form is one four-column row; content capped at 1100px |

The record list is one `<table>` at every size. On phones CSS turns the rows
into cards rather than forcing a horizontal scroll, which keeps one semantic
structure for screen readers across all breakpoints.

---

## Tests

Open **[tests.html](tests.html)** in the browser (served over HTTP, as above).
It runs 110 assertions against the pure functions in `validators.js`,
`search.js`, `stats.js` and `state.js`, and prints one row per assertion with a
pass/fail summary at the top. The page title becomes `PASS` or `FAIL` so the
result is visible from the tab.

No framework, no network, and nothing is written to `localStorage`.

Covered: all six validation rules and their edge cases (leading zeros, three
decimals, `2026-02-30`, `2028-02-29`, non-adjacent repeated words), the safe
regex compiler, `@tag:` parsing, filtering with and without case sensitivity,
highlighting and HTML escaping, all three sort keys in both directions, unit
conversion, date arithmetic across month, year and leap boundaries, the weekly
target maths, id generation, and import validation including duplicate ids and
missing fields.

---

## Known limits

- Data lives in one browser. Clearing site data removes it; export first.
- Highlighting escapes the text before matching, so a pattern aimed at a raw
  `&`, `<` or `>` can match the escaped form instead. Normal searches are
  unaffected.
- The seven-day chart and the weekly target look **forward** from today, which
  is what a planner needs. Sample dates sit in mid-October 2026 so those panels
  are populated on a first visit; if your clock is far from that, load your own
  data or edit `seed.json`.
- A tag is matched exactly by `@tag:`; there is no partial tag matching.

## Stretch items included

- Light/dark theme toggle, persisted.
- CSV export with correct quoting and escaping.

Not attempted: service worker offline caching, the jQuery scraping page.

---

## Credits

UI, layout and all logic are my own work.

- The brief supplied the starting shapes for four validation rules
  (`/^\S(?:.*\S)?$/`, `^(0|[1-9]\d*)(\.\d{1,2})?$`, the ISO date pattern and
  the tag pattern), the duplicate-word back-reference, and the sketches for
  `compileRegex`, `highlight` and the `load`/`save` pair. Each one is extended
  here: the compiler takes flags and reports why a pattern failed, highlighting
  escapes HTML and guards against empty matches, storage is wrapped in
  `try`/`catch` with defaults, and the date rule is backed by a real calendar check.
- The visually-hidden class is the long-standing community pattern (the
  `clip: rect(0 0 0 0)` approach, as documented by the A11Y Project).
- Accessibility decisions follow the WAI-ARIA Authoring Practices on live
  regions and sortable table headers, and WCAG 2.1 AA for contrast and motion.

**Author:** Evan Ndahiro - [github.com/endahiro](https://github.com/endahiro) -
[saskevan@gmail.com](mailto:saskevan@gmail.com)
