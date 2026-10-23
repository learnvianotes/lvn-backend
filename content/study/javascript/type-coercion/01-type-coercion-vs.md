---
id: 6f13c724-b4c1-73f0-8d77-95ce040d4349
key: topic:javascript/type-coercion
subject: javascript
topic: type-coercion
title: Type Coercion & == vs ===
slug: type-coercion-vs
order: 1
---

JavaScript silently converts values when an operator expects another type. Learn the three conversions (to string, number, boolean) and `==` stops being magic.

> [!INFO]
>
> <strong>Type coercion</strong> — automatic (implicit) conversion of a value from one type to another by an operator — as opposed to <em>explicit</em> conversion with `String(x)`, `Number(x)`, `Boolean(x)`.

# Explicit conversion

```javascript filename:JavaScript
console.log(String(123), String(null), String([1, 2]), String({}));
console.log(Number("42"), Number(""), Number("  7  "), Number("4px"));
console.log(Number(true), Number(null), Number(undefined), Number([]), Number([5]));
console.log(parseInt("4px"), parseFloat("3.5em"), parseInt("0x1F"), parseInt("101", 2));
console.log(Boolean(""), Boolean("0"), Boolean([]), Boolean(0));
```

```text filename:Output
123 null 1,2 [object Object]
42 0 7 NaN
1 0 NaN 0 5
4 3.5 31 5
false true true false
```

| Value | `Number(v)` | `String(v)` | `Boolean(v)` |
| --- | --- | --- | --- |
| `undefined` | `NaN` | `"undefined"` | `false` |
| `null` | `0` | `"null"` | `false` |
| `true` / `false` | `1` / `0` | `"true"` / `"false"` | same |
| `""` | `0` | `""` | `false` |
| `"12abc"` | `NaN` | same | `true` |
| `[]` | `0` | `""` | `true` |
| `{}` | `NaN` | `"[object Object]"` | `true` |

# Implicit coercion by operators

- `+` with <strong>any string</strong> operand → string concatenation. Otherwise numeric addition.
- `- * / % **` and unary `+` → always numeric.
- `if`, `!`, `&&`, `||`, `? :` → boolean (truthiness).
- Objects are first turned into primitives via `Symbol.toPrimitive`, then `valueOf()`, then `toString()`.

```javascript filename:JavaScript
console.log(1 + "2", "3" - 1, "3" * "4", +"5", +"");
console.log(true + 1, null + 1, undefined + 1);
console.log([] + [], [] + {}, [1, 2] + [3]);
console.log(1 + 2 + "3", "1" + 2 + 3);
```

```text filename:Output
12 2 12 5 0
2 1 NaN
 [object Object] 1,23
33 123
```

> [!NOTE] Key point
>
> Evaluation is left to right: `1 + 2 + "3"` is `3 + "3"` → `"33"`, while `"1" + 2 + 3` is `"12" + 3` → `"123"`.

# `==` (loose) vs `===` (strict)

> [!NOTE] === strict equality
>
> No conversion: different types → `false`. Objects: same reference. The only surprise: `NaN !== NaN`.

> [!NOTE] == loose equality
>
> Converts first: `null == undefined` (and nothing else), otherwise booleans → numbers, strings → numbers, objects → primitives.

```javascript filename:JavaScript
console.log(0 == "", 0 == "0", "" == "0");
console.log(false == "0", false == [], null == 0, null == undefined);
console.log([1] == 1, [1, 2] == "1,2", NaN == NaN);
console.log(0 === "", null === undefined, 1 === 1.0);
```

```text filename:Output
true true false
true true false true
true true false
false false true
```

> [!WARNING] Watch out
>
> `==` is not transitive: `0 == ""` and `0 == "0"` but `"" != "0"`. Always use `===` — except `x == null`, a handy check for <em>null or undefined</em>.

# `Object.is` — SameValue

```javascript filename:JavaScript
console.log(NaN === NaN, Object.is(NaN, NaN));
console.log(0 === -0, Object.is(0, -0));
console.log([NaN].includes(NaN), [NaN].indexOf(NaN));
```

```text filename:Output
false true
true false
true -1
```

| Algorithm | Used by | `NaN` vs `NaN` | `0` vs `-0` |
| --- | --- | --- | --- |
| Strict (`===`) | `===`, `indexOf`, `switch` | not equal | equal |
| SameValueZero | `includes`, `Map`/`Set` keys | equal | equal |
| SameValue | `Object.is` | equal | not equal |

# Objects to primitives

```javascript filename:JavaScript
const price = {
  valueOf() { return 42; },
  toString() { return "$42"; },
};
console.log(price + 1, `${price}`, price > 40);

const temp = {
  [Symbol.toPrimitive](hint) {
    return hint === "number" ? 21 : hint === "string" ? "21°C" : "default";
  },
};
console.log(+temp, `${temp}`, temp + "");
```

```text filename:Output
43 $42 true
21 21°C default
```

```question
What is the difference between == and ===?

---

`===` compares without type conversion (and objects by identity). `==` first coerces operands to a common type using the abstract equality rules — `null == undefined`, booleans and strings become numbers, objects become primitives. Prefer `===`; `x == null` is the common exception.
```

```question
What does \[\] + {} evaluate to?

---

`"[object Object]"`. Both are converted to primitives: `[]` → `""`, `{}` → `"[object Object]"`, and `+` with a string concatenates. (Typed at the start of a line in a console, `{}` may be parsed as an empty block, which is why `{} + []` can show `0`.)
```
