"use strict";

const STORAGE_KEY = "todo.items.v1";

const list = document.getElementById("list");
const composer = document.getElementById("composer");
const input = document.getElementById("new-todo");
const enterHint = document.getElementById("enter-hint");
const parseChip = document.getElementById("parse-chip");
const emptyEl = document.getElementById("empty");
const footerEl = document.getElementById("footer");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-done");
const filtersEl = document.getElementById("filters");
const filterIndicator = document.getElementById("filter-indicator");
const daysEl = document.getElementById("days");
const dayIndicator = document.getElementById("day-indicator");
const dateEl = document.getElementById("date");

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
    return raw.map((t, i) => ({
      color: i % PALETTE_SIZE,
      day: todayKey(),
      time: null,
      ...t,
    }));
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// DOM order: open tasks before done, earlier days (overdue) first,
// timed tasks by time before untimed, then creation order.
function sorted() {
  return todos
    .map((t, i) => [t, i])
    .sort(([a, ai], [b, bi]) => {
      if (a.done !== b.done) return a.done - b.done;
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      const at = a.time ?? "~";
      const bt = b.time ?? "~";
      if (at !== bt) return at < bt ? -1 : 1;
      return ai - bi;
    })
    .map(([t]) => t);
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

function parseSpec(spec, defaultDay) {
  let day = null;
  let time = null;
  for (const token of spec.toLowerCase().split(/\s+/)) {
    if (!token) continue;
    if (token === "today") {
      day = todayKey();
    } else if (token === "tomorrow" || token === "tmrw" || token === "tom") {
      day = keyPlus(1);
    } else if (token in WEEKDAYS) {
      day = keyPlus((WEEKDAYS[token] - new Date().getDay() + 7) % 7);
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
  if (day === null && time === null) return null;
  return { day: day ?? defaultDay, time };
}

// Splits "Call the bank @ fri 3pm" into text plus day/time. An @ chunk
// that doesn't parse is left in the text untouched.
function parseInput(raw, defaultDay) {
  const match = raw.match(/(?:^|\s)@([^@]*)$/);
  if (match) {
    const text = raw.slice(0, match.index).trim();
    const parsed = parseSpec(match[1].trim(), defaultDay);
    if (parsed && text) return { text, ...parsed };
  }
  return { text: raw.trim(), day: defaultDay, time: null };
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
        opacity: 0,
        transform: "translateY(-8px) scale(0.98)",
      },
      {
        height: `${height}px`,
        paddingTop: "14px",
        paddingBottom: "14px",
        marginBottom: "8px",
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

/* ---------- Item lifecycle ---------- */

function createNode(todo) {
  const li = document.createElement("li");
  li.className = `item c${todo.color % PALETTE_SIZE}`;
  if (todo.done) li.classList.add("done");

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
  el.textContent = parts.join(" ");
  el.hidden = parts.length === 0;
  el.classList.toggle("overdue", overdue);
}

function addTodo(raw) {
  const { text, day, time } = parseInput(raw, selectedDay);
  const last = todos[todos.length - 1];
  const color = last ? (last.color + 1) % PALETTE_SIZE : 0;
  const todo = { id: Date.now().toString(36), text, done: false, color, day, time };
  todos.push(todo);
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

function toggle(todo, node) {
  todo.done = !todo.done;
  node.classList.toggle("done", todo.done);
  renderWhen(todo);
  save();

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
      // Only reschedule when the edit actually contained an @ chunk.
      if (parsed.text !== value) {
        todo.day = parsed.day;
        todo.time = parsed.time;
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
      finish(e.key === "Enter");
      label.blur();
    }
  };

  label.addEventListener("blur", onBlur);
  label.addEventListener("keydown", onKey);
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

function refreshChrome() {
  const remaining = todos.filter((t) => !t.done && matchesDay(t)).length;
  const label = `${remaining} left`;
  if (countEl.textContent !== label) {
    countEl.textContent = label;
    countEl.classList.remove("tick");
    void countEl.offsetWidth; // restart the pulse animation
    countEl.classList.add("tick");
  }

  footerEl.hidden = todos.length === 0;
  clearBtn.classList.toggle(
    "hidden",
    !todos.some((t) => t.done && matchesDay(t))
  );

  emptyEl.textContent = emptyMessage();
  emptyEl.hidden = todos.some(visibleNow);

  const today = todayKey();
  for (const btn of daysEl.querySelectorAll("button")) {
    const key = btn.dataset.day;
    const has = todos.some(
      (t) => !t.done && (t.day === key || (key === today && t.day < today))
    );
    btn.classList.toggle("has-tasks", has);
  }

  if (!footerEl.hidden) {
    requestAnimationFrame(() => positionIndicator(filtersEl, filterIndicator));
  }
}

/* ---------- Composer wiring ---------- */

function refreshComposerChips() {
  const value = input.value;
  enterHint.classList.toggle("show", value.trim().length > 0);

  const { day, time } = parseInput(value, selectedDay);
  const parts = [];
  if (day !== selectedDay) {
    parts.push(day === todayKey() ? "Today" : weekdayLabel(day));
  }
  if (time) parts.push(formatTime(time));
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
  todos = todos.filter((t) => !done.includes(t));
  save();
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
