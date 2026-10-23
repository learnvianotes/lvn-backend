---
id: 34efb204-782b-70bc-a7d2-475b67c8a64d
key: topic:javascript/truthy-falsy
subject: javascript
topic: truthy-falsy
title: Truthy & Falsy Values
slug: truthy-falsy-values
order: 1
---

In a boolean context every value is either truthy or falsy — and there are only eight falsy values to memorise.

# The complete falsy list

`false` · `0` · `-0` · `0n` · `""` (empty string) · `null` · `undefined` · `NaN`

<strong>Everything else is truthy</strong> — including `"0"`, `"false"`, `" "`, `[]`, `{}`, `function(){}`, `Infinity` and `new Boolean(false)`.

```javascript filename:JavaScript
import { inspect } from "node:util";
const values = [0, -0, "", null, undefined, NaN, 0n, "0", "false", " ", [], {}, -1];
for (const v of values) {
  console.log(inspect(v).padEnd(9), "→", Boolean(v));
}
```

```text filename:Output
0         → false
-0        → false
''        → false
null      → false
undefined → false
NaN       → false
0n        → false
'0'       → true
'false'   → true
' '       → true
[]        → true
{}        → true
-1        → true
```

# Using truthiness

```javascript filename:JavaScript
const items = [];
if (items.length) console.log("has items");
else console.log("empty array (length 0 is falsy)");

const name = "";
console.log(name || "Anonymous");
console.log(!!"text", !!0);
```

```text filename:Output
empty array (length 0 is falsy)
Anonymous
true false
```

> [!WARNING] Watch out
>
> `[]` and `{}` are truthy. Check emptiness explicitly: `arr.length === 0`, `Object.keys(obj).length === 0`.

# `||` vs `??` for defaults

```javascript filename:JavaScript
const settings = { volume: 0, title: "" };
console.log(settings.volume || 50, settings.volume ?? 50);
console.log(settings.title || "Untitled", settings.title ?? "Untitled");
console.log(settings.missing ?? "default");
```

```text filename:Output
50 0
Untitled
default
```

> [!NOTE] Key point
>
> `||` falls back on <strong>any falsy</strong> value (so a real `0` or `""` is lost). `??` falls back only on `null`/`undefined` — usually what you want for defaults.

```question
List the falsy values in JavaScript.

---

`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. (Browsers also have the legacy `document.all`.) Everything else, including empty arrays and objects, is truthy.
```
