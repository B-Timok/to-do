"use strict";

const STORAGE_KEY = "todo.items.v1";

const list = document.getElementById("list");
const composer = document.getElementById("composer");
const input = document.getElementById("new-todo");
const enterHint = document.getElementById("enter-hint");
const emptyEl = document.getElementById("empty");
const footerEl = document.getElementById("footer");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-done");
const filtersEl = document.getElementById("filters");
const indicator = document.getElementById("filter-indicator");
const dateEl = document.getElementById("date");

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

let todos = load();
let filter = "all";
const nodes = new Map(); // todo id -> <li>

const EMPTY_MESSAGES = {
  all: "Nothing here yet — add your first task above.",
  active: "All caught up ✨",
  done: "Nothing checked off yet.",
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// Active tasks first, completed sink to the bottom; creation order within each.
function sorted() {
  return [...todos.filter((t) => !t.done), ...todos.filter((t) => t.done)];
}

function matchesFilter(todo) {
  if (filter === "active") return !todo.done;
  if (filter === "done") return todo.done;
  return true;
}

/* ---------- Animation helpers ---------- */

function expand(node) {
  node.getAnimations().forEach((a) => a.cancel());
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
  // A cancelled animation (e.g. the filter flipped back mid-collapse and
  // expand() took over) rejects `finished`; treat that as a quiet no-op.
  return animation.finished.catch(() => {});
}

// Reorder visible items to match sorted() order, animating position changes.
function reorderWithFlip() {
  const visible = [...list.children].filter((n) => !n.hidden);
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

function applyOrder() {
  for (const todo of sorted()) list.appendChild(nodes.get(todo.id));
}

/* ---------- Item lifecycle ---------- */

function createNode(todo) {
  const li = document.createElement("li");
  li.className = "item";
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

  const del = document.createElement("button");
  del.className = "delete";
  del.setAttribute("aria-label", "Delete task");
  del.textContent = "×";
  del.addEventListener("click", () => remove(todo, li));

  li.append(check, text, del);
  nodes.set(todo.id, li);
  return li;
}

function addTodo(text) {
  const todo = { id: Date.now().toString(36), text, done: false };
  todos.push(todo);
  save();

  // Adding while viewing "Done" would hide the new task — jump back to "All".
  if (filter === "done") setFilter("all");

  const node = createNode(todo);
  const firstDone = [...list.children].find((n) =>
    n.classList.contains("done")
  );
  list.insertBefore(node, firstDone ?? null);
  expand(node);
  refreshChrome();
}

function toggle(todo, node) {
  todo.done = !todo.done;
  node.classList.toggle("done", todo.done);
  save();

  if (matchesFilter(todo)) {
    reorderWithFlip();
    refreshChrome();
  } else {
    // Let the check animation play before the item slips away.
    setTimeout(async () => {
      await collapse(node);
      if (!matchesFilter(todo)) {
        node.hidden = true;
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

function startEdit(todo, li, text) {
  if (text.isContentEditable) return;
  const original = todo.text;
  text.contentEditable = "true";
  text.focus();
  getSelection().selectAllChildren(text);

  const finish = (commit) => {
    text.contentEditable = "false";
    text.removeEventListener("blur", onBlur);
    text.removeEventListener("keydown", onKey);
    const value = text.textContent.trim();
    if (commit && value) {
      todo.text = value;
      text.textContent = value;
      save();
    } else if (commit && !value) {
      remove(todo, li);
    } else {
      text.textContent = original;
    }
  };
  const onBlur = () => finish(true);
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      finish(e.key === "Enter");
      text.blur();
    }
  };

  text.addEventListener("blur", onBlur);
  text.addEventListener("keydown", onKey);
}

/* ---------- Filters ---------- */

function setFilter(next) {
  if (next === filter) return;
  filter = next;

  for (const button of filtersEl.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.filter === filter);
  }
  moveIndicator();

  for (const todo of todos) {
    const node = nodes.get(todo.id);
    const shouldShow = matchesFilter(todo);
    if (shouldShow && node.hidden) {
      expand(node);
    } else if (!shouldShow && !node.hidden) {
      collapse(node).then(() => {
        // The filter may have changed again mid-animation.
        if (!matchesFilter(todo)) node.hidden = true;
      });
    }
  }
  refreshChrome();
}

function moveIndicator() {
  const active = filtersEl.querySelector("button.active");
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.translate = `${active.offsetLeft}px 0`;
}

/* ---------- Chrome (count, empty state, footer) ---------- */

function refreshChrome() {
  const remaining = todos.filter((t) => !t.done).length;
  const label = `${remaining} left`;
  if (countEl.textContent !== label) {
    countEl.textContent = label;
    countEl.classList.remove("tick");
    void countEl.offsetWidth; // restart the pulse animation
    countEl.classList.add("tick");
  }

  footerEl.hidden = todos.length === 0;
  clearBtn.classList.toggle("hidden", remaining === todos.length);

  const anyVisible = todos.some(matchesFilter);
  emptyEl.textContent = EMPTY_MESSAGES[filter];
  emptyEl.hidden = anyVisible;

  if (!footerEl.hidden) requestAnimationFrame(moveIndicator);
}

/* ---------- Wiring ---------- */

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addTodo(text);
  input.value = "";
  enterHint.classList.remove("show");
});

input.addEventListener("input", () => {
  enterHint.classList.toggle("show", input.value.trim().length > 0);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    input.value = "";
    enterHint.classList.remove("show");
  }
});

filtersEl.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-filter]");
  if (button) setFilter(button.dataset.filter);
});

clearBtn.addEventListener("click", () => {
  const done = todos.filter((t) => t.done);
  todos = todos.filter((t) => !t.done);
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

addEventListener("resize", moveIndicator);

/* ---------- Init ---------- */

dateEl.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

for (const todo of sorted()) {
  const node = createNode(todo);
  node.hidden = !matchesFilter(todo);
  list.appendChild(node);
}
refreshChrome();
input.focus();
