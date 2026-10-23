---
id: 3c3cf197-0008-7075-88d8-dc745eef3145
key: topic:python/regex
subject: python
topic: regex
title: Regular Expressions (re)
slug: regular-expressions-re
order: 1
---

A regular expression is a tiny pattern language for matching text. Python's `re` module finds, extracts, validates, splits and rewrites strings with it.

> [!NOTE] Rule #1
>
> Always write patterns as <strong>raw strings</strong> — `r'\d+'` — so Python doesn't interpret the backslashes before `re` sees them.

# The five ways to match

| Function | Returns | Matches where? |
| --- | --- | --- |
| `re.match(p, s)` | `Match` or `None` | Only at the <strong>start</strong> of `s` |
| `re.search(p, s)` | `Match` or `None` | The <strong>first</strong> place anywhere in `s` |
| `re.fullmatch(p, s)` | `Match` or `None` | The <strong>whole</strong> string — best for validation |
| `re.findall(p, s)` | `list` of strings (or tuples of groups) | Every non-overlapping match |
| `re.finditer(p, s)` | Iterator of `Match` objects | Every match, lazily, with positions |

```python filename:Python
import re
s = "Order 66 shipped on 2026-09-29"
print(re.match(r"\d+", s))                    # None   ← s doesn't start with a digit
m = re.search(r"\d+", s)
print(m.group(), m.start(), m.end(), m.span())   # 66 6 8 (6, 8)
print(re.findall(r"\d+", s))                  # ['66', '2026', '09', '29']
print(bool(re.fullmatch(r"\d{4}", "2026")), bool(re.fullmatch(r"\d{4}", "20261")))   # True False
print([m.start() for m in re.finditer(r"\d+", s)])   # [6, 20, 25, 28]
```

> [!WARNING] Watch out
>
> `re.match` only anchors at the start, not the end: `re.match(r'\d+', '12abc')` succeeds. For validation use `re.fullmatch` (or `^…$` with `search`).

# Pattern syntax cheat sheet

| Pattern | Matches |
| --- | --- |
| `.` | Any character except newline (any at all with `re.DOTALL`) |
| `\d` / `\D` | Digit / non-digit (Unicode digits by default) |
| `\w` / `\W` | Word char `[A-Za-z0-9_]` + Unicode letters / anything else |
| `\s` / `\S` | Whitespace / non-whitespace |
| `[abc]`, `[a-z]`, `[^0-9]` | Character class, range, negated class |
| `^` / `$` | Start / end of string (of each line with `re.MULTILINE`) |
| `\A` / `\Z` | Start / end of string, always |
| `\b` / `\B` | Word boundary / not a boundary |
| `a&#124;b` | Alternation: `a` or `b` |
| `\.`, `\*`, `\(` | Escaped literal metacharacters (or use `re.escape(text)`) |

| Quantifier | Means | Lazy version |
| --- | --- | --- |
| `*` | 0 or more | `*?` |
| `+` | 1 or more | `+?` |
| `?` | 0 or 1 (optional) | `??` |
| `{n}` | Exactly n | — |
| `{n,m}` | Between n and m | `{n,m}?` |
| `{n,}` | n or more | `{n,}?` |

```python filename:Python
import re
text = "cat catalog concat Cat"
print(re.findall(r"cat", text))              # ['cat', 'cat', 'cat']
print(re.findall(r"\bcat\b", text))          # ['cat']
print(re.findall(r"\bcat\b", text, re.I))    # ['cat', 'Cat']
print(re.findall(r"colou?r", "color colour"))    # ['color', 'colour']
print(re.findall(r"[A-Z][a-z]+", "Asha met Ravi in Pune"))   # ['Asha', 'Ravi', 'Pune']
print(re.findall(r"\d{2,3}", "1 12 123 1234"))  # ['12', '123', '123']
print(re.escape("1+1=2?"))                   # 1\+1=2\?
```

# Groups: capture, name, skip

