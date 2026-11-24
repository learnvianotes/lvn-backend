---
id: 1f74eba1-3c7f-72d5-8f05-98bd2d791afa
key: topic:javascript/interview-qa
subject: javascript
topic: interview-qa
title: JavaScript Interview Q&A
slug: javascript-interview-q-a
order: 1
---

Rapid-fire questions from junior to senior level. Expand each for a crisp, interview-ready answer; follow the topic links in your head to go deeper.

# Fundamentals

```question
What are the data types in JavaScript?

---

Seven primitives — `number`, `bigint`, `string`, `boolean`, `undefined`, `null`, `symbol` — and `object` (which includes arrays, functions, dates, maps…). Primitives are immutable and compared by value; objects are compared by reference.
```

```question
var vs let vs const?

---

`var`: function scope, hoisted as `undefined`, re-declarable. `let`: block scope, TDZ, reassignable. `const`: block scope, TDZ, no reassignment (object contents still mutable).
```

```question
What is the temporal dead zone?

---

The span between entering a scope and the line where a `let`/`const`/`class` is declared. The binding exists (it is hoisted) but is uninitialised; any access throws `ReferenceError`.
```

```question
null vs undefined?

---

`undefined` means a value was never assigned (missing variable value, property, argument or return). `null` is an explicit “empty” set by the programmer. `null == undefined` is `true`, `===` is `false`, `typeof null` is `"object"`.
```

```question
== vs ===?

---

`===` compares type and value with no conversion. `==` coerces operands first (e.g. `'1' == 1`). Use `===`, except `x == null` to test for null-or-undefined.
```

```question
What is NaN and how do you test for it?

---

“Not a Number”, a `number` value produced by invalid maths (`0/0`, `Number('x')`). It is not equal to itself, so use `Number.isNaN(x)` or `Object.is(x, NaN)`.
```

# Functions &amp; scope

```question
What is a closure?

---

A function plus the lexical environment it was created in. Inner functions keep access to outer variables after the outer function returns — used for private state, factories, memoization, and callbacks.
```

```question
What is hoisting?

---

Declarations are processed before code runs: function declarations are fully available, `var`s are `undefined`, `let`/`const`/`class` sit in the TDZ.
```

```question
Explain this in JavaScript.

---

Determined at call time: `new` → new object; `call/apply/bind` → given object; `obj.fn()` → `obj`; plain call → `undefined` (strict) or global (sloppy). Arrow functions inherit `this` lexically.
```

```question
call vs apply vs bind?

---

`call(this, a, b)` and `apply(this, [a, b])` invoke immediately; `bind(this, a)` returns a new permanently bound function.
```

```question
Arrow functions vs regular functions?

---

Arrows have lexical `this` and `arguments`, cannot be constructors, have no `prototype`, and are always expressions. Regular functions get a dynamic `this` and can be used with `new`.
```

```question
What are higher-order functions?

---

Functions that take functions as arguments or return functions — `map`, `filter`, `reduce`, `setTimeout`, decorators like `debounce` and `memoize`.
```

```question
Currying vs partial application?

---

Currying turns an n-ary function into n unary functions `f(a)(b)(c)`. Partial application fixes some arguments and returns a function taking the rest (`bind`, `partial`).
```

# Objects &amp; prototypes

```question
How does prototypal inheritance work?

---

Every object links to a prototype. Missing properties are looked up along the chain until `null`. `class`/`extends` builds these chains; methods are shared through `Class.prototype`.
```

```question
What does the new keyword do?

---

Creates an object, links it to `Ctor.prototype`, runs the constructor with `this` bound to it, and returns it (unless the constructor returns another object).
```

```question
How do you deep-copy an object?

---

`structuredClone(obj)` (handles Dates, Maps, Sets, cycles; not functions or class prototypes). `JSON.parse(JSON.stringify(obj))` only for JSON-safe data. Spread and `Object.assign` are shallow.
```

```question
Object.freeze vs Object.seal?

---

Both stop adding/removing properties; `freeze` also makes values read-only. Both are shallow.
```

```question
Map vs Object, Set vs Array?

---

`Map`: any key type, insertion order, `size`, fast frequent updates, no prototype keys. `Set`: unique values with O(1) `has`, versus an array's O(n) `includes`.
```

```question
What are WeakMap and WeakSet for?

---

Associating data with objects without preventing their garbage collection — private data, caches, “visited” marks. Keys must be objects; they are not iterable.
```

# Asynchronous JavaScript

