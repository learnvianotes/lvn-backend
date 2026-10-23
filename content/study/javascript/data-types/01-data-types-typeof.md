---
id: 8e80faba-8bdc-7b46-aeb5-82cc7447acbc
key: topic:javascript/data-types
subject: javascript
topic: data-types
title: Data Types & typeof
slug: data-types-typeof
order: 1
---

Seven primitive types plus objects. Values have types; variables do not.

# The eight types

| Type | Examples | `typeof` |
| --- | --- | --- |
| <strong>Number</strong> | `42`, `3.14`, `-0`, `NaN`, `Infinity` | `"number"` |
| <strong>BigInt</strong> | `9007199254740993n` | `"bigint"` |
| <strong>String</strong> | `'hi'`, `"hi"`, template literals with backticks | `"string"` |
| <strong>Boolean</strong> | `true`, `false` | `"boolean"` |
| <strong>Undefined</strong> | `undefined` — declared but no value | `"undefined"` |
| <strong>Null</strong> | `null` — intentional “no value” | `"object"` (historic bug!) |
| <strong>Symbol</strong> | `Symbol('id')` — unique key | `"symbol"` |
| <strong>Object</strong> | `{}`, `[]`, functions, dates, maps… | `"object"` / `"function"` |

# `typeof` in practice

```javascript filename:JavaScript
console.log(typeof 42, typeof 10n, typeof "s", typeof true);
console.log(typeof undefined, typeof Symbol(), typeof {}, typeof []);
console.log(typeof null);                 // the famous bug
console.log(typeof function () {}, typeof class {});
console.log(typeof notDeclaredAnywhere);  // no ReferenceError
```

```text filename:Output
number bigint string boolean
undefined symbol object object
object
function function
undefined
```

> [!WARNING] Watch out
>
> `typeof null === "object"` is a bug from JavaScript's first implementation, kept for backward compatibility. Test for null with `value === null`.

# Checking types reliably

| Question | Use |
| --- | --- |
| Is it an array? | `Array.isArray(x)` (not `typeof`) |
| Is it null? | `x === null` |
| Null or undefined? | `x == null` (the one accepted use of `==`) or `x ?? fallback` |
| Instance of a class? | `x instanceof Date` (walks the prototype chain) |
| Exact built-in tag? | `Object.prototype.toString.call(x)` |
| Is it NaN? | `Number.isNaN(x)` |

```javascript filename:JavaScript
const tag = (x) => Object.prototype.toString.call(x);
console.log(Array.isArray([]), [] instanceof Array);
console.log(tag(null), tag([]), tag(new Date(0)), tag(/re/));
```

```text filename:Output
true true
[object Null] [object Array] [object Date] [object RegExp]
```

# `undefined` vs `null`

> [!NOTE] undefined
>
> The engine's “nothing here”: an unassigned variable, a missing property, a missing argument, a function with no `return`.

> [!NOTE] null
>
> The programmer's “nothing here”: an intentional empty value you assign yourself.

```javascript filename:JavaScript
let a;
const obj = {};
function f() {}
console.log(a, obj.missing, f());
console.log(null == undefined, null === undefined);
console.log(Number(null), Number(undefined));
```

```text filename:Output
undefined undefined undefined
true false
0 NaN
```

# Dynamic typing

```javascript filename:JavaScript
let value = 10;
console.log(typeof value);
value = "ten";
console.log(typeof value);
value = [10];
console.log(typeof value, Array.isArray(value));
```

```text filename:Output
number
string
object true
```

```question
How many data types does JavaScript have?

---

Eight: seven primitives (`number`, `bigint`, `string`, `boolean`, `undefined`, `null`, `symbol`) and `object`. Arrays, functions, dates and maps are all objects.
```

```question
Why does typeof null return "object"?

---

In the first implementation values carried a type tag, and the tag for objects was 0; `null` was the null pointer (all zeros), so it read as an object. Fixing it would break the web, so it stays.
```