```python filename:Python
import re
m = re.search(r"(\d{4})-(\d{2})-(\d{2})", "due 2026-09-29!")
print(m.group(0), m.group(1), m.groups())    # 2026-09-29 2026 ('2026', '09', '29')

m = re.search(r"(?P<user>[\w.]+)@(?P<domain>[\w.]+)", "mail asha.k@lvn.io now")
print(m["user"], m.group("domain"))          # asha.k lvn.io
print(m.groupdict())                         # {'user': 'asha.k', 'domain': 'lvn.io'}

print(re.findall(r"(\w+)=(\d+)", "a=1, b=22"))       # [('a', '1'), ('b', '22')]
print(re.findall(r"(?:ab)+", "ababab xab"))          # ['ababab', 'ab']
print(re.findall(r"(ab)+", "ababab xab"))            # ['ab', 'ab']   ← only the last repetition
```

| Syntax | Meaning |
| --- | --- |
| `(…)` | Capturing group — `m.group(1)` |
| `(?P<name>…)` | Named group — `m['name']`, `m.groupdict()` |
| `(?:…)` | Non-capturing group — groups for `&#124;` or quantifiers without capturing |
| `\1`, `(?P=name)` | Backreference to what a group matched |

> [!WARNING] Watch out
>
> With groups in the pattern, `findall` returns the <strong>groups</strong>, not the whole match. Use `(?:…)` for grouping you don't want captured, or `finditer` + `m.group(0)`.

# Backreferences

```python filename:Python
import re
print(re.findall(r"\b(\w+) \1\b", "this is is a test test"))   # ['is', 'test']
print(bool(re.fullmatch(r"(['\"]).*\1", "'quoted'")))           # True
print(re.sub(r"\b(\w+) \1\b", r"\1", "the the cat sat sat"))    # the cat sat
```

# Substitute &amp; split

```python filename:Python
import re
print(re.sub(r"\s+", " ", "too    many\n spaces"))                 # too many spaces
print(re.sub(r"(\d{4})-(\d{2})-(\d{2})", r"\3/\2/\1", "2026-09-29"))   # 29/09/2026
print(re.sub(r"(?P<y>\d{4})", r"<\g<y>>", "in 2026"))                # in <2026>
print(re.sub(r"\d+", lambda m: str(int(m.group()) * 2), "3 apples, 10 pears"))   # 6 apples, 20 pears
print(re.subn(r"a", "4", "banana"))                                  # ('b4n4n4', 3)
print(re.split(r"[,;]\s*", "a, b;c;  d"))                           # ['a', 'b', 'c', 'd']
print(re.split(r"([,;])", "a,b;c"))                                  # ['a', ',', 'b', ';', 'c']
```

> [!NOTE] Key point
>
> `re.sub` accepts a <strong>function</strong> as the replacement: it receives each `Match` and returns the new text — perfect for computed replacements.

# Flags

| Flag | Inline | Effect |
| --- | --- | --- |
| `re.IGNORECASE` / `re.I` | `(?i)` | Case-insensitive |
| `re.MULTILINE` / `re.M` | `(?m)` | `^` and `$` match at each line |
| `re.DOTALL` / `re.S` | `(?s)` | `.` also matches newline |
| `re.VERBOSE` / `re.X` | `(?x)` | Ignore whitespace, allow `#` comments in the pattern |
| `re.ASCII` / `re.A` | `(?a)` | `\w`, `\d`, `\s` match ASCII only |

```python filename:Python
import re
log = "ERROR disk\nINFO ok\nERROR net"
print(re.findall(r"^ERROR (\w+)", log))                 # ['disk']
print(re.findall(r"^ERROR (\w+)", log, re.M))           # ['disk', 'net']
print(re.search(r"disk.INFO", log))                     # None
print(re.search(r"disk.INFO", log, re.S).group() == "disk\nINFO")   # True
phone = re.compile(r"""
    (\d{3})     # area code
    [-.\s]?     # optional separator
    (\d{4})     # number
""", re.VERBOSE)
print(phone.search("call 080-4455").groups())           # ('080', '4455')
```

# Greedy vs lazy

```python filename:Python
import re
html = "<b>bold</b> and <i>italic</i>"
print(re.findall(r"<.+>", html))     # ['<b>bold</b> and <i>italic</i>']   ← greedy: as much as possible
print(re.findall(r"<.+?>", html))    # ['<b>', '</b>', '<i>', '</i>']     ← lazy: as little as possible
print(re.findall(r"<[^>]+>", html))  # ['<b>', '</b>', '<i>', '</i>']     ← negated class: fastest & clearest
```

