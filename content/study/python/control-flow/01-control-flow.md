---
id: 56f18864-cb15-7c81-b131-8560f7ca7288
key: topic:python/control-flow
subject: python
topic: control-flow
title: Control Flow
slug: control-flow
order: 1
---

`if`/`elif`/`else`, `for`, `while`, `match` — plus a few Python-only twists like `for … else`.

# Conditionals

```python filename:Python
def grade(score):
    if score >= 90:
        return "A"
    elif score >= 75:
        return "B"
    else:
        return "C"

print(grade(95), grade(80), grade(40))       # A B C
status = "adult" if 20 >= 18 else "minor"     # conditional expression
print(status)                                  # adult
```

# Loops

`for` iterates over <em>any iterable</em> (lists, strings, dicts, files, generators). `while` repeats while a condition is truthy.

```python filename:Python
for i in range(2, 10, 3):          # start, stop (exclusive), step
    print(i, end=" ")               # 2 5 8
print()
for i, ch in enumerate("abc", start=1):
    print(i, ch, end=" | ")         # 1 a | 2 b | 3 c |
print()
for name, age in zip(["a", "b"], [20, 30]):
    print(name, age, end="; ")      # a 20; b 30;
```

| Helper | Gives you | Instead of |
| --- | --- | --- |
| `enumerate(it)` | `(index, item)` pairs | `for i in range(len(xs))` |
| `zip(a, b)` | Items side by side (stops at the shortest) | Manual index juggling |
| `reversed(seq)` | Items back to front, lazily | `seq[::-1]` (copies) |
| `sorted(it, key=…)` | A new sorted list | Sorting then copying |

> [!NOTE] Key point
>
> More patterns — `while … else`, breaking out of nested loops, sentinel loops, modifying while iterating — are in <strong>Loops &amp; Iteration Patterns</strong>.

# `break`, `continue` and loop `else`

A loop's `else` block runs only if the loop finished <strong>without</strong> `break` — perfect for search loops.

```python filename:Python
def find_first_negative(nums):
    for i, n in enumerate(nums):
        if n < 0:
            break
    else:
        return None          # no break → nothing found
    return i

print(find_first_negative([3, 1, -2, 5]))   # 2
print(find_first_negative([1, 2]))          # None
```

# `match` — structural pattern matching (3.10+)

```python filename:Python
def describe(cmd):
    match cmd:
        case ["go", direction]:
            return f"moving {direction}"
        case ["pick", *items] if items:
            return f"picking {len(items)} items"
        case {"action": "quit"}:
            return "bye"
        case int() | float() as n:
            return f"number {n}"
        case _:
            return "unknown"

print(describe(["go", "north"]))       # moving north
print(describe(["pick", "a", "b"]))    # picking 2 items
print(describe({"action": "quit"}))    # bye
print(describe(3.5))                   # number 3.5
```

> [!NOTE] Key point
>
> `match` is not a C `switch`: it destructures sequences, mappings and objects, binds names, and supports guards (`if`). See <strong>Pattern Matching (match)</strong> for every pattern kind and its pitfalls.

# No `do … while`, no `++`

> [!TIP] Do
>
> Use `while True:` with a `break` at the end for do-while logic, and `i += 1` to increment.

> [!DANGER] Avoid
>
> Writing `i++` (a syntax error) or `++i` (parsed as `+(+i)` — silently does nothing).
