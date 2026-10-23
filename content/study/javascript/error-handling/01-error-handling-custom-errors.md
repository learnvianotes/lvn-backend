---
id: 2f382239-3c39-7c13-ab1c-199196641acb
key: topic:javascript/error-handling
subject: javascript
topic: error-handling
title: Error Handling & Custom Errors
slug: error-handling-custom-errors
order: 1
---

Throw `Error` objects (never strings), catch where you can actually do something about it, and give your own failures meaningful classes.

# try / catch / finally

```javascript filename:JavaScript
function parseAge(input) {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid age: ${input}`);
  return n;
}
for (const input of ["42", "-3", "abc"]) {
  try {
    console.log("age", parseAge(input));
  } catch (err) {
    console.log(err.name, "-", err.message);
  } finally {
    console.log("  checked", JSON.stringify(input));
  }
}
```

```text filename:Output
age 42
  checked "42"
RangeError - invalid age: -3
  checked "-3"
RangeError - invalid age: abc
  checked "abc"
```

# Built-in error types

| Type | Thrown when |
| --- | --- |
| `SyntaxError` | Code (or `JSON.parse` input) cannot be parsed |
| `ReferenceError` | An undeclared variable, or a TDZ access |
| `TypeError` | A value is the wrong type: calling a non-function, reading a property of `undefined`, writing a read-only property |
| `RangeError` | A number out of range: `new Array(-1)`, `toFixed(200)`, stack overflow |
| `URIError` | `decodeURIComponent('%')` |
| `AggregateError` | Several errors at once (`Promise.any`) |
| `EvalError` | Legacy, practically unused |

```javascript filename:JavaScript
const attempts = [
  () => null.name,
  () => undefinedVariable,
  () => (1).toFixed(500),
  () => decodeURIComponent("%"),
  () => JSON.parse("{bad json}"),
];
for (const fn of attempts) {
  try { fn(); } catch (e) { console.log(`${e.name}: ${e.message}`); }
}
```

```text filename:Output
TypeError: Cannot read properties of null (reading 'name')
ReferenceError: undefinedVariable is not defined
RangeError: toFixed() digits argument must be between 0 and 100
URIError: URI malformed
SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

# Custom error classes

```javascript filename:JavaScript
class AppError extends Error {
  constructor(message, options) {
    super(message, options);            // options.cause (ES2022)
    this.name = this.constructor.name;
  }
}
class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} ${id} not found`);
    this.status = 404;
  }
}
class DatabaseError extends AppError {}

function findUser(id) {
  try {
    throw new Error("connection reset");        // low-level failure
  } catch (cause) {
    throw new DatabaseError(`could not load user ${id}`, { cause });
  }
}
try {
  findUser(7);
} catch (e) {
  console.log(e.name, "|", e.message, "|", e.cause.message);
  console.log(e instanceof DatabaseError, e instanceof AppError, e instanceof Error);
}
const nf = new NotFoundError("Order", 42);
console.log(nf.name, nf.status, nf.message);
```

```text filename:Output
DatabaseError | could not load user 7 | connection reset
true true true
NotFoundError 404 Order 42 not found
```

> [!TIP] Do
>
> Wrap low-level errors with `{ cause }` so logs keep the whole story; branch on `instanceof` (or an error `code`), not on message text.

# Uncaught errors

An exception nobody catches ends the script (in Node the process exits with code 1). The build confirms this example really fails:

```javascript filename:JavaScript
function divide(a, b) {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}
console.log(divide(10, 2));
console.log(divide(1, 0));   // uncaught → crash
console.log("never reached");
```

```text filename:Terminal%20(stack%20trimmed)%20%E2%80%94%20exit%20code%201
5
file:///…/main.mjs:2
  if (b === 0) throw new Error("Division by zero");
                     ^

Error: Division by zero
    at divide (file:///…/main.mjs:2:22)
    at file:///…/main.mjs:6:13

Node.js v24.12.0
```

# Async errors

```javascript filename:JavaScript
try {
  setTimeout(() => { /* throw here would NOT be caught below */ }, 0);
} catch {
  console.log("never");
}
async function load() { throw new Error("async failure"); }
try {
  await load();                              // await makes try/catch work
} catch (e) {
  console.log("caught:", e.message);
}
load().catch((e) => console.log("caught via .catch:", e.message));
```

```text filename:Output
caught: async failure
caught via .catch: async failure
```

| Safety net | Environment |
| --- | --- |
| `window.addEventListener('error', …)` | Browser: uncaught sync errors |
| `window.addEventListener('unhandledrejection', …)` | Browser: rejected promises without a handler |
| `process.on('uncaughtException')` / `('unhandledRejection')` | Node: log and exit — don't keep running in an unknown state |

> [!TIP] Do
>
> Throw `Error` instances (they capture a stack trace); catch narrowly and rethrow what you can't handle; always handle promise rejections.

> [!DANGER] Avoid
>
> `throw "oops"` (no stack), empty `catch {}` blocks that swallow failures, and using exceptions for ordinary control flow.

```question
Can try/catch catch errors thrown inside a setTimeout callback?

---

No. By the time the callback runs, the `try` block has long finished — it is a different call stack. Put the `try/catch` inside the callback, or use promises with `await`/`.catch`.
```

```question
What does finally do if both try and finally return?

---

`finally` always runs; if it has its own `return` (or `throw`), that overrides the result of `try`/`catch`. Avoid returning from `finally`.
```
