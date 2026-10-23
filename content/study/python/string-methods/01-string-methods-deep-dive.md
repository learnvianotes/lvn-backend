---
id: fab9edaa-d124-7f20-8192-daf9bf40a87b
key: topic:python/string-methods
subject: python
topic: string-methods
title: String Methods Deep Dive
slug: string-methods-deep-dive
order: 1
---

`str` has \~47 methods. Knowing the right one — `partition` instead of a regex, `casefold` instead of `lower`, `removeprefix` instead of `strip` — makes text code shorter and correct.

> [!NOTE] Remember
>
> Every method returns a <strong>new</strong> string (or a list / bool / int). Nothing modifies the original — strings are immutable.

# Case conversion

| Method | Does | Example → result |
| --- | --- | --- |
| `lower()` / `upper()` | All lower / upper case | `'PyThon'.lower()` → `'python'` |
| `casefold()` | Aggressive lower-casing for <strong>caseless comparison</strong> | `'Straße'.casefold()` → `'strasse'` |
| `title()` | First letter of every word upper | `'hello world'.title()` → `'Hello World'` |
| `capitalize()` | First character upper, <strong>rest lower</strong> | `'hELLO'.capitalize()` → `'Hello'` |
| `swapcase()` | Invert each letter's case | `'Ab'.swapcase()` → `'aB'` |

```python filename:Python
print("Straße".lower(), "Straße".casefold())          # straße strasse
print("STRASSE".casefold() == "Straße".casefold())    # True
print("STRASSE".lower() == "Straße".lower())          # False
print("they're bill's".title())                      # They'Re Bill'S
print(" ".join(w.capitalize() for w in "they're bill's".split()))   # They're Bill's
```

> [!WARNING] Watch out
>
> `title()` treats every non-letter as a word boundary, so apostrophes break it (`They'Re`). Use `capitalize()` per word, or `string.capwords(s)`.

# Searching

| Method | Returns | If not found |
| --- | --- | --- |
| `s.find(sub[, start[, end]])` | Lowest index | `-1` |
| `s.rfind(sub)` | Highest index | `-1` |
| `s.index(sub)` / `s.rindex(sub)` | Like `find` / `rfind` | raises `ValueError` |
| `s.count(sub)` | Number of <strong>non-overlapping</strong> occurrences | `0` |
| `s.startswith(p)` / `s.endswith(p)` | `bool` — `p` may be a <strong>tuple</strong> of options | `False` |
| `sub in s` | `bool` — the most readable test | `False` |

```python filename:Python
path = "reports/2026/q1.final.csv"
print(path.find("/"), path.rfind("/"), path.find("zip"))   # 7 12 -1
print(path[path.rfind(".") + 1:])                         # csv
print(path.endswith((".csv", ".tsv")))                    # True
print("aaaa".count("aa"), "2026" in path)                 # 2 True
print("banana".find("a", 2), "banana".find("a", 2, 3))    # 3 -1
```

> [!NOTE] Key point
>
> Use `find` when "not found" is a normal outcome (check for `-1`); use `index` when absence is a bug and an exception is what you want. For a plain yes/no, `in` beats both.

# Splitting family

| Method | Behaviour |
| --- | --- |
| `s.split()` | Split on <strong>runs of any whitespace</strong>, dropping empty strings and leading/trailing space |
| `s.split(sep)` | Split on an exact separator — keeps empty strings between adjacent separators |
| `s.split(sep, maxsplit)` | At most `maxsplit` splits, from the left |
| `s.rsplit(sep, maxsplit)` | At most `maxsplit` splits, from the <strong>right</strong> |
| `s.splitlines()` | Split on `\n`, `\r\n`, `\r`… without a trailing empty item |
| `s.partition(sep)` | Always a 3-tuple `(before, sep, after)` — at the <strong>first</strong> `sep` |
| `s.rpartition(sep)` | Same, at the <strong>last</strong> `sep` |

```python filename:Python
print("  a   b  c ".split())               # ['a', 'b', 'c']
print("a,,b,".split(","))                  # ['a', '', 'b', '']
print("k=v=w".split("=", 1))               # ['k', 'v=w']
print("a.b.c.txt".rsplit(".", 1))          # ['a.b.c', 'txt']
print("one\ntwo\r\nthree\n".splitlines())  # ['one', 'two', 'three']
print("one\ntwo\n".split("\n"))            # ['one', 'two', '']
print("user@example.com".partition("@"))   # ('user', '@', 'example.com')
print("no-at-sign".partition("@"))         # ('no-at-sign', '', '')
key, _, value = "timeout=30".partition("=")
print(key, value)                          # timeout 30
```

> [!NOTE] Key point
>
> `partition` never raises and always returns three parts — perfect for `key, _, value = line.partition('=')` parsing without an `if`.

# Trimming &amp; prefixes

```python filename:Python
print("  hi  ".strip() + "|")               # hi|
print("xxhixyx".strip("xy"))                # hi   ← a SET of characters, not a substring
print("www.python.org".lstrip("w."))        # python.org
print("test_login.py".removesuffix(".py"))  # test_login
print("mississippi".rstrip("ip"))           # mississ
print("mississippi".removesuffix("ippi"))   # mississ
print("reader.txt".rstrip(".txt"))          # reader   ← looks right…
print("rat.txt".rstrip(".txt"))             # ra       ← …but eats the 't' of 'rat'
print("rat.txt".removesuffix(".txt"))       # rat
```

