---
id: da189ef8-c980-7a3a-b958-2328a82dff3a
key: topic:javascript/best-practices
subject: javascript
topic: best-practices
title: Best Practices & Clean Code
slug: best-practices-clean-code
order: 1
---

Habits that keep JavaScript codebases readable, safe and fast — the things code reviewers look for.

# Language habits

> [!NOTE] const first, let if needed
>
> Never `var`. Smaller scopes, fewer surprises.

> [!NOTE] === always
>
> Except the deliberate `x == null`.

> [!NOTE] Prefer immutability
>
> Spread, `map`/`filter`, `toSorted`, `structuredClone` over in-place mutation of shared data.

> [!NOTE] Small pure functions
>
> One job each, early returns instead of deep nesting, descriptive names.

> [!NOTE] async/await + try/catch
>
> No floating promises; handle every rejection; parallelise with `Promise.all`.

> [!NOTE] Modules, not globals
>
> ES modules, named exports, no implicit globals.

# Readable code

```javascript filename:JavaScript
// ✗ nested, magic numbers, unclear names
function f(u) {
  if (u) {
    if (u.a > 17) {
      if (u.s === 1) return true;
    }
  }
  return false;
}

// ✓ guard clauses, named constants, descriptive names
const ADULT_AGE = 18;
const STATUS = Object.freeze({ ACTIVE: 1, BANNED: 2 });
function canPurchase(user) {
  if (!user) return false;
  if (user.age < ADULT_AGE) return false;
  return user.status === STATUS.ACTIVE;
}
console.log(f({ a: 20, s: 1 }), canPurchase({ age: 20, status: STATUS.ACTIVE }), canPurchase(null));
```

```text filename:Output
true true false
```

# Security

| Risk | Practice |
| --- | --- |
| XSS | Use `textContent`, not `innerHTML`, for user data; sanitise HTML (DOMPurify); set a Content-Security-Policy |
| `eval` / `new Function` / string `setTimeout` | Never run strings built from input |
| Prototype pollution | Don't deep-merge untrusted JSON into objects; block `__proto__`/`constructor` keys; use `Map` or `Object.create(null)` |
| Secrets | Nothing secret in client code or `localStorage`; `HttpOnly` cookies for sessions |
| Dependencies | `npm audit`, lockfiles, minimal packages, pin and review updates |
| ReDoS | Avoid nested quantifiers like `(a+)+` on user input |

```javascript filename:JavaScript
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
function naiveMerge(target, src) {
  for (const k in src) {
    if (typeof src[k] === "object") naiveMerge((target[k] ??= {}), src[k]);
    else target[k] = src[k];
  }
  return target;
}
naiveMerge({}, payload);
console.log("every object is now admin:", ({}).isAdmin);
delete Object.prototype.isAdmin;                          // undo the damage
console.log("after cleanup:", ({}).isAdmin);
```

```text filename:Output
every object is now admin: true
after cleanup: undefined
```

# Performance

- Measure first (DevTools Performance panel, `performance.now()`, Lighthouse) — don't guess.
- Pick the right structure: `Set`/`Map` lookups are O(1); `array.includes` inside a loop is O(n²).
- Avoid blocking the main thread: chunk long work, use Web Workers, debounce/throttle event handlers.
- Keep object shapes stable (initialise all fields in the constructor) so the JIT can optimise.
- Ship less JavaScript: code-split with dynamic `import()`, tree-shake, lazy-load.

# Tooling

| Tool | Role |
| --- | --- |
| ESLint | Catches bugs and enforces conventions |
| Prettier | Formatting — end style debates |
| TypeScript / JSDoc types | Static types: catch whole classes of bugs before running |
| Vitest / Jest / `node:test` | Unit tests |
| Vite / esbuild / webpack | Bundling, dev server, transpiling |

```javascript filename:JavaScript
import { test } from "node:test";
import assert from "node:assert/strict";

const slugify = (s) => s.trim().toLowerCase().replace(/\s+/g, "-");
assert.equal(slugify("  Hello World "), "hello-world");
assert.deepEqual([1, 2].map((x) => x * 2), [2, 4]);
assert.throws(() => JSON.parse("{"), SyntaxError);
console.log("all assertions passed");
```

```text filename:Output
all assertions passed
```

```question
How would you improve the performance of a slow page?

---

Measure first. Then: reduce and split the JS bundle, defer non-critical scripts, avoid layout thrashing, debounce expensive handlers, move heavy computation to a Worker, virtualise long lists, cache network responses, and use efficient data structures.
```
