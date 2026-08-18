# todo.

A minimal to-do list on a pure black background. Each task gets a flat accent color (yellow, light blue, orange, lime, purple, peach) in rotation. Plan the week with a 7-day strip, schedule and repeat tasks with a lightweight `@` syntax, and drive everything from the keyboard. No frameworks, no build step, no dependencies.

## Features

- **Add**: type and hit enter
- **Schedule**: end a task with `@` to give it a time, a day, or both. A chip previews the parsed schedule as you type
- **Repeat**: recurring tasks roll themselves forward. Completing one plays the check, then reschedules it to its next occurrence; the toast names the next day and offers Undo
- **Days**: the strip under the header shows the next 7 days. Click a day to view it or to add tasks to it. Days with open tasks get a dot. Tasks from past days roll into Today, marked with their original day
- **Reorder**: drag a task up or down to hand-order the day. Timed tasks still slot in by their time when added; a drag overrides that
- **Complete**: click the ring; done tasks sink to the bottom
- **Edit**: double-click a task's text. Include an `@` chunk to reschedule it (the chunk replaces the whole schedule, repeat included)
- **Delete**: hover a task and hit the x
- **Filter**: All / Active / Done within the selected day, plus one-click "Clear done"
- **Undo**: deleting, clearing, importing, and recurrence rolls all show an Undo toast; Ctrl+Z (or Cmd+Z) also works, up to 20 steps back
- **Backup**: Export in the footer downloads your tasks as JSON; Import restores from a backup (replacing the current list, with Undo available)
- **Install**: it's a PWA. Install it from the browser menu for a standalone app window; it works fully offline

## The @ syntax

| Input | Meaning |
| --- | --- |
| `Call the bank @ 3pm` | today (or the viewed day) at 3pm |
| `Pack bags @ fri 6pm` | next Friday at 6pm |
| `Dentist @ tomorrow 8am` | tomorrow at 8am |
| `Journal @ daily 9pm` | every day at 9pm |
| `Gym @ every mon 6pm` | weekly on Monday at 6pm |
| `Standup @ weekdays 9:30am` | Monday through Friday |
| `Review @ weekly` | weekly on the task's day |

Bare hours like `@ 3` read as 3pm; use `am` or 24-hour times like `@ 15:00` otherwise. An `@` chunk that doesn't parse (like an email address) is left in the text. Weekly repeats keep their weekday and weekdays repeats skip weekends; an overdue repeat rolls forward from today.

## Keyboard

- **Down** from the empty input drops into the list; **Up / Down** move the selection
- **Enter** or **Space**: complete the selected task
- **E**: edit the selected task
- **Backspace** or **Delete**: delete the selected task
- **Alt+Up / Alt+Down**: move the selected task within the day
- **1 to 7**: jump to a day (1 is today)
- **F**: cycle All / Active / Done
- **N** or **/**: focus the input; **Escape**: clear the selection
- **Ctrl+Z / Cmd+Z**: undo

## Animation details

- Tasks spring open when added and collapse away when removed
- Completing a task fills the ring with its color, draws the checkmark, sweeps a strikethrough, and FLIP-animates it to the bottom of the list
- Timed tasks sort by time and FLIP into place
- While dragging, the lifted row shadows and tracks the pointer as its neighbors glide aside, then everything settles on release
- Day and filter switching slide a pill indicator and expand/collapse tasks in place
- "Clear done" staggers each task's exit
- Everything respects `prefers-reduced-motion`

## Running

There's no build step, so opening `index.html` in a browser works. For a local server:

```sh
npm run dev
```

## Your data

Tasks live in the browser's `localStorage`. Nothing is sent anywhere. Storage is per-origin, so pick one way of running the app (the installed PWA, or a consistent local URL) and your tasks will be there every time. The app requests persistent storage so the browser protects it from automatic eviction, and Export gives you a portable backup whenever you want one.

## Notes

- Drag to reorder works with mouse and pen; on touchscreens, dragging scrolls the page
- Files: `index.html`, `style.css`, `app.js` are the whole app; `sw.js` and `manifest.webmanifest` make it installable and offline-capable
