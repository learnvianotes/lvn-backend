---
id: aab3a0b7-05b4-7cb5-9276-39bca7df7835
key: topic:javascript/intro
subject: javascript
topic: intro
title: Introduction to JavaScript
slug: introduction-to-javascript
order: 1
---

The language of the web — a dynamic, garbage-collected, single-threaded language with first-class functions, now running everywhere from browsers to servers to phones.

> [!INFO]
>
> <strong>JavaScript</strong> — a high-level, dynamically typed, multi-paradigm language (procedural, object-oriented via <em>prototypes</em>, functional). Its official specification is <strong>ECMAScript</strong> (ECMA-262); a new edition ships every June.

# Why JavaScript?

> [!NOTE] The only language browsers run natively
>
> HTML gives structure, CSS gives style, JavaScript gives behaviour. (WebAssembly runs alongside it, but JS is the glue.)

> [!NOTE] Runs everywhere
>
> Servers (Node.js, Deno, Bun), mobile (React Native), desktop (Electron), edge functions, databases (MongoDB shell).

> [!NOTE] First-class functions
>
> Functions are values: pass them, return them, store them. Closures make callbacks and modules natural.

> [!NOTE] Asynchronous by design
>
> A single thread plus an event loop handles thousands of concurrent I/O operations without blocking.

# A short history

| Year | Milestone |
| --- | --- |
| 1995 | Brendan Eich writes it in \~10 days at Netscape (Mocha → LiveScript → JavaScript). |
| 1997 | Standardised as <strong>ECMAScript 1</strong> by Ecma International. |
| 2009 | <strong>ES5</strong>: strict mode, `JSON`, `Array.prototype.map/filter/reduce`. Node.js is released. |
| 2015 | <strong>ES6 / ES2015</strong> — the big one: `let`/`const`, arrows, classes, modules, promises, destructuring, `Map`/`Set`. |
| 2016 → | Yearly editions: `async`/`await` (2017), `?.` and `??` (2020), top-level `await` (2022), `toSorted` (2023), `Object.groupBy` (2024)… |

> [!NOTE] Name
>
> <em>JavaScript</em> has nothing to do with <em>Java</em> — the name was a 1995 marketing decision. ECMAScript is the spec; JavaScript is the most famous implementation of it.

# Engines and runtimes

An <strong>engine</strong> parses and executes JavaScript. A <strong>runtime</strong> wraps an engine and adds APIs to talk to the outside world (DOM, files, network, timers).

| Engine | Used by |
| --- | --- |
| <strong>V8</strong> (C++) | Chrome, Edge, Node.js, Deno, Electron |
| <strong>SpiderMonkey</strong> | Firefox (the first JS engine ever) |
| <strong>JavaScriptCore</strong> | Safari, Bun, React Native (with Hermes as an alternative) |

| Runtime | Extra APIs it provides |
| --- | --- |
| Browser | `window`, `document` (DOM), `fetch`, `localStorage`, `setTimeout`, events |
| Node.js | `fs`, `path`, `process`, `http`, `Buffer`, `EventEmitter`, CommonJS + ESM modules |
| Deno / Bun | Node-compatible APIs, built-in TypeScript, secure-by-default (Deno) |

> [!WARNING] Watch out
>
> `setTimeout`, `console` and `fetch` are <strong>not part of the language</strong> — they come from the runtime. The ECMAScript spec itself has no I/O at all.

# Your first program

```javascript filename:JavaScript
const language = "JavaScript";
const year = 1995;
console.log(`Hello, ${language}! Born in ${year}.`);
console.log(typeof language, typeof year);
console.log([1, 2, 3].map((n) => n * 2));
```

```text filename:Output
Hello, JavaScript! Born in 1995.
string number
[ 2, 4, 6 ]
```

```filename:Terminal
$ node --version            # check Node
$ node app.js               # run a file
$ node                      # interactive REPL (.exit to quit)
$ node --watch app.js       # re-run on every save
```

In a browser, open DevTools (F12) → <strong>Console</strong> and type expressions directly, or load a file with `<script src="app.js" defer></script>`.

> [!NOTE] About the examples
>
> All examples in these notes run on <strong>Node 24</strong> as an ES module (`main.mjs`) and show their real output. ES modules are always in <em>strict mode</em> — this matters for `this` and a few other rules, and is pointed out where relevant.
