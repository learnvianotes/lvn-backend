---
id: f099bdb0-d7db-72bc-81bc-2979eae733c2
key: topic:python/operators
subject: python
topic: operators
title: Operators & Precedence
slug: operators-precedence
order: 1
---

Every operator Python has, how tightly each one binds, and the surprising corners — floor division with negatives, `and`/`or` returning operands, chained comparisons and bit tricks.

# Precedence table (highest first)

| Level | Operators | Notes |
| --- | --- | --- |
| 1 | `(…)` `[…]` `{…}`, `x[i]`, `x(…)`, `x.attr` | Grouping, subscription, calls, attribute access |
| 2 | `await x` | Inside `async def` |
| 3 | `**` | Power — <strong>right</strong>-associative; binds tighter than a unary minus on its left |
| 4 | `+x` `-x` `~x` | Unary plus, minus, bitwise NOT |
| 5 | `*` `@` `/` `//` `%` | Multiplicative (`@` is matrix multiplication) |
| 6 | `+` `-` | Additive |
| 7 | `<<` `>>` | Shifts |
| 8 | `&` | Bitwise AND |
| 9 | `^` | Bitwise XOR |
| 10 | `&#124;` | Bitwise OR |
| 11 | `in` `not in` `is` `is not` `<` `<=` `>` `>=` `!=` `==` | All comparisons share one level and <strong>chain</strong> |
| 12 | `not x` | Boolean NOT |
| 13 | `and` | Short-circuit AND |
| 14 | `or` | Short-circuit OR |
| 15 | `x if c else y` | Conditional expression |
| 16 | `lambda` | Anonymous function |
| 17 | `:=` | Assignment expression (walrus) — lowest |

> [!NOTE] Key point
>
> Everything is left-to-right associative except `**` (right-to-left) and comparisons (which chain). When in doubt, add parentheses — they cost nothing and help the reader.

# Arithmetic

```python filename:Python
print(7 / 2, 7 // 2, 7 % 2)           # 3.5 3 1
print(-7 // 2, -7 % 2)                # -4 1
print(7 // -2, 7 % -2)                # -4 -1
print(divmod(-7, 2))                  # (-4, 1)
print(7.5 // 2, 7.5 % 2)              # 3.0 1.5
print(2 ** 3 ** 2, (2 ** 3) ** 2)     # 512 64
print(-2 ** 2, (-2) ** 2)             # -4 4
print(2 ** -1, 10 ** 20)              # 0.5 100000000000000000000
```

| Operator | Meaning | Watch out |
| --- | --- | --- |
| `/` | True division | Always returns a `float`: `4 / 2 == 2.0` |
| `//` | Floor division | Rounds toward <strong>−∞</strong>, not toward 0: `-7 // 2 == -4` (C/Java give `-3`) |
| `%` | Modulo | Result has the sign of the <strong>divisor</strong>: `-7 % 2 == 1`; always `(a // b) * b + a % b == a` |
| `**` | Power | Right-associative; `pow(a, b, m)` does fast modular exponentiation |
| `divmod(a, b)` | `(a // b, a % b)` at once | Handy for digit extraction and time conversions |

> [!NOTE] Key point
>
> Python's `%` makes wrap-around indexing easy: `(i - 1) % n` is always a valid index, even when `i == 0`. For C-style truncation use `int(a / b)` or `math.fmod`.

# Comparisons chain

```python filename:Python
x = 5
print(1 < x < 10, 10 > x >= 5)        # True True
print(1 < 2 == 2)                     # True   ← means (1 < 2) and (2 == 2)
print((1 < 2) == 2)                   # False  ← True == 2 is False
print(False == False in [False])      # True   ← (False == False) and (False in [False])
print("apple" < "banana" < "cherry")  # True   ← strings compare lexicographically
print([1, 2] < [1, 3], (2, 0) > (1, 9))   # True True
```

`a < b < c` evaluates `b` only once and means `a < b and b < c`. Sequences compare element by element, which is why tuples make great multi-key sort keys.

# `and`, `or`, `not` — short-circuit and return operands

```python filename:Python
print(0 or "default", "x" or "default")   # default x
print(0 and 1 / 0, 3 and 4)               # 0 4   ← 1 / 0 is never evaluated
print([] or None or 0)                    # 0     ← every operand falsy → the last one
print(not "", not "hi")                   # True False

name = ""
print(name or "Anonymous")                # Anonymous
```

| Expression | Returns |
| --- | --- |
| `a or b` | `a` if `a` is truthy, otherwise `b` |
| `a and b` | `a` if `a` is falsy, otherwise `b` |
| `not a` | Always a real `bool` |

> [!WARNING] Watch out
>
> `count = user_count or 10` replaces a legitimate `0` with `10`. When `0`, `''` or `[]` are valid values, test explicitly: `10 if user_count is None else user_count`.

# Bitwise operators &amp; tricks

