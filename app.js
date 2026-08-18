"use strict";

const STORAGE_KEY = "todo.items.v1";

const list = document.getElementById("list");
const composer = document.getElementById("composer");
const input = document.getElementById("new-todo");
const enterHint = document.getElementById("enter-hint");
const parseChip = document.getElementById("parse-chip");
const emptyEl = document.getElementById("empty");
const footerEl = document.getElementById("footer");
const clearBtn = document.getElementById("clear-done");
const filtersEl = document.getElementById("filters");
const filterIndicator = document.getElementById("filter-indicator");
const daysEl = document.getElementById("days");
const dayIndicator = document.getElementById("day-indicator");
const dateEl = document.getElementById("date");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toastUndo = document.getElementById("toast-undo");

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const PALETTE_SIZE = 6;

const WEEKDAYS = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/* ---------- Dates ---------- */

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return toKey(new Date());
}

function keyPlus(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toKey(d);
}

function dateOf(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekdayLabel(key) {
  return dateOf(key).toLocaleDateString(undefined, { weekday: "short" });
}

function formatTime(time) {
  const [h, min] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return min ? `${h12}:${String(min).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/* ---------- State ---------- */

let todos = load();
let filter = "all";
let selectedDay = todayKey();
const nodes = new Map(); // todo id -> <li>

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(raw)) return [];
    const items = raw.map((t, i) => ({
      color: i % PALETTE_SIZE,
      day: todayKey(),
      time: null,
      repeat: null,
      ...t,
    }));
    // Items saved before manual ordering existed get numbered by the old
    // implicit sort: within a day, timed before untimed, then creation.
    if (items.some((t) => typeof t.order !== "number")) {
      const counters = {};
      items
        .map((t, i) => [t, i])
        .sort(([a, ai], [b, bi]) => {
          if (a.day !== b.day) return a.day < b.day ? -1 : 1;
          if (a.done !== b.done) return a.done - b.done;
          const at = a.time ?? "~";
          const bt = b.time ?? "~";
          if (at !== bt) return at < bt ? -1 : 1;
          return ai - bi;
        })
        .forEach(([t]) => {
          t.order = counters[t.day] = (counters[t.day] ?? -1) + 1;
        });
    }
    return items;
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// DOM order: open tasks before done, earlier days (overdue) first, then
// each day's manual order (times only pick the initial slot on add).
function sorted() {
  return todos
    .map((t, i) => [t, i])
    .sort(([a, ai], [b, bi]) => {
      if (a.done !== b.done) return a.done - b.done;
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return ai - bi;
    })
    .map(([t]) => t);
}

// Slot a task into its day's open list: timed tasks before the first
// later-timed task (untimed count as latest), untimed at the end. The
// whole day is renumbered so drag commits stay simple integers.
function assignOrder(todo) {
  const dayActives = sorted().filter(
    (t) => t !== todo && !t.done && t.day === todo.day
  );
  let idx = dayActives.length;
  if (todo.time) {
    const later = dayActives.findIndex((t) => (t.time ?? "~") > todo.time);
    if (later !== -1) idx = later;
  }
  dayActives.splice(idx, 0, todo);
  dayActives.forEach((t, i) => {
    t.order = i;
  });
}

function matchesDay(todo) {
  if (todo.day === selectedDay) return true;
  // Tasks from past days roll into Today rather than disappearing.
  const today = todayKey();
  return selectedDay === today && todo.day < today;
}

function matchesFilter(todo) {
  if (filter === "active") return !todo.done;
  if (filter === "done") return todo.done;
  return true;
}

function visibleNow(todo) {
  return matchesDay(todo) && matchesFilter(todo);
}

/* ---------- @ parsing ---------- */

function weekdayKey(name) {
  return keyPlus((WEEKDAYS[name] - new Date().getDay() + 7) % 7);
}

function parseSpec(spec, defaultDay) {
  let day = null;
  let time = null;
  let repeat = null;
  const tokens = spec.toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "today") {
      day = todayKey();
    } else if (token === "tomorrow" || token === "tmrw" || token === "tom") {
      day = keyPlus(1);
    } else if (token in WEEKDAYS) {
      day = weekdayKey(token);
    } else if (token === "daily") {
      repeat = "daily";
    } else if (token === "weekly") {
      repeat = "weekly";
    } else if (token === "weekdays") {
      repeat = "weekdays";
    } else if (token === "every") {
      const next = tokens[++i];
      if (next === "day") repeat = "daily";
      else if (next === "week") repeat = "weekly";
      else if (next === "weekday") repeat = "weekdays";
      else if (next in WEEKDAYS) {
        repeat = "weekly";
        day = weekdayKey(next);
      } else return null;
    } else {
      const m = token.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
      if (!m) return null;
      let h = Number(m[1]);
      const min = Number(m[2] ?? 0);
      if (h > 23 || min > 59) return null;
      if (m[3] === "pm" && h < 12) h += 12;
      else if (m[3] === "am" && h === 12) h = 0;
      else if (!m[3] && !m[2] && h >= 1 && h <= 7) h += 12; // bare "3" reads as 3pm
      time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }
  if (day === null && time === null && repeat === null) return null;
  return { day: day ?? defaultDay, time, repeat };
}

// Splits "Call the bank @ fri 3pm" into text plus day/time/repeat. An @
// chunk that doesn't parse is left in the text untouched.
function parseInput(raw, defaultDay) {
  const match = raw.match(/(?:^|\s)@([^@]*)$/);
  if (match) {
    const text = raw.slice(0, match.index).trim();
    const parsed = parseSpec(match[1].trim(), defaultDay);
    if (parsed && text) return { text, ...parsed };
  }
  return { text: raw.trim(), day: defaultDay, time: null, repeat: null };
}

// First matching day strictly after the task's day (or today if the task
// is overdue): daily is the next day, weekly the same weekday next time,
// weekdays the next Monday-to-Friday day.
function nextOccurrence(todo) {
  const anchor = dateOf(todo.day).getDay();
  const today = todayKey();
  const d = dateOf(todo.day > today ? todo.day : today);
  do {
    d.setDate(d.getDate() + 1);
  } while (
    (todo.repeat === "weekly" && d.getDay() !== anchor) ||
    (todo.repeat === "weekdays" && (d.getDay() === 0 || d.getDay() === 6))
  );
  return toKey(d);
}

function friendlyDay(key) {
  if (key === todayKey()) return "Today";
  if (key === keyPlus(1)) return "Tomorrow";
  return weekdayLabel(key);
}

/* ---------- Animation helpers ---------- */

function expand(node) {
  node.getAnimations().forEach((a) => a.cancel());
  delete node.dataset.vis;
  node.hidden = false;
  if (reduceMotion.matches) return;
  const height = node.offsetHeight;
  node.animate(
    [
      {
        height: "0px",
        paddingTop: "0px",
        paddingBottom: "0px",
        marginBottom: "0px",
        borderTopWidth: "0px",
        borderBottomWidth: "0px",
        opacity: 0,
        transform: "translateY(-8px) scale(0.98)",
      },
      {
        height: `${height}px`,
        paddingTop: "14px",
        paddingBottom: "14px",
        marginBottom: "8px",
        borderTopWidth: "2px",
        borderBottomWidth: "2px",
        opacity: 1,
        transform: "none",
      },
    ],
    { duration: 320, easing: EASE_OUT }
  );
}

function collapse(node, { slide = false } = {}) {
  if (reduceMotion.matches) return Promise.resolve();
  const height = node.offsetHeight;
  const animation = node.animate(
    [
      { height: `${height}px`, opacity: 1, transform: "none", offset: 0 },
      {
        opacity: 0,
        transform: slide ? "translateX(32px)" : "none",
        offset: 0.55,
      },
      {
        height: "0px",
        paddingTop: "0px",
        paddingBottom: "0px",
        marginBottom: "0px",
        borderTopWidth: "0px",
        borderBottomWidth: "0px",
        opacity: 0,
        transform: slide ? "translateX(32px)" : "none",
        offset: 1,
      },
    ],
    { duration: 340, easing: EASE_OUT, fill: "forwards" }
  );
  // A cancelled animation (e.g. the view flipped back mid-collapse and
  // expand() took over) rejects `finished`; treat that as a quiet no-op.
  return animation.finished.catch(() => {});
}

function applyOrder() {
  for (const todo of sorted()) list.appendChild(nodes.get(todo.id));
}

// Reorder visible items to match sorted() order, animating position changes.
function reorderWithFlip() {
  const visible = [...list.children].filter(
    (n) => !n.hidden && n.dataset.vis !== "hiding"
  );
  const before = new Map(visible.map((n) => [n, n.getBoundingClientRect().top]));
  applyOrder();
  if (reduceMotion.matches) return;
  for (const node of visible) {
    const delta = before.get(node) - node.getBoundingClientRect().top;
    if (delta) {
      node.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
        { duration: 380, easing: EASE_OUT }
      );
    }
  }
}

// Collapse a node and mark it hidden, unless expand() reclaims it while
// the animation is still running (the "hiding" flag is how they hand off).
function hideAway(node) {
  node.dataset.vis = "hiding";
  return collapse(node).then(() => {
    if (node.dataset.vis === "hiding") {
      node.hidden = true;
      delete node.dataset.vis;
    }
  });
}

// Expand/collapse items so the list matches the selected day and filter.
function refreshVisibility() {
  for (const todo of todos) {
    const node = nodes.get(todo.id);
    const shouldShow = visibleNow(todo);
    const showing = !node.hidden && node.dataset.vis !== "hiding";
    if (shouldShow && !showing) {
      expand(node);
    } else if (!shouldShow && showing) {
      hideAway(node);
    }
  }
  refreshChrome();
}

/* ---------- Undo ---------- */

const undoStack = [];
let toastTimer = null;

function showToast(message) {
  toastMsg.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.classList.remove("show");
}

function pushUndo(entry, message) {
  undoStack.push(entry);
  if (undoStack.length > 20) undoStack.shift();
  showToast(message);
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  let follow;
  if (entry.kind === "delete") {
    todos.push(...entry.todos);
    for (const todo of entry.todos) {
      const node = createNode(todo);
      node.hidden = true;
      list.appendChild(node);
    }
    follow = entry.todos;
  } else {
    // "roll": put a repeating task back on the day it was completed from.
    const todo = entry.todo;
    todo.done = false;
    todo.day = entry.day;
    todo.order = entry.order;
    nodes.get(todo.id).classList.remove("done");
    renderWhen(todo);
    follow = [todo];
  }
  save();
  applyOrder();
  // If the restored tasks live outside the current view, follow them.
  if (!follow.some(visibleNow)) {
    const first = follow[0];
    if (!matchesDay(first)) setDayState(first.day);
    if (!matchesFilter(first)) setFilterState("all");
  }
  refreshVisibility();
  hideToast();
}

function undoLabel(todo) {
  const text =
    todo.text.length > 28 ? todo.text.slice(0, 28).trimEnd() + "..." : todo.text;
  return `Deleted "${text}"`;
}

/* ---------- Item lifecycle ---------- */

function createNode(todo) {
  const li = document.createElement("li");
  li.className = `item c${todo.color % PALETTE_SIZE}`;
  li.dataset.id = todo.id;
  if (todo.done) li.classList.add("done");
  li.addEventListener("pointerdown", (e) => initDrag(todo, li, e));

  const check = document.createElement("button");
  check.className = "check";
  check.setAttribute("aria-label", "Toggle done");
  check.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
  check.addEventListener("click", () => toggle(todo, li));

  const text = document.createElement("span");
  text.className = "text";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = todo.text;
  label.title = "Double-click to edit";
  label.addEventListener("dblclick", () => startEdit(todo, li, label));
  text.append(label);

  const when = document.createElement("span");
  when.className = "when";

  const del = document.createElement("button");
  del.className = "delete";
  del.setAttribute("aria-label", "Delete task");
  del.textContent = "×";
  del.addEventListener("click", () => remove(todo, li));

  li.append(check, text, when, del);
  nodes.set(todo.id, li);
  renderWhen(todo);
  return li;
}

function renderWhen(todo) {
  const el = nodes.get(todo.id).querySelector(".when");
  const overdue = !todo.done && todo.day < todayKey();
  const parts = [];
  if (overdue) parts.push(weekdayLabel(todo.day));
  if (todo.time) parts.push(formatTime(todo.time));
  if (todo.repeat) parts.push("↻");
  el.textContent = parts.join(" ");
  el.hidden = parts.length === 0;
  el.classList.toggle("overdue", overdue);
  el.title = todo.repeat ? `Repeats ${todo.repeat}` : "";
}

function addTodo(raw) {
  const { text, day, time, repeat } = parseInput(raw, selectedDay);
  const last = todos[todos.length - 1];
  const color = last ? (last.color + 1) % PALETTE_SIZE : 0;
  const todo = {
    id: Date.now().toString(36),
    text,
    done: false,
    color,
    day,
    time,
    repeat,
    order: 0,
  };
  todos.push(todo);
  assignOrder(todo);
  save();

  const node = createNode(todo);
  node.hidden = true;
  list.appendChild(node);
  applyOrder();

  // Follow the task so it never lands somewhere invisible.
  if (filter === "done") setFilterState("all");
  if (day !== selectedDay) setDayState(day);
  refreshVisibility();
}

const rollTimers = new Map(); // todo id -> pending recurrence roll

function toggle(todo, node) {
  clearTimeout(rollTimers.get(todo.id));
  rollTimers.delete(todo.id);

  todo.done = !todo.done;
  node.classList.toggle("done", todo.done);
  renderWhen(todo);
  save();

  // Completing a repeating task lets the check play, then rolls it
  // forward to its next occurrence instead of leaving it done. Toggling
  // again inside the pause cancels the roll.
  if (todo.repeat && todo.done) {
    rollTimers.set(
      todo.id,
      setTimeout(() => {
        rollTimers.delete(todo.id);
        const entry = { kind: "roll", todo, day: todo.day, order: todo.order };
        const next = nextOccurrence(todo);
        todo.done = false;
        todo.day = next;
        assignOrder(todo);
        save();
        node.classList.remove("done");
        renderWhen(todo);
        pushUndo(entry, `Done. Next: ${friendlyDay(next)}`);
        if (visibleNow(todo)) {
          reorderWithFlip();
          refreshChrome();
        } else {
          hideAway(node).then(() => {
            applyOrder();
            refreshChrome();
          });
        }
      }, reduceMotion.matches ? 0 : 650)
    );
    refreshChrome();
    return;
  }

  if (visibleNow(todo)) {
    reorderWithFlip();
    refreshChrome();
  } else {
    // Let the check animation play before the item slips away.
    setTimeout(async () => {
      if (visibleNow(todo)) {
        // The view changed during the pause and the item belongs here now.
        reorderWithFlip();
      } else {
        await hideAway(node);
        applyOrder();
      }
      refreshChrome();
    }, reduceMotion.matches ? 0 : 350);
  }
}

async function remove(todo, node) {
  todos = todos.filter((t) => t !== todo);
  nodes.delete(todo.id);
  save();
  pushUndo({ kind: "delete", todos: [todo] }, undoLabel(todo));
  await collapse(node, { slide: true });
  node.remove();
  refreshChrome();
}

function startEdit(todo, li, label) {
  if (label.isContentEditable) return;
  const original = todo.text;
  label.contentEditable = "true";
  label.focus();
  getSelection().selectAllChildren(label);

  const finish = (commit) => {
    label.contentEditable = "false";
    label.removeEventListener("blur", onBlur);
    label.removeEventListener("keydown", onKey);
    const value = label.textContent.trim();
    if (commit && value) {
      const parsed = parseInput(value, todo.day);
      todo.text = parsed.text;
      // Only reschedule when the edit actually contained an @ chunk;
      // the chunk replaces the whole schedule, repeat included.
      if (parsed.text !== value) {
        todo.day = parsed.day;
        todo.time = parsed.time;
        todo.repeat = parsed.repeat;
        assignOrder(todo);
      }
      label.textContent = todo.text;
      renderWhen(todo);
      save();
      reorderWithFlip();
      refreshVisibility();
    } else if (commit && !value) {
      remove(todo, li);
    } else {
      label.textContent = original;
    }
  };
  const onBlur = () => finish(true);
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      // finish() ends editing before this event reaches the global
      // keyboard handler, which would otherwise act on the same press.
      e.stopPropagation();
      finish(e.key === "Enter");
      label.blur();
    }
  };

  label.addEventListener("blur", onBlur);
  label.addEventListener("keydown", onKey);
}

/* ---------- Keyboard selection ---------- */

let selectedId = null;

function visibleNodes() {
  return [...list.children].filter(
    (n) => !n.hidden && n.dataset.vis !== "hiding"
  );
}

function setSelected(id) {
  selectedId = id;
  for (const n of list.children) {
    n.classList.toggle("selected", id !== null && n.dataset.id === id);
  }
  if (id) {
    nodes.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function selectedTodo() {
  return todos.find((t) => t.id === selectedId) ?? null;
}

// Swap the selected task with its neighbor in the day's manual order.
function nudgeSelected(dir) {
  const todo = selectedTodo();
  if (!todo || todo.done) return;
  const seq = sorted().filter((t) => !t.done && t.day === todo.day);
  const i = seq.indexOf(todo);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= seq.length) return;
  [seq[i], seq[j]] = [seq[j], seq[i]];
  seq.forEach((t, k) => {
    t.order = k;
  });
  save();
  reorderWithFlip();
}

function cycleFilter() {
  const order = ["all", "active", "done"];
  setFilter(order[(order.indexOf(filter) + 1) % order.length]);
}

addEventListener("keydown", (e) => {
  const typing = e.target === input || e.target.isContentEditable;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    if (typing) return; // leave text-field undo to the browser
    e.preventDefault();
    undo();
    return;
  }

  if (typing) {
    // Arrow down from an empty composer drops into the list.
    if (e.target === input && e.key === "ArrowDown" && !input.value) {
      const first = visibleNodes()[0];
      if (first) {
        e.preventDefault();
        input.blur();
        setSelected(first.dataset.id);
      }
    }
    return;
  }
  if (e.ctrlKey || e.metaKey) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const dir = e.key === "ArrowDown" ? 1 : -1;
    if (e.altKey) {
      nudgeSelected(dir);
      return;
    }
    const items = visibleNodes();
    if (!items.length) return;
    const idx = items.findIndex((n) => n.dataset.id === selectedId);
    const next =
      idx === -1
        ? dir === 1
          ? 0
          : items.length - 1
        : Math.max(0, Math.min(items.length - 1, idx + dir));
    setSelected(items[next].dataset.id);
    return;
  }

  const onButton = !!e.target.closest("button");
  const todo = selectedTodo();
  switch (e.key) {
    case "Enter":
    case " ": {
      if (onButton || !todo) return; // buttons keep their native activation
      e.preventDefault();
      const items = visibleNodes();
      const idx = items.findIndex((n) => n.dataset.id === selectedId);
      toggle(todo, nodes.get(todo.id));
      // If the toggle will hide the task from this view, step the
      // selection to whichever neighbor takes its place.
      if (!matchesFilter(todo)) {
        const next = items[idx + 1] ?? items[idx - 1];
        setSelected(next ? next.dataset.id : null);
      }
      return;
    }
    case "e":
      if (todo) {
        e.preventDefault();
        const node = nodes.get(todo.id);
        startEdit(todo, node, node.querySelector(".label"));
      }
      return;
    case "Backspace":
    case "Delete": {
      if (!todo) return;
      e.preventDefault();
      const items = visibleNodes();
      const idx = items.findIndex((n) => n.dataset.id === selectedId);
      const next = items[idx + 1] ?? items[idx - 1];
      remove(todo, nodes.get(todo.id));
      setSelected(next ? next.dataset.id : null);
      return;
    }
    case "Escape":
      setSelected(null);
      return;
    case "n":
    case "/":
      e.preventDefault();
      input.focus();
      return;
    case "f":
      e.preventDefault();
      cycleFilter();
      return;
    default:
      if (/^[1-7]$/.test(e.key)) setDay(keyPlus(Number(e.key) - 1));
  }
});

/* ---------- Drag to reorder ---------- */

const DRAG_THRESHOLD = 6;
const ITEM_GAP = 8; // matches .item margin-bottom

function dragCandidates() {
  return [...list.children].filter(
    (n) =>
      !n.hidden && n.dataset.vis !== "hiding" && !n.classList.contains("done")
  );
}

function initDrag(todo, li, e) {
  setSelected(todo.id); // pointer and keyboard share one selection
  if (e.button !== 0 || e.pointerType === "touch") return; // touch keeps scrolling
  if (todo.done) return;
  if (e.target.closest("button") || e.target.isContentEditable) return;
  e.preventDefault(); // stop text selection from swallowing the gesture

  const startY = e.clientY;
  const pointerId = e.pointerId;
  let started = false;
  let items = [];
  let origIndex = 0;
  let tops = [];
  let heights = [];
  let minOffset = 0;
  let maxOffset = 0;

  const onMove = (ev) => {
    if (ev.pointerId !== pointerId) return;
    const offset = ev.clientY - startY;
    if (!started) {
      if (Math.abs(offset) < DRAG_THRESHOLD) return;
      started = true;
      items = dragCandidates();
      origIndex = items.indexOf(li);
      if (origIndex === -1) {
        cleanup();
        return;
      }
      li.setPointerCapture(pointerId);
      tops = items.map((n) => n.getBoundingClientRect().top);
      heights = items.map((n) => n.offsetHeight);
      // The extra pixel keeps the strict center comparisons decisive when
      // the drag is clamped flush against either end of the list.
      minOffset = tops[0] - tops[origIndex] - 1;
      maxOffset =
        tops[items.length - 1] +
        heights[items.length - 1] -
        (tops[origIndex] + heights[origIndex]) +
        1;
      li.classList.add("dragging");
      document.body.classList.add("is-dragging");
    }
    const clamped = Math.min(maxOffset, Math.max(minOffset, offset));
    li.style.transform = `translateY(${clamped}px)`;
    const center = tops[origIndex] + heights[origIndex] / 2 + clamped;
    for (let i = 0; i < items.length; i++) {
      if (i === origIndex) continue;
      const sibCenter = tops[i] + heights[i] / 2;
      let shift = 0;
      if (i < origIndex && center < sibCenter) {
        shift = heights[origIndex] + ITEM_GAP;
      } else if (i > origIndex && center > sibCenter) {
        shift = -(heights[origIndex] + ITEM_GAP);
      }
      items[i].style.transform = shift ? `translateY(${shift}px)` : "";
    }
  };

  const finish = (commit) => {
    cleanup();
    if (!started) return;
    document.body.classList.remove("is-dragging");
    if (commit) {
      const center = li.getBoundingClientRect().top + li.offsetHeight / 2;
      let newIndex = 0;
      for (let i = 0; i < items.length; i++) {
        if (i === origIndex) continue;
        if (tops[i] + heights[i] / 2 < center) newIndex++;
      }
      const seq = items.map((n) => todos.find((t) => t.id === n.dataset.id));
      const [dragged] = seq.splice(origIndex, 1);
      seq.splice(newIndex, 0, dragged);
      seq.forEach((t, i) => {
        t.order = i;
      });
      save();
    }
    // Settle: snapshot where everything is, clear drag styles, put the DOM
    // in its committed order, then FLIP from the snapshot into place.
    const before = new Map(
      items.map((n) => [n, n.getBoundingClientRect().top])
    );
    for (const n of items) n.style.transform = "";
    li.classList.remove("dragging");
    applyOrder();
    if (reduceMotion.matches) return;
    for (const n of items) {
      const delta = before.get(n) - n.getBoundingClientRect().top;
      if (delta) {
        n.animate(
          [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
          { duration: 250, easing: EASE_OUT }
        );
      }
    }
  };

  const onUp = (ev) => {
    if (ev.pointerId === pointerId) finish(true);
  };
  const onCancel = (ev) => {
    if (ev.pointerId === pointerId) finish(false);
  };
  const cleanup = () => {
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onCancel);
  };

  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onCancel);
}

/* ---------- Day strip and filters ---------- */

function buildDays() {
  for (let i = 0; i < 7; i++) {
    const key = keyPlus(i);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.day = key;

    const dow = document.createElement("span");
    dow.className = "dow";
    dow.textContent = i === 0 ? "Today" : weekdayLabel(key);
    const dom = document.createElement("span");
    dom.className = "dom";
    dom.textContent = String(dateOf(key).getDate());

    btn.append(dow, dom);
    btn.addEventListener("click", () => setDay(key));
    daysEl.appendChild(btn);
  }
}

function positionIndicator(container, indicator) {
  const active = container.querySelector("button.active");
  if (!active) return;
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.translate = `${active.offsetLeft}px 0`;
}

function setDayState(key) {
  selectedDay = key;
  for (const btn of daysEl.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.day === key);
  }
  positionIndicator(daysEl, dayIndicator);
}

function setDay(key) {
  if (key === selectedDay) return;
  setDayState(key);
  refreshVisibility();
}

function setFilterState(next) {
  filter = next;
  for (const btn of filtersEl.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  }
  positionIndicator(filtersEl, filterIndicator);
}

function setFilter(next) {
  if (next === filter) return;
  setFilterState(next);
  refreshVisibility();
}

/* ---------- Chrome (count, empty state, footer, day dots) ---------- */

function emptyMessage() {
  if (filter === "active") return "All caught up.";
  if (filter === "done") return "Nothing checked off yet.";
  return selectedDay === todayKey()
    ? "Nothing here yet. Add your first task above."
    : "Nothing planned for this day yet.";
}

// Slide the empty-state message open or closed so the footer below it
// moves with the same rhythm as the list items.
function setEmptyVisible(show) {
  const showing = !emptyEl.hidden && emptyEl.dataset.vis !== "hiding";
  if (show === showing) return;
  emptyEl.getAnimations().forEach((a) => a.cancel());
  if (show) {
    delete emptyEl.dataset.vis;
    emptyEl.hidden = false;
    if (reduceMotion.matches) return;
    const height = emptyEl.offsetHeight;
    emptyEl.animate(
      [
        { height: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 },
        {
          height: `${height}px`,
          paddingTop: "40px",
          paddingBottom: "32px",
          opacity: 1,
        },
      ],
      { duration: 320, easing: EASE_OUT, delay: 120, fill: "backwards" }
    );
  } else if (reduceMotion.matches) {
    emptyEl.hidden = true;
  } else {
    emptyEl.dataset.vis = "hiding";
    const height = emptyEl.offsetHeight;
    const animation = emptyEl.animate(
      [
        {
          height: `${height}px`,
          paddingTop: "40px",
          paddingBottom: "32px",
          opacity: 1,
        },
        { height: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 },
      ],
      { duration: 200, easing: EASE_OUT, fill: "forwards" }
    );
    animation.finished
      .then(() => {
        if (emptyEl.dataset.vis === "hiding") {
          emptyEl.hidden = true;
          delete emptyEl.dataset.vis;
        }
      })
      .catch(() => {});
  }
}

function refreshChrome() {
  footerEl.hidden = todos.length === 0;
  clearBtn.classList.toggle(
    "hidden",
    !todos.some((t) => t.done && matchesDay(t))
  );

  emptyEl.textContent = emptyMessage();
  setEmptyVisible(!todos.some(visibleNow));

  const today = todayKey();
  for (const btn of daysEl.querySelectorAll("button")) {
    const key = btn.dataset.day;
    const has = todos.some(
      (t) => !t.done && (t.day === key || (key === today && t.day < today))
    );
    btn.classList.toggle("has-tasks", has);
  }

  if (selectedId) {
    const node = nodes.get(selectedId);
    if (!node || node.hidden || node.dataset.vis === "hiding") {
      setSelected(null);
    }
  }

  if (!footerEl.hidden) {
    requestAnimationFrame(() => positionIndicator(filtersEl, filterIndicator));
  }
}

/* ---------- Composer wiring ---------- */

function refreshComposerChips() {
  const value = input.value;
  enterHint.classList.toggle("show", value.trim().length > 0);

  const { day, time, repeat } = parseInput(value, selectedDay);
  const parts = [];
  if (day !== selectedDay) {
    parts.push(day === todayKey() ? "Today" : weekdayLabel(day));
  }
  if (time) parts.push(formatTime(time));
  if (repeat) parts.push(`↻ ${repeat}`);
  parseChip.textContent = parts.join(" ");
  parseChip.classList.toggle("show", parts.length > 0);
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = input.value;
  if (!raw.trim()) return;
  addTodo(raw);
  input.value = "";
  refreshComposerChips();
});

input.addEventListener("input", refreshComposerChips);

input.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    input.value = "";
    refreshComposerChips();
  }
});

filtersEl.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-filter]");
  if (button) setFilter(button.dataset.filter);
});

clearBtn.addEventListener("click", () => {
  const done = todos.filter((t) => t.done && matchesDay(t));
  if (!done.length) return;
  todos = todos.filter((t) => !done.includes(t));
  save();
  pushUndo(
    { kind: "delete", todos: done },
    done.length === 1 ? undoLabel(done[0]) : `Cleared ${done.length} done tasks`
  );
  done.forEach((todo, i) => {
    const node = nodes.get(todo.id);
    nodes.delete(todo.id);
    setTimeout(async () => {
      await collapse(node, { slide: true });
      node.remove();
      if (i === done.length - 1) refreshChrome();
    }, reduceMotion.matches ? 0 : i * 50);
  });
  refreshChrome();
});

toastUndo.addEventListener("click", undo);

addEventListener("resize", () => {
  positionIndicator(daysEl, dayIndicator);
  positionIndicator(filtersEl, filterIndicator);
});

/* ---------- Init ---------- */

dateEl.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

buildDays();
setDayState(todayKey());
for (const todo of sorted()) {
  const node = createNode(todo);
  node.hidden = !visibleNow(todo);
  list.appendChild(node);
}
refreshChrome();
requestAnimationFrame(() => positionIndicator(daysEl, dayIndicator));
input.focus();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
