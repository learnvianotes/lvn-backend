---
id: 9944ae7c-d79b-728d-b7ba-a5913468f7a5
key: topic:javascript/scope-hoisting
subject: javascript
topic: scope-hoisting
title: Scope, Scope Chain & Hoisting
slug: scope-scope-chain-hoisting
order: 1
---

Scope decides where a name is visible. JavaScript uses <em>lexical</em> scope: what you can see is fixed by where the code is written, not where it is called.

# Kinds of scope

| Scope | Created by | Holds |
| --- | --- | --- |
| Global | The program / script | Globals, `globalThis` properties |
| Module | Each ES module file | Top-level declarations of that module (not global!) |
| Function | Every function call | Parameters, `var`, inner declarations |
| Block | `{ }`, `if`, `for`, `try`… | `let`, `const`, `class` (and function declarations in strict mode) |

# The scope chain

When a name is used, the engine looks in the current scope, then the enclosing one, and so on out to global. The first match wins (<strong>shadowing</strong>); if none matches → `ReferenceError`.

```javascript filename:JavaScript
const level = "global";
function outer() {
  const level = "outer";
  function inner() {
    const extra = "inner-only";
    console.log(level, extra);   // finds outer's `level`
  }
  inner();
}
outer();
try {
  console.log(extra);
} catch (e) {
  console.log(e.name + ": " + e.message);
}
```

```text filename:Output
outer inner-only
ReferenceError: extra is not defined
```

# Lexical, not dynamic

```javascript filename:JavaScript
const x = "lexical";
function readX() { return x; }
function caller() {
  const x = "dynamic";
  return readX();              // readX sees where it was DEFINED
}
console.log(caller());
```

```text filename:Output
lexical
```

# Hoisting summary

| Declaration | Hoisted? | Value before the line runs |
| --- | --- | --- |
| `function f() {}` | Yes | The full function |
| `var x` | Yes | `undefined` |
| `let` / `const` | Yes (binding) | TDZ → `ReferenceError` |
| `class C {}` | Yes (binding) | TDZ → `ReferenceError` |
| `const f = () => {}` | As a `const` | TDZ |
| `import` | Yes | Modules are linked before any code runs |

```javascript filename:JavaScript
console.log(typeof hoisted, typeof notYet);
var notYet = function () {};
function hoisted() {}

var shadow = "global var";
function test() {
  console.log(shadow);   // local var is hoisted → undefined, not "global var"
  var shadow = "local";
}
test();
```

```text filename:Output
function undefined
undefined
```

# Accidental globals

In sloppy mode, assigning to an undeclared name silently creates a global. In strict mode (and every ES module) it throws:

```javascript filename:JavaScript
try {
  undeclaredTotal = 10;
} catch (e) {
  console.log(e.name + ": " + e.message);
}
```

```text filename:Output
ReferenceError: undeclaredTotal is not defined
```

```question
What is hoisting?

---

During the creation phase of a scope, declarations are registered before code executes. Function declarations are available in full, `var`s start as `undefined`, and `let`/`const`/`class` exist but stay uninitialised (TDZ) until their line runs. Nothing is physically moved.
```

```question
What is lexical scoping?

---

A function's accessible variables are determined by where it is written in the source. Each function remembers the scope it was created in — which is exactly what makes closures possible.
```
