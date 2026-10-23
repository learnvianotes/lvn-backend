---
id: 78e7814f-6b8b-7982-8b5e-31e4393324cd
key: topic:javascript/primitives-vs-references
subject: javascript
topic: primitives-vs-references
title: Primitives vs References
slug: primitives-vs-references
order: 1
---

Primitives are copied by value; objects are shared by reference. Almost every “why did my data change?” bug comes from this.

# Copying a primitive

```javascript filename:JavaScript
let a = 10;
let b = a;     // b gets its own copy of the value
b = 20;
console.log(a, b);
```

```text filename:Output
10 20
```

# Copying an object reference

```javascript filename:JavaScript
const original = { score: 10 };
const alias = original;   // copies the *reference*, not the object
alias.score = 99;
console.log(original.score);
console.log(original === alias);
```

```text filename:Output
99
true
```

|  | Primitives | Objects (incl. arrays, functions) |
| --- | --- | --- |
| Stored as | The value itself | A reference to a heap object |
| Assignment copies | The value | The reference |
| `===` compares | Values | Identity (same object?) |
| Mutable? | No — immutable | Yes |

# Equality compares identity for objects

```javascript filename:JavaScript
console.log("abc" === "abc");
console.log({ a: 1 } === { a: 1 });
console.log([1, 2] === [1, 2]);
const arr = [1, 2];
console.log(arr === arr);
```

```text filename:Output
true
false
false
true
```

# Passing to functions: always by value (of the reference)

JavaScript is <strong>pass-by-value</strong>. For objects the <em>value</em> being passed is a reference — so a function can mutate the caller's object, but reassigning the parameter never affects the caller.

```javascript filename:JavaScript
function mutate(obj) {
  obj.touched = true;   // changes the shared object
}
function reassign(obj) {
  obj = { replaced: true };  // only rebinds the local parameter
}
const data = {};
mutate(data);
reassign(data);
console.log(data);
```

```text filename:Output
{ touched: true }
```

# Primitives are immutable

```javascript filename:JavaScript
const s = "hello";
const upper = s.toUpperCase();   // returns a NEW string
console.log(s, upper);
const t = "cat";
try {
  t[0] = "b";                    // strings can't change in place
} catch (e) {
  console.log(e.name + ": " + e.message);
}
console.log(t);
```

```text filename:Output
hello HELLO
TypeError: Cannot assign to read only property '0' of string 'cat'
cat
```

In strict mode (every ES module) the assignment throws; in a sloppy script it is <em>silently ignored</em>. Either way the string never changes.

> [!NOTE] Autoboxing
>
> Methods on primitives work because of <strong>autoboxing</strong>: `"hi".length` briefly wraps the string in a `String` object, reads the property, and discards the wrapper.

> [!WARNING] Watch out
>
> To copy an object, use spread (`{...obj}`, shallow) or `structuredClone(obj)` (deep) — see <em>Immutability &amp; Copying</em>.

```question
Is JavaScript pass-by-reference?

---

No. It is always pass-by-value; for objects the value is a reference (sometimes called <em>call by sharing</em>). Mutating through the parameter is visible to the caller, but reassigning the parameter is not.
```
