---
id: 3cc5c060-a76b-7480-bc66-d2cfe9169916
key: topic:javascript/modules
subject: javascript
topic: modules
title: "Modules: ESM vs CommonJS"
slug: modules-esm-vs-commonjs
order: 1
---

Modules give each file its own scope and explicit imports/exports. JavaScript has two systems: standard <strong>ES modules</strong> and Node's older <strong>CommonJS</strong>.

# ES module syntax

```javascript filename:JavaScript
// math.js
export const PI = 3.14159;
export function area(r) { return PI * r * r; }
export default class Calculator { /* ... */ }

// app.js
import Calculator, { PI, area as circleArea } from "./math.js";
import * as math from "./math.js";
export { circleArea };                    // re-export
export * from "./other.js";
const { heavy } = await import("./heavy.js");   // dynamic import (returns a promise)
```

Exports are <em>live bindings</em>, which a runnable demo can show by importing an inline module from a `data:` URL:

```javascript filename:JavaScript
const source = `
  export let count = 0;
  export function increment() { count++; }
  export default "the default export";
`;
const mod = await import("data:text/javascript," + encodeURIComponent(source));
console.log(mod.default, mod.count);
mod.increment();
console.log(mod.count);                   // live binding: sees the update
try {
  mod.count = 99;                         // importers cannot assign
} catch (e) {
  console.log(e.name);
}
console.log(Object.keys(mod));
```

```text filename:Output
the default export 0
1
TypeError
[ 'count', 'default', 'increment' ]
```

# ESM vs CommonJS

|  | ES modules (ESM) | CommonJS (CJS) |
| --- | --- | --- |
| Syntax | `import` / `export` | `require()` / `module.exports` |
| Loading | Static graph, parsed before running; async-capable | Synchronous, at runtime |
| Top-level `await` | Yes | No |
| Bindings | Live, read-only | A copied value (`exports` object) |
| Strict mode | Always | Only with `"use strict"` |
| Top-level `this` | `undefined` | `module.exports` |
| File detection in Node | `.mjs`, or `.js` with `"type": "module"` | `.cjs`, or `.js` by default |
| `__dirname`, `require` | Not defined — use `import.meta.dirname`, `createRequire` | Available |
| Tree-shaking | Yes (static analysis) | Hard |

```javascript filename:JavaScript
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);     // CJS require inside ESM
const os = require("node:os");
console.log(typeof os.platform, typeof require.resolve);
console.log(path.basename(import.meta.filename), import.meta.url.startsWith("file://"));
console.log(typeof __dirname, typeof module, this);
```

```text filename:Output
function function
main.mjs true
undefined undefined undefined
```

# CommonJS for reference

```javascript filename:JavaScript
// counter.cjs
let count = 0;
module.exports = { count, increment() { count++; } };

// app.cjs
const counter = require("./counter.cjs");
counter.increment();
console.log(counter.count);   // 0 — a copy was exported, not a live binding
```

# Module facts worth knowing

- A module is evaluated <strong>once</strong>, then cached — every importer gets the same instance (natural singletons).
- Imports are hoisted and resolved before the module body runs; circular imports see TDZ bindings until the other module finishes.
- In browsers: `<script type="module">` is deferred by default, runs in strict mode and needs full URLs or an import map.
- Dynamic `import()` enables code splitting and lazy loading; it works in CJS too.
- `require(esm)` is supported in modern Node (22+) for ES modules without top-level `await`.

```question
What are the main differences between CommonJS and ES modules?

---

ESM uses static `import`/`export`, is analysed before execution (enabling tree-shaking and top-level await), exports live read-only bindings and is always strict. CJS uses synchronous runtime `require`, exports a plain object (copied values), and has `__dirname`/`module`.
```
