---
id: f00de255-0837-7392-aa8d-eac9a9d1e093
key: topic:javascript/json
subject: javascript
topic: json
title: JSON
slug: json
order: 1
---

JSON is a text format for data, borrowed from JavaScript literal syntax. `JSON.stringify` serialises, `JSON.parse` deserialises — each with a hook for customisation.

# JSON vs JavaScript objects

| JSON | JavaScript object literal |
| --- | --- |
| Keys <strong>must</strong> be double-quoted strings | Keys can be bare identifiers |
| Strings in double quotes only | `'single'`, `"double"` and backtick templates |
| Values: string, number, boolean, `null`, object, array | Also functions, `undefined`, symbols, BigInt, Date, Map… |
| No trailing commas, no comments | Trailing commas allowed |

# stringify

```javascript filename:JavaScript
const data = {
  name: "Asha",
  tags: ["js", "node"],
  born: new Date(Date.UTC(1995, 11, 4)),
  skip: undefined,
  fn() {},
  sym: Symbol("s"),
  nan: NaN,
  inf: Infinity,
};
console.log(JSON.stringify(data));
console.log(JSON.stringify([undefined, () => {}, NaN]));
console.log(JSON.stringify({ a: 1, b: [1, 2] }, null, 2));
```

```text filename:Output
{"name":"Asha","tags":["js","node"],"born":"1995-12-04T00:00:00.000Z","nan":null,"inf":null}
[null,null,null]
{
  "a": 1,
  "b": [
    1,
    2
  ]
}
```

> [!WARNING] Watch out
>
> Silently lost: `undefined`, functions and symbols (dropped in objects, `null` in arrays); `NaN`/`Infinity` become `null`; `Date` becomes a string; `Map`/`Set` become `{}`. BigInt <strong>throws</strong>. Circular references <strong>throw</strong>.

# Replacer, toJSON and reviver

```javascript filename:JavaScript
const user = { name: "Ravi", password: "hunter2", age: 30 };
console.log(JSON.stringify(user, ["name", "age"]));
console.log(JSON.stringify(user, (k, v) => (k === "password" ? undefined : v)));

class Money {
  constructor(cents) { this.cents = cents; }
  toJSON() { return `$${(this.cents / 100).toFixed(2)}`; }
}
console.log(JSON.stringify({ total: new Money(1999) }));

const text = '{"when":"2024-01-15T10:00:00.000Z","n":1}';
const parsed = JSON.parse(text, (k, v) => (k === "when" ? new Date(v) : v));
console.log(parsed.when instanceof Date, parsed.when.getUTCFullYear());
```

```text filename:Output
{"name":"Ravi","age":30}
{"name":"Ravi","age":30}
{"total":"$19.99"}
true 2024
```

# Errors

```javascript filename:JavaScript
try {
  JSON.parse("{name: 'x'}");
} catch (e) {
  console.log(e.name);
}
const a = { name: "loop" };
a.self = a;
try {
  JSON.stringify(a);
} catch (e) {
  console.log(e.message.split("\n")[0]);
}
try {
  JSON.stringify({ n: 1n });
} catch (e) {
  console.log(e.message);
}
```

```text filename:Output
SyntaxError
Converting circular structure to JSON
Do not know how to serialize a BigInt
```

> [!TIP] Do
>
> Always wrap `JSON.parse` of external input in `try/catch`, and validate the shape of what you get (a schema library like Zod) — valid JSON is not necessarily valid data.

```question
Is JSON.parse(JSON.stringify(obj)) a good deep clone?

---

Only for plain JSON-safe data. It drops `undefined`/functions/symbols, turns Dates into strings, Maps/Sets into `{}`, `NaN` into `null`, loses prototypes, and throws on BigInt and cycles. Use `structuredClone` instead.
```
