---
id: dc7dd515-f4f0-7143-8461-f3effdf85f1b
key: topic:javascript/es-features
subject: javascript
topic: es-features
title: Modern ES Feature Tour (ES2015 → ES2025)
slug: modern-es-feature-tour-es2015-es2025
order: 1
---

What arrived in each edition since the ES2015 revolution — a map for reading any codebase and for “what's new in JavaScript?” questions.

| Edition | Headline features |
| --- | --- |
| <strong>ES2015 (ES6)</strong> | `let`/`const`, arrows, classes, template literals, destructuring, default/rest/spread, modules, Promise, Map/Set/WeakMap, Symbol, iterators, generators, `for…of`, Proxy/Reflect |
| <strong>ES2016</strong> | `**` exponent, `Array.prototype.includes` |
| <strong>ES2017</strong> | `async`/`await`, `Object.values/entries`, `padStart/padEnd`, `Object.getOwnPropertyDescriptors`, SharedArrayBuffer/Atomics |
| <strong>ES2018</strong> | Object rest/spread, async iteration (`for await`), `Promise.finally`, regex named groups, lookbehind, `s` flag |
| <strong>ES2019</strong> | `flat`/`flatMap`, `Object.fromEntries`, `trimStart/trimEnd`, optional `catch` binding, stable sort |
| <strong>ES2020</strong> | `?.`, `??`, BigInt, `Promise.allSettled`, `globalThis`, dynamic `import()`, `matchAll` |
| <strong>ES2021</strong> | `&&=` `&#124;&#124;=` `??=`, `replaceAll`, `Promise.any`, numeric separators `1_000`, WeakRef |
| <strong>ES2022</strong> | Class fields, `#private`, static blocks, top-level `await`, `.at()`, `Object.hasOwn`, `Error` `cause`, `#x in obj` |
| <strong>ES2023</strong> | `toSorted/toReversed/toSpliced/with`, `findLast/findLastIndex`, hashbang, symbols as WeakMap keys |
| <strong>ES2024</strong> | `Object.groupBy`/`Map.groupBy`, `Promise.withResolvers`, `Array.fromAsync`, regex `v` flag, resizable ArrayBuffer, `String.isWellFormed` |
| <strong>ES2025</strong> | Iterator helpers, new `Set` methods (`union`, `intersection`…), `RegExp.escape`, `Promise.try`, JSON modules / import attributes, `Float16Array` |

# A tour in one program

```javascript filename:JavaScript
const users = [
  { name: "Asha", team: "web", profile: { city: "Pune" }, score: 72 },
  { name: "Ravi", team: "api", profile: null, score: 91 },
  { name: "Mei", team: "web", profile: { city: "Delhi" }, score: 85 },
];
// ES2020 optional chaining + nullish coalescing
console.log(users.map((u) => u.profile?.city ?? "unknown"));
// ES2023 non-mutating sort + ES2022 at()
console.log(users.toSorted((a, b) => b.score - a.score).at(0).name);
// ES2024 groupBy
const byTeam = Object.groupBy(users, (u) => u.team);
console.log(Object.entries(byTeam).map(([t, list]) => `${t}:${list.length}`));
// ES2021 numeric separators + logical assignment
const config = { limit: null };
config.limit ??= 1_000_000;
console.log(config.limit);
// ES2025 Promise.try + Set methods
const result = await Promise.try(() => JSON.parse('{"ok":true}'));
console.log(result, new Set(["a", "b"]).union(new Set(["c"])).size);
// ES2022 top-level await, error cause
const err = new Error("outer", { cause: new Error("inner") });
console.log(err.cause.message);
```

```text filename:Output
[ 'Pune', 'unknown', 'Delhi' ]
Ravi
[ 'web:2', 'api:1' ]
1000000
{ ok: true } 3
inner
```

# On the horizon

| Proposal | What it adds |
| --- | --- |
| <strong>Temporal</strong> | Modern immutable date/time API replacing `Date` |
| <strong>Explicit resource management</strong> | `using res = getResource()` — automatic cleanup via `Symbol.dispose` |
| <strong>Decorators</strong> | `@logged method() {}` — standardised class decorators (used by TypeScript/Angular) |
| <strong>Import defer / source phase imports</strong> | Lazier module evaluation, WebAssembly integration |

# How features arrive: the TC39 process

1. <strong>Stage 0–1</strong>

   Idea and proposal with a champion on the TC39 committee.

2. <strong>Stage 2 / 2.7</strong>

   Draft spec text chosen; 2.7 = approved in principle, awaiting tests.

3. <strong>Stage 3</strong>

   Recommended for implementation; engines ship it (often behind flags).

4. <strong>Stage 4</strong>

   Two shipping implementations + tests → included in the next yearly edition.

> [!NOTE] Key point
>
> Transpilers (Babel, TypeScript, esbuild, SWC) convert new syntax to older syntax; <strong>polyfills</strong> (core-js) add missing built-in functions. Syntax cannot be polyfilled — it must be transpiled.

```question
What were the most important ES6 features?

---

`let`/`const` (block scope), arrow functions, classes, template literals, destructuring, default/rest/spread, modules, promises, `Map`/`Set`, symbols, iterators/generators and `for…of`.
```
