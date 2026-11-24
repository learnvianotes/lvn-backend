---
id: 3f4a54ec-2cdb-7f86-973f-8a5c6a922fcf
key: topic:python/numbers
subject: python
topic: numbers
title: "Numbers: int, float, Decimal & Fraction"
slug: numbers-int-float-decimal-fraction
order: 1
---

Python has unlimited-size integers, IEEE-754 binary floats, exact `Decimal` and `Fraction` types and a rich `math` module. Picking the right one avoids rounding bugs and overflow.

| Type | Precision | Speed | Use for |
| --- | --- | --- | --- |
| `int` | Exact, <strong>unlimited</strong> size | Fast | Counting, indices, IDs, big-number math |
| `float` | \~15–17 significant digits (64-bit binary) | Fastest (hardware) | Science, measurements, ML — where tiny errors are fine |
| `decimal.Decimal` | Exact decimal, configurable precision | Slower | <strong>Money</strong>, financial rounding rules |
| `fractions.Fraction` | Exact rational `p/q` | Slowest | Exact ratios, probability, teaching |
| `complex` | Pair of floats | Fast | Signal processing, maths (`2 + 3j`) |

# Integers: unlimited &amp; many literals

```python filename:Python
print(2 ** 100)                               # 1267650600228229401496703205376
print(0b1010, 0o17, 0xFF, 1_000_000)          # 10 15 255 1000000
print(int("1010", 2), int("z", 36), int(" 42 "))   # 10 35 42
n = 37
print(n.bit_length(), n.bit_count(), bin(n))  # 6 3 0b100101
print(7 // 2, -7 // 2, -7 % 3, int(-3.9))     # 3 -4 2 -3
print(divmod(17, 5), divmod(-17, 5))          # (3, 2) (-4, 3)
```

> [!NOTE] Key point
>
> `//` and `%` round toward <strong>negative infinity</strong>, so `-7 // 2 == -4` and `-7 % 3 == 2` (the result has the sign of the divisor). C and Java truncate toward zero. `int()` truncates toward zero.

```python filename:Python
print(pow(2, 10), pow(2, 10, 1000))    # 1024 24     ← fast modular exponentiation
print(pow(3, -1, 7))                   # 5           ← modular inverse: 3 * 5 % 7 == 1
print(True + True, isinstance(True, int))   # 2 True
print((255).to_bytes(2, "big"), int.from_bytes(b"\x01\x00", "big"))   # b'\x00\xff' 256
```

> [!WARNING] Watch out
>
> Converting a huge `int` to/from `str` is limited to 4300 digits by default (a DoS protection since 3.11): `str(10**5000)` raises `ValueError`. Raise it with `sys.set_int_max_str_digits(n)` if you really need to.

# Floats are binary approximations

```python filename:Python
print(0.1 + 0.2)                        # 0.30000000000000004
print(0.1 + 0.2 == 0.3)                 # False
import math
print(math.isclose(0.1 + 0.2, 0.3))     # True
print((0.1).as_integer_ratio())         # (3602879701896397, 36028797018963968)
print(f"{0.1:.20f}")                    # 0.10000000000000000555
total = 0.0
for _ in range(10):
    total += 0.1                        # error accumulates step by step
print(total, math.fsum([0.1] * 10))     # 0.9999999999999999 1.0
print(sum([0.1] * 10))                  # 1.0   ← sum() of floats is compensated since 3.12
print(2 ** 53 + 1.0 == 2 ** 53)         # True   ← integers above 2**53 lose precision
```

> [!INFO]
>
> <strong>IEEE 754 double</strong> — 64 bits: 1 sign bit, 11 exponent bits, 52 fraction bits. Only numbers of the form <em>m × 2ᵉ</em> are exact, so decimal fractions like 0.1 are stored as the nearest binary value.

> [!TIP] Do
>
> Compare floats with `math.isclose(a, b, rel_tol=1e-9, abs_tol=…)`; sum many floats with `math.fsum`; keep money in integer cents or `Decimal`.

> [!DANGER] Avoid
>
> `if total == 0.3:` or storing prices as floats — errors accumulate and comparisons fail.

# inf, nan &amp; float limits

```python filename:Python
import math, sys
inf, nan = float("inf"), float("nan")
print(inf > 10**308, -inf < 0, inf - inf)     # True True nan
print(nan == nan, math.isnan(nan))            # False True
print(1e308 * 10, 2.0 ** -1075)               # inf 0.0
print(sys.float_info.max, sys.float_info.epsilon)   # 1.7976931348623157e+308 2.220446049250313e-16
print(sorted([3, nan, 1]))                    # [3, nan, 1]   ← nan breaks sorting
```

> [!WARNING] Watch out
>
> `nan` is not equal to anything, including itself, so `x in list`, `sort`, `max` and dict lookups behave strangely with it. Filter with `math.isnan` first. Also `1 / 0` raises `ZeroDivisionError` — Python does not return `inf` for division.

# Rounding

```python filename:Python
import math
print(round(2.5), round(3.5), round(-2.5))       # 2 4 -2   ← banker's rounding
print(round(2.675, 2))                           # 2.67     ← 2.675 is really 2.67499999…
print(round(1234.5678, -2))                      # 1200.0
print(math.floor(-2.5), math.ceil(-2.5), math.trunc(-2.5))   # -3 -2 -2
print(int(2.99), math.floor(2.99))               # 2 2
```

