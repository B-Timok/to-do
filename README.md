# todo.

A minimal to-do list on a pure black background. Each task gets a flat accent color (yellow, light blue, orange, lime, purple, peach) in rotation. No frameworks, no build step, no dependencies.

## Features

- **Add**: type and hit enter
- **Schedule**: end a task with `@` to give it a time, a day, or both. `Call the bank @ 3pm`, `Pack bags @ fri 6pm`, `Dentist @ tomorrow 8am`. A chip previews the parsed day and time as you type. Bare hours like `@ 3` read as 3pm; use `am` or 24-hour times like `@ 15:00` otherwise
- **Repeat**: add `daily`, `weekly`, `weekdays`, or `every mon` to the `@` chunk. `Gym @ every mon 6pm`, `Journal @ daily 9pm`. Completing a repeating task plays the check, then rolls it to its next occurrence (weekly keeps its weekday, weekdays skips weekends); the toast names the next day and offers Undo. Repeating tasks wear a small repeat mark on their chip. Editing with a plain `@` chunk replaces the whole schedule, repeat included
- **Days**: the strip under the header shows the next 7 days. Click a day to view it or to add tasks to it. Days with open tasks get a dot. Tasks from past days roll into Today, marked with their original day
- **Reorder**: drag a task up or down to hand-order the day. Timed tasks still slot in by their time when added; a drag overrides that
- **Complete**: click the ring; done tasks sink to the bottom
- **Edit**: double-click a task's text. Include an `@` chunk to reschedule it
- **Delete**: hover a task and hit the x
- **Filter**: All / Active / Done within the selected day, plus one-click "Clear done"
- **Undo**: deleting or clearing shows an Undo toast; Ctrl+Z (or Cmd+Z) also works, up to 20 steps back
- **Persistence**: tasks are saved to `localStorage`
- **Install**: it's a PWA. Install it from the browser menu for a standalone app window; it works fully offline

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
