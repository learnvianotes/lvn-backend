---
id: 6e4d2175-d6cb-790d-b773-d1a18aec4658
key: topic:python/pythonic
subject: python
topic: pythonic
title: Pythonic Code & Idioms
slug: pythonic-code-idioms
order: 1
---

“Pythonic” code uses the language's features the way they were intended — shorter, clearer and usually faster. Interviewers notice.

# Before → after

| Instead of | Write |
| --- | --- |
| `for i in range(len(xs)): print(xs[i])` | `for x in xs: print(x)` |
| `i = 0` … `i += 1` inside a loop | `for i, x in enumerate(xs)` |
| `if len(xs) == 0:` | `if not xs:` |
| `if x == True:` / `if x == None:` | `if x:` / `if x is None:` |
| `tmp = a; a = b; b = tmp` | `a, b = b, a` |
| `result = []` + loop + `append` | a list comprehension |
| `d[k] = d[k] + 1 if k in d else 1` | `d[k] = d.get(k, 0) + 1` or `Counter` |
| `s = ''` + `s += piece` in a loop | `''.join(pieces)` |
| `open` … `close()` | `with open(…) as f:` |
| `x > 0 and x < 10` | `0 < x < 10` |

# EAFP vs LBYL

> [!NOTE] LBYL — Look Before You Leap
>
> Check first: `if key in d: value = d[key]`. Common in C/Java.

> [!NOTE] EAFP — Easier to Ask Forgiveness than Permission
>
> Just try it and handle the failure: `try: value = d[key] except KeyError: …`. Idiomatic Python, and avoids race conditions.

# Idioms worth knowing

```python filename:Python
nums = [4, 8, 15, 16, 23, 42]

print(sum(1 for n in nums if n % 2 == 0))         # 4
print(all(n > 0 for n in nums), any(n > 40 for n in nums))   # True True
print(max(enumerate(nums), key=lambda p: p[1]))    # (5, 42)

first, *rest = nums
print(first, len(rest))                            # 4 5

pairs = list(zip(nums, nums[1:]))                  # neighbouring pairs
print(pairs[:2])                                   # [(4, 8), (8, 15)]

counts = {}
for word in "to be or not to be".split():
    counts[word] = counts.get(word, 0) + 1
print(sorted(counts.items(), key=lambda kv: -kv[1])[:2])   # [('to', 2), ('be', 2)]
```

# Readable over clever

> [!TIP] Do
>
> Name things well, keep functions short, return early, and add type hints on public functions.

> [!DANGER] Avoid
>
> One-liners that need a comment to explain — clever is the enemy of correct in an interview.
