---
id: e30ec816-f364-772b-9e05-16d0360ae089
key: topic:javascript/strict-mode
subject: javascript
topic: strict-mode
title: Strict Mode
slug: strict-mode
order: 1
---

`"use strict"` opts a script or function into a safer dialect that turns silent mistakes into errors. ES modules and class bodies are strict automatically.

# Turning it on

```javascript filename:JavaScript
"use strict";            // first statement of a script
function f() {
  "use strict";          // or of a single function
}
```

You rarely write it today: <strong>every ES module</strong> (`import`/`export`, `.mjs`, `type="module"`) and <strong>every </strong><strong>`class`</strong><strong> body</strong> is strict whether or not the directive is present. Old-style scripts and CommonJS files are <em>sloppy</em> unless you opt in.

# What changes

| Situation | Sloppy mode | Strict mode |
| --- | --- | --- |
| Assign to undeclared variable | Creates a global | `ReferenceError` |
| `this` in a plain function call | `globalThis` | `undefined` |
| Write to read-only / getter-only property | Silently ignored | `TypeError` |
| Add property to frozen / non-extensible object | Silently ignored | `TypeError` |
| `delete` a non-configurable property | Returns `false` | `TypeError` |
| Duplicate parameter names | Allowed | `SyntaxError` |
| `with` statement | Allowed | `SyntaxError` |
| Octal literal `010` | 8 | `SyntaxError` (use `0o10`) |
| `arguments` ↔ parameters | Linked (aliasing) | Independent |
| `eval` creates variables in the caller | Yes | No — own scope |
| Reserved future words (`let`, `static`, `implements`…) | Usable as names | Reserved |

# Seeing both modes side by side

This file is a module (strict). Code built with the `Function` constructor is sloppy unless it says otherwise — a handy way to compare:

```javascript filename:JavaScript
const sloppy = new Function(`
  leaked = 1;                         // becomes a global
  const frozen = Object.freeze({ a: 1 });
  frozen.a = 2;                       // silently ignored
  return [typeof globalThis.leaked, frozen.a, this === globalThis];
`);
console.log("sloppy:", sloppy());

const strict = new Function(`
  "use strict";
  try { leaked2 = 1; } catch (e) { return e.name + " / this=" + this; }
`);
console.log("strict:", strict());

function args(a) { a = 99; return arguments[0]; }       // module → strict
console.log("arguments unlinked:", args(1));
```

```text filename:Output
sloppy: [ 'number', 1, true ]
strict: ReferenceError / this=undefined
arguments unlinked: 1
```

```question
What is strict mode and why use it?

---

An opt-in restricted variant of JavaScript (ES5) that throws on silent errors (undeclared assignments, writes to read-only properties), makes `this` `undefined` in plain calls, forbids confusing features (`with`, duplicate params, octal literals) and enables engine optimisations. It is on by default in modules and classes.
```