```question
Explain the event loop.

---

JS runs on one call stack. Async work is delegated to the runtime; completions queue callbacks. When the stack is empty the loop drains all microtasks (promise reactions), then runs the next macrotask (timer, I/O, event), and in browsers may render between tasks.
```

```question
Microtask vs macrotask?

---

Microtasks: promise `then`/`catch`/`finally`, `await` continuations, `queueMicrotask` — all run right after the current task. Macrotasks: `setTimeout`, `setInterval`, I/O, UI events — one per loop turn. Hence `Promise.then` runs before `setTimeout(…, 0)`.
```

```question
What is a Promise?

---

An object representing the eventual result of an async operation; pending → fulfilled/rejected, settled once. `then` returns a new promise, enabling chaining and centralised error handling with `catch`.
```

```question
Promise.all vs allSettled vs race vs any?

---

`all`: all fulfil or first rejection. `allSettled`: waits for all, reports each. `race`: first to settle. `any`: first to fulfil, `AggregateError` if all reject.
```

```question
How does async/await relate to promises?

---

Syntax sugar: an `async` function returns a promise; `await` pauses that function until a promise settles, resuming with its value or throwing its reason, so `try/catch` works.
```

```question
How do you run async tasks in parallel vs in sequence?

---

Parallel: start them all, then `await Promise.all([...])`. Sequence: `for…of` with `await` inside. Never `forEach` with an async callback.
```

```question
How do you cancel a fetch or other async work?

---

Pass an `AbortController`'s `signal` to `fetch` (or your own function), then call `controller.abort()`. `AbortSignal.timeout(ms)` gives a ready-made timeout signal.
```

# Browser &amp; performance

```question
What is event delegation?

---

One listener on a parent handles events from many children via bubbling and `event.target.closest(...)` — fewer listeners and it works for elements added later.
```

```question
Event bubbling vs capturing?

---

Events travel from window down to the target (capture), then back up (bubble). Listeners run in the bubble phase unless registered with `{ capture: true }`. `stopPropagation()` halts the journey.
```

```question
Debounce vs throttle?

---

Debounce runs once after activity stops for N ms (search input). Throttle runs at most once every N ms during activity (scroll).
```

```question
What causes memory leaks in JavaScript?

---

Anything that keeps unused objects reachable: uncleared intervals, listeners never removed, unbounded caches, closures holding big data, detached DOM nodes referenced from JS, accidental globals.
```

```question
localStorage vs sessionStorage vs cookies?

---

localStorage persists, sessionStorage is per-tab; both \~5 MB, JS-only. Cookies are small, sent with requests, and can be HttpOnly — use them for auth.
```

```question
What is CORS?

---

A browser mechanism that lets servers opt in to cross-origin reads via `Access-Control-Allow-*` headers, with preflight `OPTIONS` requests for non-simple requests. It protects users; it is enforced by browsers, not servers.
```

# Modules, tooling &amp; modern JS

```question
ES modules vs CommonJS?

---

ESM: static `import`/`export`, live bindings, async loading, top-level await, strict by default, tree-shakable. CJS: runtime `require`, `module.exports` object, synchronous, Node-specific.
```

```question
What is strict mode?

---

A safer JS variant: undeclared assignments throw, `this` is `undefined` in plain calls, silent failures become errors, `with` is banned. Automatic in modules and classes.
```

```question
What is a polyfill vs a transpiler?

---

A polyfill adds a missing built-in API at runtime (e.g. `Array.prototype.flat`). A transpiler (Babel, TypeScript) rewrites new <em>syntax</em> into older syntax at build time.
```

```question
Why use TypeScript?

---

Static types catch errors at compile time, power editor autocompletion and safe refactoring, and document intent. It compiles to plain JavaScript; types disappear at runtime.
```

```question
What are generators used for?

---

Functions that can pause with `yield` — lazy/infinite sequences, custom iterators, two-way coroutines, and (async generators) streaming data such as paginated APIs.
```

```question
What is a Proxy?

---

A wrapper that intercepts operations (get, set, has, delete, apply…) on a target object — used for validation, reactivity (Vue 3), logging and virtual properties. `Reflect` supplies the default behaviour.
```

# How to answer well

1. <strong>Define</strong>

   One precise sentence (“A closure is…”).

2. <strong>Show</strong>

   A 3–5 line example — ideally one you can run in your head.

3. <strong>Explain the why</strong>

   Mention the underlying mechanism (scope chain, prototype chain, event loop).

4. <strong>Trade-offs &amp; pitfalls</strong>

   When not to use it, the common bug, the modern alternative.
