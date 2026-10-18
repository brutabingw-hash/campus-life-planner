# M1 - Spec, wireframes and accessibility plan

Campus Life Planner. Theme 2 of the Building Responsive UI assignment.

## 1. Problem and purpose

Students keep tasks in three or four places: a phone reminder, a group chat, a
paper list. Nothing adds up the *time* those commitments will cost, so a week
looks manageable until it is not.

Campus Life Planner holds one record per task or event, each with a duration,
and compares the coming week against a weekly time target. The question it
answers is: **how many hours have I actually committed to this week?**

## 2. Data model

One record per activity. Ids are sequential and never reused inside a session.

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

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | `act_` plus four digits, unique |
| `title` | string | 3 to 80 characters, no outer spaces, no repeated word |
| `dueDate` | string | `YYYY-MM-DD`, must exist on the calendar |
| `duration` | number | minutes, more than 0, at most 1440, 2 decimals |
| `tag` | string | letters with single spaces or hyphens |
| `createdAt` | string | ISO 8601, set once |
| `updatedAt` | string | ISO 8601, rewritten on every edit |

Settings are a separate object: `{ cap, unit, tags[], theme }`.

Storage keys: `clp:records`, `clp:settings`, `clp:seeded`.

## 3. Wireframes

### 3.1 Mobile, around 360px (the base layout)

```
+--------------------------------+
| [skip to content]              |
| CLP  Campus Life Planner  [DK] |
| Dashboard Activities Add ...   |  <- nav wraps to its own row
+--------------------------------+
| H1 Plan your week on campus    |
| lede paragraph                 |
|                                |
| H2 Dashboard                   |
| +-------------+ +------------+ |  <- stats 2 across
| |     13      | |  1750.5m   | |
| | Activities  | | Total time | |
| +-------------+ +------------+ |
| +-------------+ +------------+ |
| | Admin (3)   | |     7      | |
| | Top tag     | | Next 7 days| |
| +-------------+ +------------+ |
|                                |
| +----------------------------+ |
| | H3 Weekly time target      | |
| | [=========---------]  62%  | |
| | 745m of 1200m planned...   | |  <- aria-live region
| +----------------------------+ |
| +----------------------------+ |
| | H3 Next 7 days             | |
| |  _   #   _   #   #   _   # | |  <- CSS bar chart
| | Tod Mon Tue Wed Thu Fri Sat| |
| +----------------------------+ |
|                                |
| H2 Activities                  |
| Search (regular expression)    |
| [..........................]   |
| Sort by [ due date       v ]   |
| [x] Ignore case  [Clear]       |
| "Showing all 13 activities."   |
|                                |
| +----------------------------+ |  <- each record is a CARD here,
| | TITLE    CS 301 lab report | |     label on the left comes from
| | DUE DATE        2026-10-19 | |     td::before { attr(data-label) }
| | DURATION              120m | |
| | TAG                 (Study)| |
| |            [Edit] [Delete] | |
| +----------------------------+ |
+--------------------------------+
| H2 Add an activity             |
| Title     [................]   |  <- one field per row
| Due date  [................]   |
| Duration  [................]   |
| Tag       [................]   |
| [Add activity] [Reset form]    |
+--------------------------------+
| H2 Settings (stacked panels)   |
| H2 About                       |
+--------------------------------+
```

### 3.2 Tablet, 768px and up

Stats become one row of four. The record cards turn back into a real
`<table>` with a visible `<thead>`, and each heading is a sort button.
The add form moves to two columns.

```
+----------------------------------------------------------+
| CLP  Campus Life Planner   Dashboard Activities ...  [DK]|
+----------------------------------------------------------+
| [ 13 ] [ 1750.5m ] [ Admin (3) ] [ 7 ]                   |
| +--------------------------+ +-------------------------+ |
| | Weekly time target       | | Next 7 days             | |
| +--------------------------+ +-------------------------+ |
|                                                          |
| Search [...................] Sort [ v ] [x] Ignore case  |
| +------------------------------------------------------+ |
| | Title ^    | Due date | Duration |  Tag  | Actions   | |
| | CS 301 lab | 10-19    |    120m  | Study | Edit Del  | |
| | Calculus.. | 10-20    |     90m  | Study | Edit Del  | |
| +------------------------------------------------------+ |
| Title [............]  Due date [............]            |
| Duration [.........]  Tag      [............]            |
+----------------------------------------------------------+
```

### 3.3 Desktop, 1024px and up

The two dashboard panels sit side by side, the add form is four columns on one
line, and the content is capped at 1100px and centred.

### 3.4 Inline edit state

```
| +------------------------------------------------------+ |
| | [CS 301 lab report ] [2026-10-19] [120] [Study]      | |
| |                                      [Save] [Cancel] | |
| | (per-field error text appears under the input)       | |
| +------------------------------------------------------+ |
```

## 4. Accessibility plan

| Area | Decision |
| --- | --- |
| Landmarks | one `header`, `nav`, `main`, `footer`; every panel is a `section` tied to its heading with `aria-labelledby` |
| Headings | a single `h1` in `main`, `h2` per section, `h3` per panel, no levels skipped |
| Skip link | first focusable element, hidden until focused, jumps to `#main` which takes `tabindex="-1"` |
| Labels | every control has a `<label for>`; inline row inputs use `aria-label` naming the field and the record |
| Errors | each message sits in a `<p id="...Error">` wired through `aria-describedby`, plus `aria-invalid="true"` on the input |
| Announcements | `role="status"` (polite) for confirmations and search counts; `role="alert"` (assertive) for validation failures and for going over the weekly target |
| Focus | one shared `:focus-visible` ring, 3px, offset 2px; focus is moved deliberately after add, save, cancel and delete |
| Keyboard | everything is a real `button`, `a`, `input` or `select`; Enter saves an editing row, Escape cancels it or clears the search |
| Sorting | `aria-sort` on the active column header, arrow glyph is `aria-hidden` |
| Chart | the bars are `aria-hidden="true"`; the same numbers are in a visually hidden `<table>` with a caption |
| Highlighting | matches are wrapped in `<mark>`, which keeps the text in the accessibility tree; record text is HTML-escaped before the wrap |
| Contrast | measured, not estimated: lowest text pair 6.0:1 light / 6.7:1 dark, against a 4.5:1 requirement; controls get a separate `--border-strong` token so their outlines clear the 3:1 of WCAG 1.4.11 |
| Motion | every animation is disabled under `prefers-reduced-motion: reduce` |
| Colour | colour never carries meaning alone: the over-target state also changes the wording |

## 5. Build order

1. M2 semantic HTML, mobile-first CSS, three breakpoints.
2. M3 `validators.js` plus `tests.html` assertions.
3. M4 `search.js`, rendering, sorting, highlighting.
4. M5 `stats.js`, dashboard, cap with live regions.
5. M6 `storage.js`, import and export, settings.
6. M7 keyboard pass, animation, README, demo video.