# Lookahead &amp; lookbehind

Lookarounds check what is next to the current position <strong>without consuming it</strong> — they are zero-width, so they don't appear in the match.

| Syntax | Name | Asserts that… |
| --- | --- | --- |
| `X(?=Y)` | Positive lookahead | `Y` follows |
| `X(?!Y)` | Negative lookahead | `Y` does not follow |
| `(?<=Y)X` | Positive lookbehind | `Y` precedes (fixed width) |
| `(?<!Y)X` | Negative lookbehind | `Y` does not precede |

```python filename:Python
import re
print(re.findall(r"\d+(?=%)", "5% of 200 is 10"))        # ['5']
print(re.findall(r"(?<=₹)\d+", "₹250 or $30"))           # ['250']
print(re.findall(r"\b\d+\b(?!%)", "5% of 200 is 10"))    # ['200', '10']
print(re.sub(r"\B(?=(\d{3})+(?!\d))", ",", "1234567"))   # 1,234,567

strong = re.compile(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}")
print(bool(strong.fullmatch("Passw0rdX")), bool(strong.fullmatch("password1")))   # True False
```

# Compile &amp; reuse

```python filename:Python
import re
DATE = re.compile(r"(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})")
rows = ["2026-01-05 login", "bad row", "2026-02-11 logout"]
dates = [m["m"] for r in rows if (m := DATE.search(r))]
print(dates)                                  # ['01', '02']
print(DATE.pattern[:6], DATE.groups)          # (?P<y> 3
```

> [!NOTE] Key point
>
> `re` caches recently used patterns, so `re.compile` is mostly about <strong>readability and reuse</strong> — a named, documented constant at module level.

# Practical recipes

```python filename:Python
import re
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")   # good enough for forms, not RFC 5322
print(bool(EMAIL.fullmatch("a.b+tag@mail.co.in")), bool(EMAIL.fullmatch("a@b")))   # True False

tokens = re.findall(r"\d+\.?\d*|[-+*/()]", "3.5*(2+10)/4")
print(tokens)          # ['3.5', '*', '(', '2', '+', '10', ')', '/', '4']

def snake(name):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
print(snake("parseHTTPResponseCode"))       # parse_h_t_t_p_response_code
print(re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", "userIdCount").lower())   # user_id_count

print(re.findall(r"#(\w+)", "loving #python and #regex!"))   # ['python', 'regex']
```

# Performance &amp; when not to use regex

> [!WARNING] ReDoS
>
> Nested quantifiers like `(a+)+$` or `(\w+\s?)*$` can cause <strong>catastrophic backtracking</strong>: on a near-miss input the engine tries exponentially many paths and hangs (a ReDoS vulnerability). Avoid ambiguous nested repetition; prefer specific classes like `[^,]*`. Python 3.11+ also supports atomic groups `(?>…)` and possessive quantifiers `*+` to prevent backtracking.

> [!TIP] Do
>
> Use plain string methods when they suffice: `in`, `startswith`, `split`, `partition`, `str.isdigit` are faster and clearer.

> [!DANGER] Avoid
>
> Parsing HTML, JSON, CSV or email addresses fully with regex — use `html.parser`/BeautifulSoup, `json`, `csv`, `email.utils`.

# Interview questions

```question
re.match vs re.search vs re.fullmatch?

---

`match` tries only at position 0; `search` scans for the first match anywhere; `fullmatch` requires the pattern to match the entire string. Use `fullmatch` for validation.
```

```question
What's the difference between greedy and lazy quantifiers?

---

Greedy (`*`, `+`, `{n,m}`) consume as much as possible and backtrack; lazy (`*?`, `+?`) consume as little as possible. `<.+>` over `<b>x</b>` matches the whole thing, `<.+?>` matches `<b>`.
```

```question
Why use raw strings for regex?

---

In a normal string `'\b'` is a backspace character and `'\1'` is chr(1); Python would process the escapes before `re` sees them. `r'\b'` passes the backslash through literally.
```

```question
Extract all numbers (including decimals and negatives) from a string.

---

`import re`<br>`print(re.findall(r"-?\d+(?:\.\d+)?", "t=-3.5, x=42, y=0.25"))   # ['-3.5', '42', '0.25']`

The non-capturing group keeps `findall` returning whole matches.
```