> [!WARNING] Classic bug
>
> `strip`/`lstrip`/`rstrip(chars)` remove <strong>any combination of those characters</strong>, not a prefix/suffix string. To remove an exact prefix or suffix use `removeprefix` / `removesuffix` (3.9+).

# Padding &amp; alignment

```python filename:Python
print("[" + "hi".center(8, "*") + "]")      # [***hi***]
print("[" + "hi".ljust(6) + "]")            # [hi    ]
print("[" + "hi".rjust(6, ".") + "]")       # [....hi]
print("42".zfill(5), "-42".zfill(5))        # 00042 -0042
print("a\tbc\td".expandtabs(4))             # a   bc  d
print("-" * 10)                             # ----------
```

> [!NOTE] Key point
>
> For tables and reports, f-string alignment (`f'{x:>8}'`) does the same job inline — see <em>String Formatting</em>.

# Replacing &amp; translating

```python filename:Python
s = "a-b-c-d"
print(s.replace("-", "+"))                  # a+b+c+d
print(s.replace("-", "", 2))                # abc-d   ← only the first 2
table = str.maketrans({"a": "4", "e": "3", "o": "0"})
print("hello world".translate(table))       # h3ll0 w0rld
strip_vowels = str.maketrans("", "", "aeiou")   # 3rd arg: characters to delete
print("programming".translate(strip_vowels))    # prgrmmng
print("abc".translate(str.maketrans("abc", "xyz")))   # xyz
```

`translate` does many single-character replacements (and deletions) in <strong>one pass</strong> — much faster than chaining `replace` calls.

# Character-class predicates

| Method | True when every character is… | `'²'` | `'½'` | `'٣'` (Arabic 3) |
| --- | --- | --- | --- | --- |
| `isdecimal()` | a decimal digit usable by `int()` | False | False | True |
| `isdigit()` | a digit, including superscripts | True | False | True |
| `isnumeric()` | any numeric character, incl. fractions | True | True | True |

```python filename:Python
for s in ["123", "²", "½", "٣", "-5", "3.5", ""]:
    print(repr(s), s.isdecimal(), s.isdigit(), s.isnumeric())
```

```text filename:Output
'123' True True True
'²' False True True
'½' False False True
'٣' True True True
'-5' False False False
'3.5' False False False
'' False False False
```

```python filename:Python
print("abc123".isalnum(), "abc".isalpha(), "ABC".isupper())    # True True True
print(" \t\n".isspace(), "".isspace())                          # True False
print("my_var".isidentifier(), "2fast".isidentifier())          # True False
print(int("٣") + 1)                                             # 4
```

> [!WARNING] Watch out
>
> None of the digit predicates accept `'-5'` or `'3.5'`. To check "is this a number?", just try `int(s)` / `float(s)` and catch `ValueError` (EAFP). Also note all predicates return `False` for the empty string.

# Comparison, repetition &amp; membership

```python filename:Python
print("apple" < "banana", "Zebra" < "apple")     # True True   ← 'Z' (90) < 'a' (97)
print(sorted(["b", "C", "a"]))                   # ['C', 'a', 'b']
print(sorted(["b", "C", "a"], key=str.casefold)) # ['a', 'b', 'C']
print("10" < "9", int("10") < int("9"))          # True False
print("ab" * 3, "-" * 0 == "")                   # ababab True
print("ell" in "hello", "" in "hello")           # True True
```

> [!WARNING] Watch out
>
> String comparison is <strong>lexicographic by code point</strong>: uppercase sorts before lowercase and `'10' < '9'`. Sort with `key=str.casefold` for human order and convert numeric strings before comparing.

# Building strings efficiently

> [!TIP] Do
>
> Collect pieces in a list and call `''.join(parts)` once — O(total length). `join` needs strings: `', '.join(map(str, nums))`.

> [!DANGER] Avoid
>
> `s += piece` inside a big loop — each `+=` may copy the whole string (O(n²) worst case). CPython sometimes optimises it, but don't rely on it.

```python filename:Python
nums = [3, 1, 4]
print(", ".join(map(str, nums)))      # 3, 1, 4
print("".join(reversed("stressed")))  # desserts
try:
    ", ".join(nums)
except TypeError as e:
    print(type(e).__name__)           # TypeError
```

# Interview questions

```question
What's the difference between find and index?

---

Both return the lowest index of a substring. `find` returns `-1` when it's missing; `index` raises `ValueError`. Lists only have `index`.
```

```question
Why does 'rat.txt'.rstrip('.txt') return 'ra'?

---

`rstrip` takes a <em>set of characters</em> and strips any of them from the end — `t`, `x`, `.` — until it hits a character not in the set. Use `removesuffix('.txt')` to remove an exact suffix.
```

```question
lower() vs casefold()?

---

`casefold()` is a stronger normalisation meant for caseless matching: it also maps characters like `ß` → `ss`. Use `casefold()` when comparing user text case-insensitively; `lower()` for display.
```

```question
How do you reverse the words of a sentence?

---

`s = "  the sky  is blue "`<br>`print(" ".join(reversed(s.split())))   # blue is sky the`

`split()` with no arguments discards extra whitespace, so the result has single spaces.
```
