# todo.

A minimal to-do list on a pure black background. Each task gets a flat accent color (yellow, light blue, orange, lime, purple, peach) in rotation. No frameworks, no build step, no dependencies.

## Features

- **Add**: type and hit enter
- **Schedule**: end a task with `@` to give it a time, a day, or both. `Call the bank @ 3pm`, `Pack bags @ fri 6pm`, `Dentist @ tomorrow 8am`. A chip previews the parsed day and time as you type. Bare hours like `@ 3` read as 3pm; use `am` or 24-hour times like `@ 15:00` otherwise
- **Days**: the strip under the header shows the next 7 days. Click a day to view it or to add tasks to it. Days with open tasks get a dot. Tasks from past days roll into Today, marked with their original day
- **Reorder**: drag a task up or down to hand-order the day. Timed tasks still slot in by their time when added; a drag overrides that
- **Complete**: click the ring; done tasks sink to the bottom
- **Edit**: double-click a task's text. Include an `@` chunk to reschedule it
- **Delete**: hover a task and hit the x
- **Filter**: All / Active / Done within the selected day, plus one-click "Clear done"
- **Persistence**: tasks are saved to `localStorage`

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