```python filename:Python
a, b = 0b1100, 0b1010                 # 12, 10
print(a & b, a | b, a ^ b)            # 8 14 6
print(bin(a & b), ~a)                 # 0b1000 -13   ← ~x == -x - 1
print(1 << 4, 100 >> 2)               # 16 25        ← x << k == x * 2**k
```

```python filename:Python
def is_power_of_two(x):
    return x > 0 and x & (x - 1) == 0     # clears the lowest set bit

print(is_power_of_two(64), is_power_of_two(96))   # True False
print(40 & -40)                         # 8      ← lowest set bit of 0b101000
print((13 >> 2) & 1)                    # 1      ← bit 2 of 0b1101
print((255).bit_count(), (255).bit_length())   # 8 8

READ, WRITE, EXEC = 1, 2, 4             # flags packed in one int
perms = READ | WRITE
perms &= ~WRITE                         # clear a flag
perms |= EXEC                           # set a flag
print(perms, bool(perms & READ), bool(perms & WRITE))   # 5 True False

nums = [4, 1, 2, 1, 2]
single = 0
for n in nums:
    single ^= n                         # x ^ x == 0, so pairs cancel out
print(single)                           # 4
```

> [!NOTE] Key point
>
> Unlike C, bitwise operators bind <strong>tighter</strong> than comparisons in Python: `n & 1 == 0` means `(n & 1) == 0`. Python ints are unbounded, so `~` and negative numbers behave as if they had infinitely many leading 1 bits.

# Augmented assignment

`x += 1`, `-=`, `*=`, `/=`, `//=`, `%=`, `**=`, `&=`, `|=`, `^=`, `<<=`, `>>=`, `@=`. For mutable objects they modify <strong>in place</strong> (`__iadd__`); for immutable ones they build a new object and rebind the name.

```python filename:Python
a = [1]
b = a
a += [2]              # list.__iadd__ → extends the same list
print(b)              # [1, 2]
a = a + [3]           # + builds a NEW list; b still sees the old one
print(a, b)           # [1, 2, 3] [1, 2]
```

> [!WARNING] Watch out
>
> There is no `++` or `--`. `i++` is a syntax error and `++i` quietly means `+(+i)` — it does nothing.

# Conditional expression &amp; walrus

```python filename:Python
age = 20
print("adult" if age >= 18 else "minor")          # adult

data = [4, 9, 1, 7]
if (n := len(data)) > 3:                          # assign and test in one step
    print(f"{n} items")                           # 4 items
big_squares = [y for x in data if (y := x * x) > 10]
print(big_squares)                                # [16, 81, 49]
```

# Membership, identity &amp; overloading

```python filename:Python
print("ell" in "hello", 3 in {1, 2, 3}, "a" in {"a": 1})   # True True True
a, b = [], []
print(a == b, a is b, a is not b)                         # True False True
print("ab" * 3, [0] * 3, [1] + [2])                       # ababab [0, 0, 0] [1, 2]

import operator
print(operator.add(2, 3), operator.mul("ha", 2))          # 5 haha
```

Operators are method calls in disguise: `a + b` → `a.__add__(b)`, `a < b` → `a.__lt__(b)`, `x in c` → `c.__contains__(x)`. That's how `str`, `list` and your own classes give `+` and `*` their own meaning (see <strong>Magic (Dunder) Methods</strong>). The `operator` module exposes each one as a function for `sorted(key=…)`, `reduce` and `map`.

# Common pitfalls

```python filename:Python
x = 5
print(x == 1 or 2)            # 2      ← parsed as (x == 1) or 2 → always truthy!
print(x in (1, 2))            # False  ← what was meant
print(not x == 5, x != 5)     # False False   ← not binds looser than ==
print(-3 ** 2)                # -9     ← -(3 ** 2)
print(0.1 + 0.2 == 0.3)       # False  ← floats; compare with math.isclose
print(1 + 2 * 3, (1 + 2) * 3) # 7 9
```

```question
What do and and or return?

---

They return one of their <strong>operands</strong>, not necessarily a `bool`. `a or b` returns `a` if it's truthy, else `b`; `a and b` returns `a` if it's falsy, else `b`. Evaluation stops as soon as the result is known (short-circuit), so the right side may never run.
```

```question
Why is -7 // 2 equal to -4 in Python?

---

`//` is <strong>floor</strong> division: it rounds toward negative infinity. −3.5 floors to −4. Correspondingly `-7 % 2 == 1`, keeping the identity `(a // b) * b + a % b == a`. C and Java truncate toward zero instead (−3 and −1).
```

```question
How do you check whether a number is a power of two?

---

`n > 0 and n & (n - 1) == 0`. Subtracting 1 flips the lowest set bit and everything below it, so ANDing clears that bit — the result is 0 only if there was exactly one set bit.
```

```question
What does 1 &lt; 2 == 2 evaluate to?

---

`True`. Comparisons chain: it means `1 < 2 and 2 == 2`. It is <em>not</em> `(1 < 2) == 2`, which would be `True == 2` → `False`.
```
