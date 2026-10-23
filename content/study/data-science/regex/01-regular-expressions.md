---
id: 045ab6d8-104a-721a-b069-b8a69f35327b
key: topic:data-science/regex
subject: data-science
topic: regex
title: Regular Expressions
slug: regular-expressions
order: 1
---

Regular expressions describe text patterns — phone numbers, emails, hyphenated words — and find, extract or replace them in one line. Python's `re` module.

# search, findall, finditer

```python filename:Python
import re
m = re.search("hello", "hello world")
print(m.span(), m.start(), m.end(), m.group())    # (0, 5) 0 5 hello
print(re.search("data", "hello world"))           # None
print(re.findall("at", "The rat sat on the mat"))                 # ['at', 'at', 'at']
print([m.span() for m in re.finditer("hello", "hello world hello earth")])   # [(0, 5), (12, 17)]
```

| Function | Returns |
| --- | --- |
| `re.search(p, s)` | The first match (a Match object) or `None` |
| `re.match(p, s)` | A match only at the <strong>start</strong> of `s` |
| `re.findall(p, s)` | A list of all matching strings (or groups) |
| `re.finditer(p, s)` | Match objects one by one — with positions |
| `re.sub(p, repl, s)` | `s` with matches replaced |
| `re.split(p, s)` | `s` split at matches |

# The building blocks

| Pattern | Matches |
| --- | --- |
| `.` | Any character except newline |
| `\d` / `\D` | A digit / anything but a digit |
| `\w` / `\W` | A word character (letter, digit, \_) / anything else |
| `\s` | Whitespace |
| `[A-Za-z]`, `[^!,$@]` | One character from a set / <strong>not</strong> in a set |
| `^` / `$` | Start / end of the string |
| `*` `+` `?` `{3}` `{2,4}` | 0+, 1+, 0 or 1, exactly 3, 2 to 4 times |
| `(a&#124;b)` | Group with alternatives |

```python filename:Python
import re
print(re.findall(".at", "The rat sat on the mat and a cat"))     # ['rat', 'sat', 'mat', 'cat']
print(re.findall(r"^\d", "4 is divisible by 2"), re.findall(r"^\d", "Hi, 4"))   # ['4'] []
print(re.findall(r"\d$", "4 is divisible by 2 and not by 3"))   # ['3']
print(re.findall("[A-Z]", "Welcome to GFG 1"))                   # ['W', 'G', 'F', 'G']
print(re.search(r"\d{3}-\d{4}-\d{3}", "call 834-4324-345").group())   # 834-4324-345
```

> [!WARNING] Watch out
>
> Write patterns as <strong>raw strings</strong> — `r"\d"` — so Python doesn't treat the backslash as an escape. The notebook's `'\d'` works but triggers a warning in modern Python.

# Cleaning text

```python filename:Python
import re
print(re.sub(r"[!,$@]", "", "Eshant $ is happ@y !,").strip())    # Eshant  is happy
print(re.sub(r"\d", "", "I'm Ashish and 24").strip())            # I'm Ashish and
print(re.findall(r"\w+-\w+-\w+", "Geeks-for-Geeks and works-it-out"))   # ['Geeks-for-Geeks', 'works-it-out']
print(re.sub(r"\s+", " ", "too    many   spaces"))              # too many spaces
```

# Email patterns

```python filename:Python
import re
EMAIL = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}"
text = "Mail eshant@gfg.in or esh@aap.gov.in to contact us"
print([m.group() for m in re.finditer(EMAIL, text)])        # ['eshant@gfg.in', 'esh@aap.gov.in']

GFG_OR_GMAIL = r"[\w.]+@(gfg|gmail)\.(org|net|in|com)"
for mail in ["eshant@gfg.org", "eshant@gmail.com", "eshant@yahoo.com"]:
    print(mail, bool(re.fullmatch(GFG_OR_GMAIL, mail)))
```

```filename:Output
['eshant@gfg.in', 'esh@aap.gov.in']
eshant@gfg.org True
eshant@gmail.com True
eshant@yahoo.com False
```

> [!NOTE] Correction
>
> Two slips in the notebook's patterns: `[A-Za-z0-2]` allows only the digits 0–2 (should be `0-9`), and an unescaped `.` matches <strong>any</strong> character — write `\.` for a literal dot. Use `re.fullmatch` to validate a whole string instead of finding a pattern inside it.

# Without regex: splitting an email

```python filename:Python
mails = ["eshant@gmail.com", "eshant@aap.gov.in", "esh@geeksforgeeks.com"]
parts = [(m.split("@")[0], *m.split("@")[1].split(".", 1)) for m in mails]
print(parts)      # [('eshant', 'gmail', 'com'), ('eshant', 'aap', 'gov.in'), ('esh', 'geeksforgeeks', 'com')]
```
