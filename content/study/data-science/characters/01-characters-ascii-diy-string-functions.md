---
id: 72348b43-d6cd-7d9e-bf2e-c4bb79432e5f
key: topic:data-science/characters
subject: data-science
topic: characters
title: Characters, ASCII & DIY String Functions
slug: characters-ascii-diy-string-functions
order: 1
---

Every character is a number. Knowing the codes lets you build string functions yourself — a common interview exercise and the basis of text encoding.

# ord() and chr()

```python filename:Python
text = "The quick brown fox"
print([ord(c) for c in "Tq "])                    # [84, 113, 32]
print(chr(97), chr(65), chr(93))                  # a A ]
codes = [ord(c) for c in text]
print("".join(chr(n) for n in codes) == text)     # True
print("".join(chr(n) for n in range(65, 91)))     # ABCDEFGHIJKLMNOPQRSTUVWXYZ
print("".join(chr(n) for n in range(90, 64, -1))) # ZYXWVUTSRQPONMLKJIHGFEDCBA
```

| Range | Characters |
| --- | --- |
| 48–57 | `0`–`9` |
| 65–90 | `A`–`Z` |
| 97–122 | `a`–`z` (each lowercase letter = its uppercase + 32) |
| 32 | space |

> [!NOTE] Correction
>
> The notebook prints `ascii` instead of its list `ascii_` and gets `<built-in function ascii>` — `ascii` is a built-in function. Avoid names that shadow built-ins (`list`, `str`, `sum`, `ascii`…).

# DIY upper, lower and title

```python filename:Python
def upper(text):
    return "".join(chr(ord(c) - 32) if "a" <= c <= "z" else c for c in text)

def lower(text):
    return "".join(chr(ord(c) + 32) if "A" <= c <= "Z" else c for c in text)

def title(text):
    return " ".join(upper(w[:1]) + lower(w[1:]) for w in text.split(" "))

print(upper("delhi"), lower("CARTOON"))               # DELHI cartoon
print(title("let us study machine learning today"))   # Let Us Study Machine Learning Today
print(title("hello  world"))                          # Hello  World
```

> [!NOTE] Key point
>
> `w[:1]` instead of `w[0]` keeps `title` from crashing on empty words (two spaces in a row).

# DIY isalpha and isdigit

```python filename:Python
def is_alpha(text):
    return len(text) > 0 and all("A" <= c <= "Z" or "a" <= c <= "z" for c in text)

def is_digit(text):
    return len(text) > 0 and all("0" <= c <= "9" for c in text)

print(is_alpha("datascience"), is_alpha("1234"))     # True False
print(is_digit("1234"), is_digit("machinelearning")) # True False
```

> [!WARNING] Bug in the notebook
>
> The notebook's `check_alpha` returns `False` for `'datascience'` — its `if len(text) == c` check sits <strong>inside</strong> the loop, so it decides after the first character. Check after the loop (or use `all()` as above).

# Finding runs of digits and words

```python filename:Python
txt = "The number is 8372493 not 423423"
runs, current = [], ""
for ch in txt:
    if ch.isdigit():
        current += ch
    elif current:
        runs.append(current)
        current = ""
if current:
    runs.append(current)
print(runs)                                     # ['8372493', '423423']

sentence = "GFG is launching a new Data Structure in Python Course"
print([w for w in sentence.split() if w.lower().startswith("i")])   # ['is', 'in']
print([w for w in sentence.split() if w.lower().endswith("e")])     # ['Structure', 'Course']
print("let us study data science".find("data"))                     # 13
```
