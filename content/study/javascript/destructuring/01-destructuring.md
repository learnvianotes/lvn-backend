---
id: b31a48e7-7261-73e3-a94a-ebc4634c5b73
key: topic:javascript/destructuring
subject: javascript
topic: destructuring
title: Destructuring
slug: destructuring
order: 1
---

Unpack values from arrays and properties from objects into variables — with defaults, renaming, rest and nesting.

# Array destructuring (by position)

```javascript filename:JavaScript
const rgb = [255, 128, 0, 0.5];
const [red, green, , alpha = 1] = rgb;       // skip with a hole
console.log(red, green, alpha);
const [head, ...tail] = "hello";             // any iterable
console.log(head, tail);
let a = 1, b = 2;
[a, b] = [b, a];                             // swap without a temp
console.log(a, b);
const [x = 10, y = 20] = [undefined, null];  // default only for undefined
console.log(x, y);
```

```text filename:Output
255 128 0.5
h [ 'e', 'l', 'l', 'o' ]
2 1
10 null
```

# Object destructuring (by name)

```javascript filename:JavaScript
const user = { id: 7, name: "Asha", address: { city: "Pune", zip: "411001" } };
const { name, role = "member", id: userId } = user;          // default + rename
const { address: { city }, ...rest } = user;                 // nested + rest
console.log(name, role, userId, city);
console.log(rest);
const key = "zip";
const { [key]: zipCode } = user.address;                     // computed key
console.log(zipCode);
```

```text filename:Output
Asha member 7 Pune
{ id: 7, name: 'Asha' }
411001
```

# In function parameters and loops

```javascript filename:JavaScript
const format = ({ first, last = "", title = "" } = {}) => `${title} ${first} ${last}`.trim();
console.log(format({ first: "Ada", last: "Lovelace", title: "Countess" }));
console.log(format({ first: "Linus" }));

const entries = Object.entries({ a: 1, b: 2 });
for (const [key, value] of entries) console.log(key, value);
const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
console.log(points.map(({ x, y }) => x + y));
```

```text filename:Output
Countess Ada Lovelace
Linus
a 1
b 2
[ 3, 7 ]
```

# Pitfalls

```javascript filename:JavaScript
try {
  const { a } = null;
} catch (e) {
  console.log(e.constructor.name);
}
let value;
({ value } = { value: 5 });   // parentheses needed when not declaring
console.log(value);
```

```text filename:Output
TypeError
5
```

- Destructuring `null` or `undefined` throws — give parameters a default `= {}`.
- An assignment without `let`/`const` must be wrapped in `( )`, otherwise `{` starts a block.
- Defaults apply only for `undefined`, never for `null`.

```question
How do you swap two variables without a temporary?

---

`[a, b] = [b, a];` — the right side builds a temporary array, which is destructured back into the two names.
```
