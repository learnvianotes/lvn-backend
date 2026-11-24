---
id: 472513ed-acbd-7e79-bd15-36c4f61f72d3
key: topic:javascript/numbers
subject: javascript
topic: numbers
title: Numbers, Math & BigInt
slug: numbers-math-bigint
order: 1
---

One `number` type for integers and decimals — a 64-bit IEEE 754 double — plus `BigInt` for arbitrarily large integers.

# Floating-point reality

```javascript filename:JavaScript
console.log(0.1 + 0.2);
console.log(0.1 + 0.2 === 0.3);
console.log(Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);
console.log((0.1 + 0.2).toFixed(2), Math.round(1.005 * 100) / 100);
```

```text filename:Output
0.30000000000000004
false
true
0.30 1
```

> [!NOTE] Money rule
>
> 0.1 has no exact binary representation (like 1/3 in decimal). Compare floats with a tolerance, and do money in <strong>integer cents</strong> (or `BigInt`, or a decimal library).

# Special values

```javascript filename:JavaScript
console.log(1 / 0, -1 / 0, 0 / 0);
console.log(typeof NaN, NaN === NaN);
console.log(isNaN("abc"), Number.isNaN("abc"));
console.log(Number.isFinite("5"), isFinite("5"));
console.log(Number.MAX_SAFE_INTEGER, Number.isSafeInteger(2 ** 53));
console.log(2 ** 53 === 2 ** 53 + 1);
```

```text filename:Output
Infinity -Infinity NaN
number false
true false
false true
9007199254740991 false
true
```

| Global (coerces) | `Number.*` (no coercion) — prefer these |
| --- | --- |
| `isNaN("abc")` → `true` | `Number.isNaN("abc")` → `false` |
| `isFinite("5")` → `true` | `Number.isFinite("5")` → `false` |
| `parseInt`, `parseFloat` | `Number.parseInt`, `Number.parseFloat` (identical) |

# Formatting and parsing

```javascript filename:JavaScript
const n = 1234.5678;
console.log(n.toFixed(2), n.toPrecision(3), (255).toString(16), (5).toString(2));
console.log(Number("1_000"), 1_000_000, 0xff, 0b1010, 0o17, 1e3);
console.log((1234567.891).toLocaleString("en-US"));
console.log((1234567.891).toLocaleString("de-DE"));
```

```text filename:Output
1234.57 1.23e+3 ff 101
NaN 1000000 255 10 15 1000
1,234,567.891
1.234.567,891
```

# The `Math` object

| Method | Result |
| --- | --- |
| `Math.round(2.5)`, `Math.round(-2.5)` | `3`, `-2` (rounds half toward +∞) |
| `Math.floor(-1.5)`, `Math.ceil(-1.5)`, `Math.trunc(-1.5)` | `-2`, `-1`, `-1` |
| `Math.max(...arr)`, `Math.min()` | largest; `Math.min()` with no args is `Infinity` |
| `Math.abs`, `Math.sign`, `Math.sqrt`, `Math.cbrt`, `Math.hypot` | the usual |
| `Math.random()` | float in `[0, 1)` — <strong>not</strong> cryptographically secure |

```javascript filename:JavaScript
console.log(Math.round(2.5), Math.round(-2.5), Math.trunc(-1.7), Math.floor(-1.7));
console.log(Math.max(3, 9, 1), Math.max(...[4, 8]), Math.max(), Math.min());
console.log(Math.hypot(3, 4), 2 ** 10, 7 % 3, -7 % 3);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const r = randInt(1, 6);
console.log(r >= 1 && r <= 6 && Number.isInteger(r));
```

```text filename:Output
3 -2 -1 -2
9 8 -Infinity Infinity
5 1024 1 -1
true
```

> [!WARNING] Watch out
>
> `%` is a <em>remainder</em>, not a modulo: its sign follows the dividend (`-7 % 3 === -1`). For a true modulo use `((n % m) + m) % m`.

# BigInt

```javascript filename:JavaScript
const big = 2n ** 64n;
console.log(big, typeof big);
console.log(9007199254740993n + 1n, 9007199254740993 + 1);
console.log(7n / 2n, BigInt("123") * 2n, 5n == 5, 5n === 5);
try {
  console.log(1n + 1);
} catch (e) {
  console.log(e.name + ": " + e.message);
}
```

```text filename:Output
18446744073709551616n bigint
9007199254740994n 9007199254740992
3n 246n true false
TypeError: Cannot mix BigInt and other types, use explicit conversions
```

- BigInt division truncates (`7n / 2n === 3n`); no decimals.
- Cannot mix with `number` in arithmetic — convert with `BigInt(n)` or `Number(b)`.
- Not usable with `Math.*`; `JSON.stringify` throws on BigInt unless you add a `toJSON`.

```question
Why is 0.1 + 0.2 !== 0.3?

---

Numbers are IEEE 754 binary doubles; 0.1 and 0.2 cannot be represented exactly, so their sum is `0.30000000000000004`. Compare with a tolerance (`Math.abs(a - b) < Number.EPSILON`) or work in integers.
```

```question
What is Number.MAX\_SAFE\_INTEGER?

---

`2^53 − 1` (9007199254740991) — the largest integer where every integer below it is exactly representable. Beyond it, `n + 1` may equal `n`; use `BigInt`.
```
