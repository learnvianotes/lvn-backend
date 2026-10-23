---
id: 7ecd5275-4e2e-764a-b689-bca0fb8b920b
key: topic:javascript/objects
subject: javascript
topic: objects
title: Objects
slug: objects
order: 1
---

Objects are collections of key → value properties. Keys are strings or symbols; values can be anything, including functions (methods).

# Object literals, modern syntax

```javascript filename:JavaScript
const name = "Asha", age = 28;
const field = "email";
const user = {
  name,                                  // shorthand for name: name
  age,
  [field]: "asha@example.com",           // computed key
  [`is${"Admin"}`]: false,
  "full name": "Asha Rao",               // any string can be a key
  greet() { return `Hi, ${this.name}`; },  // method shorthand
};
console.log(user);
console.log(user.greet(), user["full name"], user[field]);
```

```text filename:Output
{
  name: 'Asha',
  age: 28,
  email: 'asha@example.com',
  isAdmin: false,
  'full name': 'Asha Rao',
  greet: [Function: greet]
}
Hi, Asha Asha Rao asha@example.com
```

# Reading, writing, deleting, checking

```javascript filename:JavaScript
const car = { brand: "Tata", year: 2020 };
car.color = "red";           // add
car.year = 2021;             // update
delete car.brand;            // remove
console.log(car);
console.log("color" in car, Object.hasOwn(car, "color"), car.speed);
console.log("toString" in car, Object.hasOwn(car, "toString"));
```

```text filename:Output
{ year: 2021, color: 'red' }
true true undefined
true false
```

| Check | Own props | Inherited props | Value `undefined` counts? |
| --- | --- | --- | --- |
| `obj.key !== undefined` | Yes | Yes | No — misses explicit `undefined` |
| `'key' in obj` | Yes | Yes | Yes |
| `Object.hasOwn(obj, 'key')` | Yes | No | Yes |

# Keys are strings (or symbols)

```javascript filename:JavaScript
const obj = {};
obj[1] = "number key";
obj[{}] = "object key";
console.log(Object.keys(obj), obj["1"]);
const order = { b: 1, 2: "two", a: 2, 1: "one" };
console.log(Object.keys(order));
```

```text filename:Output
[ '1', '[object Object]' ] number key
[ '1', '2', 'b', 'a' ]
```

> [!NOTE] Key point
>
> Property order: integer-like keys first in ascending order, then string keys in insertion order, then symbols. Need real non-string keys? Use a `Map`.

# Getters and setters

```javascript filename:JavaScript
const temperature = {
  celsius: 25,
  get fahrenheit() {
    return this.celsius * 9 / 5 + 32;
  },
  set fahrenheit(f) {
    this.celsius = Math.round((f - 32) * 5 / 9);
  },
};
console.log(temperature.fahrenheit);
temperature.fahrenheit = 212;
console.log(temperature.celsius, temperature);
```

```text filename:Output
77
100 { celsius: 100, fahrenheit: [Getter/Setter] }
```

# Iterating an object

```javascript filename:JavaScript
const scores = { math: 90, art: 75, music: 88 };
for (const [subject, score] of Object.entries(scores)) {
  console.log(`${subject.padEnd(6)} ${score}`);
}
const total = Object.values(scores).reduce((a, b) => a + b, 0);
console.log(total, Object.keys(scores).length);
```

```text filename:Output
math   90
art    75
music  88
253 3
```

```question
How do you check if an object is empty?

---

`Object.keys(obj).length === 0` (own enumerable string keys). For a stricter check include symbols and non-enumerables: `Reflect.ownKeys(obj).length === 0`.
```

```question
Difference between dot and bracket notation?

---

Dot needs a valid identifier known when writing the code (`obj.name`). Brackets take any expression evaluated at runtime (`obj[key]`, `obj['full name']`, `obj[sym]`).
```
