---
id: ba8fb5bf-dd20-7846-bb92-28b8810e42bc
key: topic:javascript/object-static-methods
subject: javascript
topic: object-static-methods
title: Object Static Methods
slug: object-static-methods
order: 1
---

The `Object` constructor carries the toolbox for inspecting, copying, converting and grouping objects.

| Method | Does |
| --- | --- |
| `Object.keys / values / entries(o)` | Own enumerable string keys / values / `[key, value]` pairs |
| `Object.fromEntries(iterable)` | Pairs → object (inverse of `entries`) |
| `Object.assign(target, ...src)` | Copy own enumerable props into `target` (mutates, shallow) |
| `Object.create(proto, descriptors?)` | New object with the given prototype |
| `Object.getPrototypeOf / setPrototypeOf` | Read / change the prototype |
| `Object.defineProperty / defineProperties` | Add props with explicit attributes |
| `Object.freeze / seal / preventExtensions` | Restrict changes |
| `Object.hasOwn(o, k)` | Own-property check (ES2022) |
| `Object.is(a, b)` | SameValue equality |
| `Object.groupBy(items, fn)` | Group into a null-prototype object (ES2024) |
| `Object.getOwnPropertyNames / getOwnPropertySymbols` | Include non-enumerables / symbols |

# entries ⇄ fromEntries: transform an object

```javascript filename:JavaScript
const prices = { apple: 1.2, bread: 2.5, milk: 0.99 };
const doubled = Object.fromEntries(
  Object.entries(prices).map(([k, v]) => [k, v * 2])
);
console.log(doubled);
const cheap = Object.fromEntries(Object.entries(prices).filter(([, v]) => v < 2));
console.log(cheap);
console.log(Object.fromEntries(new Map([["x", 1]])));
console.log(Object.fromEntries(new URLSearchParams("q=js&page=2")));
```

```text filename:Output
{ apple: 2.4, bread: 5, milk: 1.98 }
{ apple: 1.2, milk: 0.99 }
{ x: 1 }
{ q: 'js', page: '2' }
```

# assign vs spread

```javascript filename:JavaScript
const defaults = { theme: "light", lang: "en" };
const user = { lang: "hi" };
const merged = Object.assign({}, defaults, user);
const spread = { ...defaults, ...user };
console.log(merged, spread);
Object.assign(defaults, { theme: "dark" });   // mutates the target
console.log(defaults);
```

```text filename:Output
{ theme: 'light', lang: 'hi' } { theme: 'light', lang: 'hi' }
{ theme: 'dark', lang: 'en' }
```

> [!NOTE] Key point
>
> Later sources win. `Object.assign` <em>invokes setters</em> on the target; spread defines fresh properties. Both are shallow copies.

# Object.groupBy (ES2024)

```javascript filename:JavaScript
const inventory = [
  { name: "asparagus", type: "veg", qty: 5 },
  { name: "banana", type: "fruit", qty: 0 },
  { name: "goat", type: "meat", qty: 23 },
  { name: "cherry", type: "fruit", qty: 5 },
];
const byType = Object.groupBy(inventory, ({ type }) => type);
console.log(Object.keys(byType), byType.fruit.length);
const stock = Map.groupBy(inventory, ({ qty }) => (qty > 0 ? "ok" : "restock"));
console.log(stock.get("restock"));
```

```text filename:Output
[ 'veg', 'fruit', 'meat' ] 2
[ { name: 'banana', type: 'fruit', qty: 0 } ]
```

# Object.create

```javascript filename:JavaScript
const animal = { speak() { return `${this.name} makes a sound`; } };
const dog = Object.create(animal);
dog.name = "Rex";
console.log(dog.speak(), Object.getPrototypeOf(dog) === animal);
const dict = Object.create(null);          // no prototype at all
dict.key = "v";
console.log("toString" in dict, dict);
```

```text filename:Output
Rex makes a sound true
false [Object: null prototype] { key: 'v' }
```

```question
Object.keys vs Object.getOwnPropertyNames vs Reflect.ownKeys?

---

`Object.keys` → own <strong>enumerable</strong> string keys. `getOwnPropertyNames` → own string keys including non-enumerable. `Reflect.ownKeys` → all own keys, strings and symbols, enumerable or not.
```
