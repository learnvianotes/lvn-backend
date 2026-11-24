---
id: b34f96c3-a1b4-7269-b0ee-eb8e39a4c484
key: topic:python/strings
subject: python
topic: strings
title: Strings
slug: strings
order: 1
---

`str` is an immutable sequence of Unicode characters — indexing, slicing and methods all return <em>new</em> strings.

# Indexing &amp; slicing

`s[start:stop:step]` — `start` is included, `stop` is excluded, negative indices count from the end.

```python filename:Python
s = "interview"
print(s[0], s[-1], len(s))      # i w 9
print(s[0:5], s[5:], s[-4:])    # inter view view
print(s[::-1], s[::2])          # weivretni itriw
```

# Immutability

```python filename:Python
s = "cat"
try:
    s[0] = "b"
except TypeError as e:
    print("TypeError:", e)       # TypeError: 'str' object does not support item assignment
s = "b" + s[1:]                  # build a new string instead
print(s)                         # bat
```

> [!WARNING] Performance
>
> Building a string with `+=` in a loop can be O(n²). Collect pieces in a list and call `''.join(parts)` once — O(n).

# Essential methods

| Method | Does | Example → result |
| --- | --- | --- |
| `split(sep)` / `join(it)` | String ↔ list | `'a,b'.split(',')` → `['a', 'b']` |
| `strip()` / `lstrip()` / `rstrip()` | Trim whitespace (or given chars) | `' hi '.strip()` → `'hi'` |
| `lower()` / `upper()` / `title()` | Change case | `'Py'.lower()` → `'py'` |
| `find(x)` / `index(x)` | Position or −1 / raises | `'abc'.find('z')` → `-1` |
| `replace(a, b)` | Replace all occurrences | `'aa'.replace('a','b')` → `'bb'` |
| `startswith` / `endswith` | Prefix / suffix test | `'file.py'.endswith('.py')` → `True` |
| `isdigit` / `isalpha` / `isalnum` | Character classes | `'123'.isdigit()` → `True` |
| `count(x)` | Non-overlapping occurrences | `'banana'.count('a')` → `3` |

```python filename:Python
words = "  the quick  brown fox ".split()   # split() with no args handles runs of spaces
print(words)                                 # ['the', 'quick', 'brown', 'fox']
print("-".join(words))                       # the-quick-brown-fox
print(" ".join(w.capitalize() for w in words))   # The Quick Brown Fox
```

> [!NOTE] Go deeper
>
> This page is the overview. The next topics go deeper: <em>String Methods Deep Dive</em>, <em>String Formatting &amp; f-strings</em>, <em>Unicode, Bytes &amp; Encodings</em> and <em>Regular Expressions</em>.

# f-strings &amp; formatting

```python filename:Python
name, score, ratio = "Asha", 93, 0.8567
print(f"{name} scored {score}")          # Asha scored 93
print(f"{ratio:.2%} | {score:05d}")      # 85.67% | 00093
print(f"{name!r:>8}|{score:<5}|")        #   'Asha'|93   |
print(f"{score=}")                       # score=93
print(f"{1_000_000:,}")                  # 1,000,000
```

# Characters, Unicode &amp; bytes

```python filename:Python
print(ord("A"), chr(97))                 # 65 a
print(len("naïve"), len("naïve".encode("utf-8")))   # 5 6
print("é".encode(), b"\xc3\xa9".decode())          # b'\xc3\xa9' é
```

> [!NOTE] str
>
> Text — a sequence of Unicode code points.

> [!NOTE] bytes
>
> Raw 8-bit data — files, network, hashing. Convert with `encode()` / `decode()`.

# Interview favourites

```python filename:Python
def is_palindrome(s: str) -> bool:
    cleaned = [c.lower() for c in s if c.isalnum()]
    return cleaned == cleaned[::-1]

def is_anagram(a: str, b: str) -> bool:
    from collections import Counter
    return Counter(a) == Counter(b)

print(is_palindrome("A man, a plan, a canal: Panama"))   # True
print(is_anagram("listen", "silent"))                    # True
```
