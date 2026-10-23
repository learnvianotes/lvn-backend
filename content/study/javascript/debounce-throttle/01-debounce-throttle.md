---
id: 3b635731-0b68-7a0b-9e4d-1d9324e8c2c1
key: topic:javascript/debounce-throttle
subject: javascript
topic: debounce-throttle
title: Debounce & Throttle
slug: debounce-throttle
order: 1
---

Two ways to rate-limit a function that fires too often (typing, scrolling, resizing): <strong>debounce</strong> waits for quiet, <strong>throttle</strong> runs at most once per interval.

> [!NOTE] Debounce
>
> Run only after the calls have <strong>stopped</strong> for `wait` ms. Every new call resets the timer. → search-as-you-type, auto-save, resize end.

> [!NOTE] Throttle
>
> Run at most <strong>once every</strong> `wait` ms, no matter how often it is called. → scroll position, mouse move, rate-limited APIs.

# Debounce

```javascript filename:JavaScript
function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

const search = debounce((q) => console.log("searching for:", q), 30);
search("j");
search("ja");
search("jav");                          // only this one survives the burst
setTimeout(() => search("javascript"), 60);
```

```text filename:Output
searching for: jav
searching for: javascript
```

# Throttle

```javascript filename:JavaScript
function throttle(fn, wait) {
  let last = 0, timer = null, pendingArgs = null;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {               // leading call
      last = now;
      fn.apply(this, args);
    } else {                            // remember the latest call for the trailing edge
      pendingArgs = args;
      timer ??= setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, pendingArgs);
      }, remaining);
    }
  };
}

const onScroll = throttle((y) => console.log("handle scroll at", y), 50);
onScroll(0);                  // runs immediately (leading edge)
onScroll(10);                 // ignored…
onScroll(20);                 // …but the latest is kept for the trailing edge
```

```text filename:Output
handle scroll at 0
handle scroll at 20
```

|  | Debounce | Throttle |
| --- | --- | --- |
| Runs | Once, after the burst ends | Regularly during the burst |
| Guarantee | Latest value, eventually | At most one call per `wait` |
| Typical use | Search box, validation, auto-save | Scroll, resize, drag, analytics |

> [!NOTE] Key point
>
> Production versions (lodash `debounce`/`throttle`) add `leading`/`trailing` options, `cancel()` and `flush()`. Remember to cancel pending timers when a component unmounts.

```question
Debounce vs throttle?

---

Debounce delays execution until calls stop for a quiet period (only the last call runs). Throttle lets a call through at most once per interval, spreading executions evenly while calls continue.
```
