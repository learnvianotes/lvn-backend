---
id: f1c36e18-139f-7f39-a8e0-bc660554f970
key: topic:javascript/dom-basics
subject: javascript
topic: dom-basics
title: DOM Essentials
slug: dom-essentials
order: 1
---

The DOM (Document Object Model) is the browser's live tree of objects representing the page. JavaScript reads and changes the page by manipulating that tree.

> [!NOTE] Not run here
>
> Node.js has no DOM, so the browser examples in this topic and the next are shown without being executed (they are marked <em>not run</em>). Try them in any browser's DevTools console.

# The tree

`window` → `document` → `<html>` → `<body>` → elements &amp; text nodes

| Concept | Meaning |
| --- | --- |
| Node | Anything in the tree: elements, text, comments (`nodeType` 1, 3, 8) |
| Element | A tag like `<div>` — has attributes, `children`, `classList`… |
| `window` | The global object in browsers: timers, `location`, `history`, `localStorage`, `innerWidth` |
| `document` | Entry point to the page tree |

# Selecting elements

```javascript filename:JavaScript
document.getElementById("app");               // one element or null
document.querySelector(".card > h2");         // first match (any CSS selector)
document.querySelectorAll("li.item");         // static NodeList (has forEach)
document.getElementsByClassName("item");      // LIVE HTMLCollection (updates itself)
element.closest(".card");                     // nearest ancestor matching (incl. itself)
element.matches("button.primary");            // does it match the selector?
```

```text filename:Output
JavaScript (browser, not run)
```

> [!WARNING] Watch out
>
> `querySelectorAll` returns a <em>static</em> snapshot; `getElementsBy*` and `children` are <em>live</em> and change while you loop over them. Convert to an array (`[...list]`) for `map`/`filter`.

# Reading and changing content

```javascript filename:JavaScript
const title = document.querySelector("h1");
title.textContent = "Hello <b>world</b>";     // plain text — safe
title.innerHTML = "Hello <b>world</b>";       // parses HTML — XSS risk with user input!
title.classList.add("active");                // also remove / toggle / contains / replace
title.style.color = "tomato";                 // inline style (camelCase properties)
title.setAttribute("aria-label", "Greeting");
title.dataset.userId = "42";                  // → data-user-id="42"
const input = document.querySelector("input");
input.value;                                  // current value (property) vs getAttribute("value") (initial)
```

```text filename:Output
JavaScript (browser, not run)
```

# Creating, inserting, removing

```javascript filename:JavaScript
const list = document.querySelector("#todo");
const frag = document.createDocumentFragment();   // batch inserts → one reflow
for (const text of ["Learn DOM", "Build app"]) {
  const li = document.createElement("li");
  li.textContent = text;
  frag.append(li);
}
list.append(frag);                    // also prepend / before / after / replaceWith
list.insertAdjacentHTML("beforeend", "<li>Ship</li>");
list.firstElementChild.remove();
```

```text filename:Output
JavaScript (browser, not run)
```

# Script loading and page lifecycle

| Tag / event | Behaviour |
| --- | --- |
| `<script>` | Blocks HTML parsing while it downloads and runs |
| `<script defer>` | Downloads in parallel; runs in order after parsing, before `DOMContentLoaded` |
| `<script async>` | Downloads in parallel; runs as soon as it arrives (order not guaranteed) |
| `<script type="module">` | Deferred by default, strict mode, supports `import` |
| `DOMContentLoaded` | HTML parsed, DOM ready (images may still be loading) |
| `load` | Everything loaded, including images and stylesheets |

# Performance: reflow and repaint

- Changing geometry (size, position, adding nodes) triggers <strong>layout/reflow</strong>; colours only trigger <strong>repaint</strong>.
- Reading layout (`offsetHeight`, `getBoundingClientRect`) right after writing forces a synchronous reflow — batch reads, then writes (<em>layout thrashing</em>).
- Animate `transform` and `opacity` (compositor-only) and use `requestAnimationFrame` for visual updates.

```question
textContent vs innerText vs innerHTML?

---

`textContent` gets/sets raw text of all nodes (fast, no layout). `innerText` returns <em>rendered</em> text (respects CSS, triggers layout). `innerHTML` parses/serialises HTML — never assign untrusted input to it (XSS).
```

```question
defer vs async?

---

Both download without blocking parsing. `defer` scripts execute in document order after parsing finishes; `async` scripts execute as soon as they download, in any order. Use `defer` for app code, `async` for independent scripts like analytics.
```
