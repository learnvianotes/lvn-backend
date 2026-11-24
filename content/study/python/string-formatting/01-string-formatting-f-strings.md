---
id: 65da96b9-053e-7b38-943b-1aff28d4eb7d
key: topic:python/string-formatting
subject: python
topic: string-formatting
title: String Formatting & f-strings
slug: string-formatting-f-strings
order: 1
---

f-strings are the modern way to build text: any expression inside `{}`, plus a compact <em>format spec</em> after `:` that controls width, alignment, precision, signs and number bases.

# f-string basics

```python filename:Python
name, items, price = "Asha", 3, 49.5
print(f"{name} bought {items} items")            # Asha bought 3 items
print(f"total = {items * price}")                # total = 148.5
print(f"{name.upper()} {len(name)} {'yes' if items > 2 else 'no'}")   # ASHA 4 yes
print(f"{{literal braces}} {items}")             # {literal braces} 3
data = {"k": [10, 20]}
print(f"{data['k'][1]}")                         # 20
```

| Part | Syntax | Example |
| --- | --- | --- |
| Expression | `{expr}` | `f'{a + b}'` |
| Conversion | `{expr!r}` / `!s` / `!a` | `repr()`, `str()`, `ascii()` of the value |
| Format spec | `{expr:spec}` | `f'{pi:.3f}'` |
| Self-documenting | `{expr=}` | `f'{x=}'` → `x=5` (3.8+) |
| Nested spec | `{expr:{width}.{prec}f}` | Width/precision from variables |
| Literal brace | `{{` and `}}` | `f'{{x}}'` → `{x}` |

# Debugging with `=` and conversions

```python filename:Python
x, word = 42, "café"
print(f"{x=}")                  # x=42
print(f"{x * 2 = }")            # x * 2 = 84
print(f"{word=}")               # word='café'   ← = uses repr() by default
print(f"{word!s}", f"{word!r}", f"{word!a}")   # café 'café' 'caf\xe9'
print(f"{x = :>6}|")            # x =     42|
```

> [!NOTE] Tip
>
> `{x=}` prints the expression text, then the value's `repr()` — the quickest print-debugging tool in Python.

# The format-spec mini-language

`[[fill]align][sign][z][#][0][width][grouping][.precision][type]`

| Field | Options | Meaning |
| --- | --- | --- |
| fill | any character | Pad character (needs an align after it) |
| align | `<` `>` `^` `=` | Left / right / centre / pad after the sign |
| sign | `+` `-` space | Always show sign / only negatives (default) / space for positives |
| `#` |  | Alternate form: `0b`, `0o`, `0x` prefixes |
| `0` |  | Zero-pad numbers (sign-aware) |
| width | integer | Minimum field width |
| grouping | `,` or `_` | Thousands separator |
| .precision | integer | Digits after the point (`f`, `%`), significant digits (`g`), or max chars for strings |
| type | `d b o x X e f g % n s c` | Presentation: decimal, binary, octal, hex, exponent, fixed, general, percent… |

# Alignment &amp; padding

```python filename:Python
s = "py"
print(f"[{s:<6}] [{s:>6}] [{s:^6}]")      # [py    ] [    py] [  py  ]
print(f"[{s:*^8}] [{s:->5}]")             # [***py***] [---py]
print(f"[{42:5}] [{'ab':5}]")             # [   42] [ab   ]   ← numbers right, strings left by default
print(f"[{-42:=+7}] [{-42:07}]")          # [-    42] [-000042]
print(f"[{'truncate me':.5}]")            # [trunc]
```

# Numbers: precision, signs, grouping

```python filename:Python
pi, big, ratio = 3.14159265, 1234567.891, 0.4567
print(f"{pi:.2f} {pi:.4f} {pi:8.3f}|")    # 3.14 3.1416    3.142|
print(f"{big:,.2f} {big:_.1f}")           # 1,234,567.89 1_234_567.9
print(f"{ratio:.1%} {ratio:%}")           # 45.7% 45.670000%
print(f"{big:e} {big:.2e}")               # 1.234568e+06 1.23e+06
print(f"{pi:g} {big:g} {0.00001234:g}")   # 3.14159 1.23457e+06 1.234e-05
print(f"{5:+d} {-5:+d} {5: d}")           # +5 -5  5
print(f"{1_000_000:,}")                   # 1,000,000
```

# Integers in other bases

```python filename:Python
n = 255
print(f"{n:b} {n:o} {n:x} {n:X}")         # 11111111 377 ff FF
print(f"{n:#b} {n:#o} {n:#x}")            # 0b11111111 0o377 0xff
print(f"{5:08b}")                         # 00000101
print(f"{n:#06x}")                        # 0x00ff   ← width counts the prefix
print(f"{65:c}")                          # A
print(format(n, "x"), int("ff", 16))      # ff 255
```

