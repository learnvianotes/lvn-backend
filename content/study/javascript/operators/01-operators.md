---
id: 113321cc-4ee7-7d08-b96d-c6980e21995e
key: topic:javascript/operators
subject: javascript
topic: operators
title: Operators
slug: operators
order: 1
---

Beyond arithmetic: short-circuit logic that returns operands, optional chaining, nullish coalescing, logical assignment and spread.

# Operator families

| Kind | Operators |
| --- | --- |
| Arithmetic | `+ - * / % **`, `++ --` |
| Assignment | `= += -= *= /= %= **=`, `&&= &#124;&#124;= ??=` |
| Comparison | `=== !== == != < > <= >=` |
| Logical | `&& &#124;&#124; !`, `??` |
| Bitwise | `& &#124; ^ ~ << >> >>>` |
| Other | `?.`, `? :`, `typeof`, `instanceof`, `in`, `delete`, `void`, `,`, `...` |

# `&&` and `||` return an operand

```javascript filename:JavaScript
console.log("a" && "b", 0 && "b", "a" || "b", "" || "b");
console.log(null || undefined || 0);
const user = { name: "Kai" };
user && console.log("logged in as", user.name);   // guard idiom
```

```text filename:Output
b 0 a b
0
logged in as Kai
```

`a && b` returns `a` if it is falsy, else `b`. `a || b` returns `a` if truthy, else `b`. Both <strong>short-circuit</strong>: the right side is not evaluated when unnecessary.

# Optional chaining `?.` and nullish coalescing `??`

```javascript filename:JavaScript
const order = { customer: { address: null }, items: [], total() { return 42; } };
console.log(order.customer?.address?.city);
console.log(order.shipping?.method ?? "standard");
console.log(order.items?.[0], order.total?.(), order.refund?.());
console.log(order.customer.address?.city.toUpperCase());  // stops at null
```

```text filename:Output
undefined
standard
undefined 42 undefined
undefined
```

> [!WARNING] Watch out
>
> `??` cannot be mixed with `||`/`&&` without parentheses: `a || b ?? c` is a SyntaxError. Write `(a || b) ?? c`.

# Logical assignment (ES2021)

```javascript filename:JavaScript
const opts = { retries: 0, name: "", cache: null };
opts.retries ||= 3;   // assigns if falsy
opts.name &&= opts.name.trim();  // assigns if truthy
opts.cache ??= new Map();        // assigns if null/undefined
opts.timeout ??= 1000;
console.log(opts);
```

```text filename:Output
{ retries: 3, name: '', cache: Map(0) {}, timeout: 1000 }
```

# Spread and rest `...`

```javascript filename:JavaScript
const a = [1, 2], b = [3, 4];
console.log([...a, ...b], Math.max(...b));
const base = { x: 1, y: 2 };
console.log({ ...base, y: 20, z: 3 });
function sum(...nums) { return nums.reduce((s, n) => s + n, 0); }
const [first, ...others] = [10, 20, 30];
console.log(sum(1, 2, 3), first, others);
```

```text filename:Output
[ 1, 2, 3, 4 ] 4
{ x: 1, y: 20, z: 3 }
6 10 [ 20, 30 ]
```

> [!NOTE] Key point
>
> Same syntax, opposite jobs: <strong>spread</strong> expands an iterable/object <em>into</em> places; <strong>rest</strong> collects remaining items <em>into</em> an array/object (parameters, destructuring).

# Increment, exponent and a few odd ones

```javascript filename:JavaScript
let i = 5;
console.log(i++, i, ++i);
console.log(2 ** 3 ** 2, (2 ** 3) ** 2);
console.log("x" in { x: undefined }, void 0, (1, 2, 3));
console.log(5 & 3, 5 | 3, 5 ^ 3, ~5, 1 << 4, -16 >> 2, -16 >>> 28);
```

```text filename:Output
5 6 7
512 64
true undefined 3
1 7 6 -6 16 -4 15
```

| Precedence (high → low) | Examples |
| --- | --- |
| Grouping, member, call | `( )`, `.`, `?.`, `[]`, `f()`, `new` |
| Postfix / prefix / unary | `x++`, `!`, `typeof`, `-x` |
| Exponent (right-assoc.) | `**` |
| Multiplicative → additive | `* / %` then `+ -` |
| Relational → equality | `< > in instanceof` then `== ===` |
| Logical | `&&` then `&#124;&#124;` then `??` |
| Conditional, assignment, comma | `? :`, `= += ??=`, `,` |

```question
What is the difference between || and ???

---

`||` returns the right side when the left is <em>falsy</em> (`0`, `''`, `false`, `NaN`, `null`, `undefined`). `??` only when the left is `null` or `undefined`, so valid values like `0` and `''` are kept.
```
