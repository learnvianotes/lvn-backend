---
id: 6c4e2a80-7a5d-7a8a-9e69-d6a8998157f1
key: topic:javascript/parameters
subject: javascript
topic: parameters
title: Parameters, Defaults & Rest
slug: parameters-defaults-rest
order: 1
---

JavaScript never checks argument counts: missing ones are `undefined`, extras are ignored — defaults, rest parameters and destructuring make that manageable.

# Missing and extra arguments

```javascript filename:JavaScript
function show(a, b) {
  console.log(a, b, arguments.length);
}
show(1);
show(1, 2, 3);
```

```text filename:Output
1 undefined 1
1 2 3
```

# Default parameters

```javascript filename:JavaScript
function greet(name = "guest", greeting = `Hello, ${name}`) {
  return greeting;
}
console.log(greet());
console.log(greet("Asha"));
console.log(greet(undefined, "Hey"));   // undefined triggers the default
console.log(greet(null));               // null does not
```

```text filename:Output
Hello, guest
Hello, Asha
Hey
Hello, null
```

> [!NOTE] Key point
>
> Defaults are evaluated <strong>at call time</strong>, left to right, and can refer to earlier parameters. A fresh `[]` default is created on every call — no Python-style shared mutable default.

```javascript filename:JavaScript
function append(item, list = []) {
  list.push(item);
  return list;
}
console.log(append(1), append(2));
let counter = 0;
const next = (id = ++counter) => id;
console.log(next(), next(), next(99), next());
```

```text filename:Output
[ 1 ] [ 2 ]
1 2 99 3
```

# Rest parameters vs `arguments`

```javascript filename:JavaScript
function oldStyle() {
  console.log(Array.isArray(arguments), Array.from(arguments));
}
function modern(first, ...rest) {
  console.log(first, rest, Array.isArray(rest));
}
oldStyle(1, 2);
modern(1, 2, 3);
modern(1);
```

```text filename:Output
false [ 1, 2 ]
1 [ 2, 3 ] true
1 [] true
```

|  | `arguments` | `...rest` |
| --- | --- | --- |
| Type | Array-like object (no `map`) | Real array |
| In arrow functions | Not available | Works |
| Contains | All arguments | Only the <em>remaining</em> ones |
| Position | — | Must be the last parameter |

# Named options via destructuring

```javascript filename:JavaScript
function createUser({ name, role = "viewer", active = true } = {}) {
  return `${name} (${role}${active ? "" : ", inactive"})`;
}
console.log(createUser({ name: "Ravi" }));
console.log(createUser({ name: "Mei", role: "admin", active: false }));
console.log(createUser());
```

```text filename:Output
Ravi (viewer)
Mei (admin, inactive)
undefined (viewer)
```

> [!TIP] Do
>
> Use an options object for functions with more than 2–3 parameters: call sites become self-documenting and argument order stops mattering.

```question
What is the arguments object?

---

An array-like object available inside regular (non-arrow) functions holding every argument passed. It has `length` and indices but no array methods. Prefer rest parameters in modern code.
```