| Function | Rounds | `2.5` | `-2.5` |
| --- | --- | --- | --- |
| `round(x)` | To nearest, ties to <strong>even</strong> | `2` | `-2` |
| `math.floor(x)` | Down (toward −∞) | `2` | `-3` |
| `math.ceil(x)` | Up (toward +∞) | `3` | `-2` |
| `math.trunc(x)` / `int(x)` | Toward zero | `2` | `-2` |
| `Decimal.quantize(…, ROUND_HALF_UP)` | Ties away from zero (school rounding) | `3` | `-3` |

# Decimal: exact decimal arithmetic

```python filename:Python
from decimal import Decimal, ROUND_HALF_UP, getcontext, localcontext
print(Decimal("0.1") + Decimal("0.2"))               # 0.3
print(Decimal(0.1))                                  # 0.1000000000000000055511151231257827021181583404541015625
price = Decimal("19.99")
total = price * 3
print(total, total * Decimal("1.18"))                # 59.97 70.7646
tax = (total * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
print(tax)                                           # 10.79
print(Decimal("2.5").quantize(Decimal("1"), rounding=ROUND_HALF_UP))   # 3
print(getcontext().prec)                             # 28
with localcontext() as ctx:
    ctx.prec = 5
    print(Decimal(1) / Decimal(7))                   # 0.14286
```

> [!WARNING] Watch out
>
> Build `Decimal` from <strong>strings</strong> (`Decimal('0.1')`), never from floats — `Decimal(0.1)` faithfully copies the float's binary error. Also don't mix `Decimal` and `float` in arithmetic: it raises `TypeError`.

# Fraction &amp; complex

```python filename:Python
from fractions import Fraction
f = Fraction(1, 3) + Fraction(1, 6)
print(f, f.numerator, f.denominator)            # 1/2 1 2
print(Fraction("0.75"), Fraction(0.1).limit_denominator(100))   # 3/4 1/10
print(float(Fraction(22, 7)))                   # 3.142857142857143

z = 3 + 4j
print(z.real, z.imag, abs(z), z.conjugate())    # 3.0 4.0 5.0 (3-4j)
import cmath
print(cmath.sqrt(-1))                           # 1j
```

# The `math` module

| Function | Does | Example |
| --- | --- | --- |
| `sqrt`, `isqrt` | Float root / exact integer floor root | `math.isqrt(17)` → `4` |
| `gcd`, `lcm` | Greatest common divisor / least common multiple (any number of args) | `math.lcm(4, 6)` → `12` |
| `comb`, `perm`, `factorial` | nCr, nPr, n! | `math.comb(5, 2)` → `10` |
| `prod`, `fsum` | Product / precise float sum | `math.prod([2, 3, 4])` → `24` |
| `log`, `log2`, `log10`, `exp` | Logarithms (`log(x, base)`) | `math.log2(1024)` → `10.0` |
| `hypot`, `dist` | Euclidean length / distance between points | `math.dist((0, 0), (3, 4))` → `5.0` |
| `floor`, `ceil`, `trunc` | Rounding to int | `math.ceil(2.1)` → `3` |
| `pi`, `e`, `tau`, `inf`, `nan` | Constants | `math.tau == 2 * math.pi` |
| `isclose`, `isfinite`, `isnan` | Float checks | `math.isclose(0.1 + 0.2, 0.3)` |

```python filename:Python
import math
print(math.isqrt(10**20), math.sqrt(2))        # 10000000000 1.4142135623730951
print(math.gcd(12, 18, 30), math.lcm(4, 6))    # 6 12
print(math.comb(52, 5), math.perm(5, 2), math.factorial(10))   # 2598960 20 3628800
print(math.prod(range(1, 6)), math.log2(1024), math.log(8, 2))  # 120 10.0 3.0
print(math.hypot(3, 4), math.dist((1, 1), (4, 5)))   # 5.0 5.0
print(math.degrees(math.pi), round(math.sin(math.pi / 6), 3))   # 180.0 0.5
```

> [!NOTE] Key point
>
> Use `math.isqrt(n)` — not `int(math.sqrt(n))` — for perfect-square checks on big integers: the float version is wrong once `n` exceeds 2⁵³.

# Interview questions

```question
Why is 0.1 + 0.2 != 0.3?

---

Floats are binary (IEEE 754). 0.1, 0.2 and 0.3 have no exact binary representation, so each is stored as the nearest double; the rounding errors don't cancel. Compare with `math.isclose`, or use `Decimal` / integer cents when exactness matters.
```

```question
Can Python integers overflow?

---

No. `int` is arbitrary precision — it grows to use as much memory as needed (slower as it grows). Floats can overflow to `inf`, and `numpy` fixed-width integers <em>do</em> wrap around.
```

```question
What does round(2.5) return and why?

---

`2`. Python 3 uses round-half-to-even (banker's rounding), which avoids a systematic upward bias when rounding many values. Use `Decimal.quantize(..., rounding=ROUND_HALF_UP)` for school-style rounding.
```

```question
How would you check whether a large number is a perfect square?

---

`import math`<br>`def is_square(n):`<br>`    return n >= 0 and math.isqrt(n) ** 2 == n`<br>`print(is_square(10**30), is_square(10**30 + 1))   # True False`
```