# Nested &amp; dynamic specs

```python filename:Python
rows = [("apple", 1.5), ("kiwi", 12.25)]
w = max(len(name) for name, _ in rows)
for name, cost in rows:
    print(f"{name:<{w}} | {cost:>{8}.{2}f}")
```

```text filename:Output
apple |     1.50
kiwi  |    12.25
```

# Dates in f-strings

```python filename:Python
from datetime import datetime
d = datetime(2026, 9, 29, 14, 5)
print(f"{d:%Y-%m-%d %H:%M}")        # 2026-09-29 14:05
print(f"{d:%d %b %Y, %A}")          # 29 Sep 2026, Tuesday
print(f"{d:%I:%M %p}")              # 02:05 PM
```

> [!NOTE] Key point
>
> A format spec is passed to the object's `__format__` method — that is why `datetime` understands `strftime` codes after the colon.

# `__format__` for your own classes

```python filename:Python
class Money:
    def __init__(self, amount):
        self.amount = amount
    def __format__(self, spec):
        if spec == "inr":
            return f"₹{self.amount:,.2f}"
        return format(self.amount, spec)     # fall back to float formatting

m = Money(1234.5)
print(f"{m:inr}")              # ₹1,234.50
print(f"{m:>10.1f}|")          #     1234.5|
print(format(m, "inr"))        # ₹1,234.50
```

# Older styles: `str.format`, `%` and `Template`

```python filename:Python
print("{} + {} = {}".format(1, 2, 3))              # 1 + 2 = 3
print("{0}{1}{0}".format("ab", "-"))               # ab-ab
print("{name} is {age}".format(name="Ravi", age=30))   # Ravi is 30
point = {"x": 3, "y": 4}
print("({p[x]}, {p[y]})".format(p=point))          # (3, 4)
print("{:>6.2f}|".format(3.14159))                 #   3.14|

print("%s has %d items (%.1f%%)" % ("cart", 3, 42.456))   # cart has 3 items (42.5%)
print("%(who)s says hi" % {"who": "Asha"})         # Asha says hi

from string import Template
t = Template("Hello $name, you owe $$${amount}")
print(t.substitute(name="Kiran", amount=20))       # Hello Kiran, you owe $20
print(t.safe_substitute(name="Kiran"))             # Hello Kiran, you owe $${amount}
```

| Style | Use it for |
| --- | --- |
| f-strings | <strong>Default choice</strong> — fastest and most readable (3.6+) |
| `str.format` | Templates stored separately from the values, e.g. `FMT.format(**row)` |
| `%` formatting | Legacy code and `logging` calls (`log.info('%s', x)` formats lazily) |
| `string.Template` | Templates written by <strong>users</strong> — `$name` only, no expressions, so it's safe |

> [!WARNING] Security
>
> Never call `.format()` or build f-strings from untrusted template text — `'{0.__class__}'.format(obj)` can read attributes. Use `string.Template` for user-supplied templates.

# Python 3.12+: f-strings grew up

```python filename:Python
songs = ["a", "b"]
print(f"{", ".join(songs)}")          # a, b     ← same quotes inside (3.12+)
print(f"{'\n'.join(songs)!r}")        # 'a\nb'   ← backslashes allowed in expressions
total = f"{
    sum([1, 2, 3])                   # comments and line breaks inside {} are fine
}"
print(total)                          # 6
```

> [!NOTE] Version
>
> PEP 701 (3.12) made f-strings part of the real grammar: reuse the outer quote type, write backslashes and comments inside the braces, and nest arbitrarily. Python 3.14 adds <strong>t-strings</strong> (`t'…'`) that produce a `Template` object for safe, deferred processing (e.g. SQL/HTML escaping).

# Pitfalls

- `f'{x:.2f}'` on a string raises `ValueError: Unknown format code 'f'` — convert first.
- `round(x, 2)` changes the value; `f'{x:.2f}'` only changes how it is <em>displayed</em>. For money use `Decimal`.
- `=` in `{x=}` uses `repr`, so strings appear quoted — add `!s` for the plain form.
- Forgetting the `f` prefix silently prints the braces: `'{name}'`.

```question
How do you print a float with 2 decimals and thousands separators, right-aligned in 12 characters?

---

`print(f"{1234567.891:>12,.2f}|")   # 1,234,567.89|`

Spec parts in order: align `>`, width `12`, grouping `,`, precision `.2`, type `f`.
```

```question
Which string formatting method is fastest?

---

f-strings — they compile to direct bytecode (`FORMAT_VALUE` / `BUILD_STRING`) with no method lookup or argument parsing, so they beat `str.format` and `%`.
```
