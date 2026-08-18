# todo.

A minimal to-do list on a pure black background. Each task gets a flat accent color — yellow, light blue, orange, lime, purple, peach — in rotation. No frameworks, no build step, no dependencies.

## Features

- **Add** — type and hit enter
- **Complete** — click the ring; done tasks sink to the bottom
- **Edit** — double-click a task's text
- **Delete** — hover a task and hit ×
- **Filter** — All / Active / Done, plus one-click "Clear done"
- **Persistence** — tasks are saved to `localStorage`

## Animation details

- Tasks spring open when added and collapse away when removed
- Completing a task fills the ring with its color, draws the checkmark, sweeps a strikethrough, and FLIP-animates it to the bottom of the list
- Filter switching slides a pill indicator and expands/collapses tasks in place
- "Clear done" staggers each task's exit
- Everything respects `prefers-reduced-motion`

## Running

There's no build step — opening `index.html` in a browser works. For a local server:

```sh
npm run dev
```
