---
id: 9759f467-b531-7df3-bffb-4e9c94d3970b
key: topic:javascript/dom-events
subject: javascript
topic: dom-events
title: "Events: Bubbling, Capturing & Delegation"
slug: events-bubbling-capturing-delegation
order: 1
---

A DOM event travels <strong>down</strong> the tree (capture), hits the target, then travels back <strong>up</strong> (bubble). Delegation uses the bubbling phase to handle many elements with one listener.

# The three phases

1. <strong>Capture</strong>

   From `window` down through each ancestor to the target's parent. Listeners registered with `{ capture: true }` run here.

2. <strong>Target</strong>

   Listeners on the element itself.

3. <strong>Bubble</strong>

   Back up from the parent to `window`. Default listeners run here. (`focus`, `blur`, `mouseenter` don't bubble.)

```javascript filename:JavaScript
// <div id="outer"><button id="inner">Click</button></div>
outer.addEventListener("click", () => console.log("outer capture"), { capture: true });
outer.addEventListener("click", () => console.log("outer bubble"));
inner.addEventListener("click", () => console.log("button"));
// clicking the button logs: outer capture → button → outer bubble
```

```text filename:Output
JavaScript (browser, not run)
```

# Event object essentials

| Member | Purpose |
| --- | --- |
| `event.target` | The element that was actually clicked (deepest) |
| `event.currentTarget` | The element whose listener is running now |
| `event.preventDefault()` | Cancel the default action (follow link, submit form) |
| `event.stopPropagation()` | Stop travelling to further ancestors |
| `event.stopImmediatePropagation()` | Also skip remaining listeners on the same element |
| `{ once: true }`, `{ passive: true }`, `{ signal }` | Auto-remove; promise not to `preventDefault` (smooth scrolling); remove via `AbortController` |

# Event delegation

```javascript filename:JavaScript
// One listener for any number of (even future) <li> items:
document.querySelector("#todo").addEventListener("click", (event) => {
  const item = event.target.closest("li[data-id]");
  if (!item || !event.currentTarget.contains(item)) return;
  if (event.target.matches(".delete")) item.remove();
  else item.classList.toggle("done");
});
```

```text filename:Output
JavaScript (browser, not run)
```

> [!TIP] Do
>
> Delegation means fewer listeners (less memory), automatic handling of elements added later, and one place for the logic.

# Runnable: EventTarget and CustomEvent

`EventTarget`, `Event` and `CustomEvent` also exist in Node, so the listener API itself can be demonstrated (there is no tree, so no bubbling):

```javascript filename:JavaScript
const cart = new EventTarget();
const controller = new AbortController();

cart.addEventListener("add", (e) => console.log("added", e.detail.item), { signal: controller.signal });
cart.addEventListener("add", () => console.log("first add only"), { once: true });
cart.addEventListener("checkout", (e) => {
  e.preventDefault();
  console.log("checkout blocked by listener");
});

cart.dispatchEvent(new CustomEvent("add", { detail: { item: "book" } }));
cart.dispatchEvent(new CustomEvent("add", { detail: { item: "pen" } }));
controller.abort();                                     // removes the first listener
cart.dispatchEvent(new CustomEvent("add", { detail: { item: "lamp" } }));

const ok = cart.dispatchEvent(new Event("checkout", { cancelable: true }));
console.log("dispatch returned", ok);
```

```text filename:Output
added book
first add only
added pen
checkout blocked by listener
dispatch returned false
```

```question
What is event delegation?

---

Attaching a single listener to a common ancestor and using `event.target` (often with `closest`) to find which child triggered the event. It relies on bubbling and works for elements added after the listener was registered.
```

```question
target vs currentTarget?

---

`target` is where the event originated (e.g. an `<span>` inside a button); `currentTarget` is the element the currently running listener is attached to (the button or the delegating parent).
```
