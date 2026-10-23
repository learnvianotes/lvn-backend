---
id: 96567342-80cf-7a8d-ac19-cc8608b18af9
key: topic:javascript/symbols
subject: javascript
topic: symbols
title: Symbols
slug: symbols
order: 1
---

A `symbol` is a unique, immutable primitive used as a property key that can never collide with any other key — and the gateway to customising built-in behaviour.

# Creating symbols

```javascript filename:JavaScript
const id1 = Symbol("id");
const id2 = Symbol("id");
console.log(id1 === id2, typeof id1, id1.description, id1.toString());

const user = { name: "Asha", [id1]: 123 };
console.log(user[id1], Object.keys(user), JSON.stringify(user));
console.log(Object.getOwnPropertySymbols(user), Reflect.ownKeys(user));

const shared = Symbol.for("app.token");      // global registry
console.log(shared === Symbol.for("app.token"), Symbol.keyFor(shared));
```

```text filename:Output
false symbol id Symbol(id)
123 [ 'name' ] {"name":"Asha"}
[ Symbol(id) ] [ 'name', Symbol(id) ]
true app.token
```

> [!NOTE] Key point
>
> Symbol keys are skipped by `for…in`, `Object.keys` and `JSON.stringify` — handy for metadata that should not leak into serialisation. They are <em>not</em> private: `Object.getOwnPropertySymbols` finds them.

# Well-known symbols

| Symbol | Customises |
| --- | --- |
| `Symbol.iterator` | `for…of`, spread, destructuring |
| `Symbol.asyncIterator` | `for await…of` |
| `Symbol.toPrimitive` | Conversion to number/string |
| `Symbol.toStringTag` | `Object.prototype.toString` output |
| `Symbol.hasInstance` | `instanceof` |
| `Symbol.dispose` / `asyncDispose` | `using` declarations (explicit resource management) |

```javascript filename:JavaScript
class Temperature {
  constructor(c) { this.c = c; }
  get [Symbol.toStringTag]() { return "Temperature"; }
  [Symbol.toPrimitive](hint) { return hint === "string" ? `${this.c}°C` : this.c; }
}
const t = new Temperature(21);
console.log(Object.prototype.toString.call(t), `${t}`, t + 1);

class Even {
  static [Symbol.hasInstance](n) { return Number.isInteger(n) && n % 2 === 0; }
}
console.log(4 instanceof Even, 3 instanceof Even);
```

```text filename:Output
[object Temperature] 21°C 22
true false
```

```question
What are Symbols used for?

---

Collision-free property keys (for libraries adding metadata to objects they don't own), constants that can't be confused with strings, and well-known symbols to hook into language behaviour (`Symbol.iterator`, `Symbol.toPrimitive`, …).
```
