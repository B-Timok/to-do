# todo.

A minimal, dark-themed to-do list. No frameworks, no build step, no dependencies — just open `index.html`.

## Features

- **Add** — type and hit enter
- **Complete** — click the ring; done tasks sink to the bottom
- **Edit** — double-click a task's text
- **Delete** — hover a task and hit ×
- **Filter** — All / Active / Done, plus one-click "Clear done"
- **Persistence** — tasks are saved to `localStorage`

## Animation details

- Tasks spring open when added and collapse away when removed
- Completing a task draws the checkmark, sweeps a strikethrough, and FLIP-animates it to the bottom of the list
- Filter switching slides a pill indicator and expands/collapses tasks in place
- "Clear done" staggers each task's exit
- Ambient glows drift slowly behind the page
- Everything respects `prefers-reduced-motion`

## Running

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```
