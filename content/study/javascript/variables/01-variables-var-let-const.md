---
id: 116583d2-d897-741e-b476-360cd2b756aa
key: topic:javascript/variables
subject: javascript
topic: variables
title: "Variables: var, let & const"
slug: variables-var-let-const
order: 1
---

`const` by default, `let` when you must reassign, `var` never — and know <em>why</em>: scope, hoisting and the temporal dead zone.

# The three declarations

|  | `var` | `let` | `const` |
| --- | --- | --- | --- |
| Scope | Function | Block `{ }` | Block `{ }` |
| Hoisted? | Yes, initialised to `undefined` | Yes, but uninitialised (TDZ) | Yes, but uninitialised (TDZ) |
| Re-declare in same scope | Allowed | SyntaxError | SyntaxError |
| Reassign | Yes | Yes | No — TypeError |
| Creates `globalThis` property (scripts) | Yes | No | No |

# Block scope vs function scope

```javascript filename:JavaScript
function demo() {
  if (true) {
    var a = "var leaks out of the block";
    let b = "let stays inside";
  }
  console.log(a);
  console.log(typeof b);
}
demo();
```

```text filename:Output
var leaks out of the block
undefined
```

# `const` means constant <em>binding</em>, not immutable value

```javascript filename:JavaScript
const user = { name: "Asha" };
user.name = "Ravi";          // fine: mutating the object
user.age = 30;               // fine
console.log(user);
try {
  user = {};                 // not fine: rebinding the name
} catch (e) {
  console.log(e.name + ": " + e.message);
}
```

```text filename:Output
{ name: 'Ravi', age: 30 }
TypeError: Assignment to constant variable.
```

> [!NOTE] Key point
>
> To make the <em>object</em> itself read-only, use `Object.freeze(user)` (shallow).

# Hoisting and the Temporal Dead Zone

> [!INFO]
>
> <strong>Temporal Dead Zone (TDZ)</strong> — the period from the start of a block until a `let`/`const`/`class` declaration is evaluated. Touching the name in that window throws a `ReferenceError`.

```javascript filename:JavaScript
console.log(x);        // var is hoisted and set to undefined
var x = 5;

try {
  console.log(y);      // y exists but is in the TDZ
} catch (e) {
  console.log(e.name + ": " + e.message);
}
let y = 10;
```

```text filename:Output
undefined
ReferenceError: Cannot access 'y' before initialization
```

The TDZ is <em>temporal</em> (about time, not position): a function that reads the variable is fine as long as it is <em>called</em> after the declaration runs.

```javascript filename:JavaScript
function read() { return value; }  // refers to value declared below
let value = 42;
console.log(read());               // called after initialisation → OK
```

```text filename:Output
42
```

# The classic loop bug

```javascript filename:JavaScript
const withVar = [];
for (var i = 0; i < 3; i++) withVar.push(() => i);
console.log(withVar.map((f) => f()));

const withLet = [];
for (let j = 0; j < 3; j++) withLet.push(() => j);
console.log(withLet.map((f) => f()));
```

```text filename:Output
[ 3, 3, 3 ]
[ 0, 1, 2 ]
```

`var i` is one variable shared by every closure (it is 3 when they run). `let j` creates a <strong>fresh binding per iteration</strong>, so each closure captures its own value.

# Naming rules

- Letters, digits, `_` and `$`; cannot start with a digit; case-sensitive (`name` ≠ `Name`).
- Reserved words (`class`, `return`, `new`…) cannot be names.
- Conventions: `camelCase` for variables/functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for true constants.

> [!TIP] Do
>
> Default to `const`; switch to `let` only when the variable is reassigned. It documents intent and prevents accidental reassignment.

> [!DANGER] Avoid
>
> `var` in new code, and undeclared assignments like `total = 0` (creates an accidental global in sloppy mode, throws in strict mode).

```question
What is the difference between var, let and const?

---

`var` is function-scoped, hoisted with value `undefined`, and can be re-declared. `let` and `const` are block-scoped and hoisted into the TDZ (accessing them before the declaration throws). `const` additionally forbids reassignment of the binding — but the object it points to can still be mutated.
```

```question
Are let and const hoisted?

---

Yes — their names are created when the scope is entered (that is why they <em>shadow</em> outer variables from the start of the block), but they are not initialised, so any access before the declaration line throws a `ReferenceError`. That window is the temporal dead zone.
```
