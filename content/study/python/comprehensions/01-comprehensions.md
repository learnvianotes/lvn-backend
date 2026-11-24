---
id: 06d11cd1-2c18-75d7-95cd-b691116c99fb
key: topic:python/comprehensions
subject: python
topic: comprehensions
title: Comprehensions
slug: comprehensions
order: 1
---

Comprehensions build lists, dicts and sets in one readable expression: <em>what</em> to produce, <em>from where</em>, and <em>which</em> items.

# The shape

```python filename:Python
squares = [x * x for x in range(6)]
evens = [x for x in range(10) if x % 2 == 0]
labels = ["even" if x % 2 == 0 else "odd" for x in range(4)]
print(squares)    # [0, 1, 4, 9, 16, 25]
print(evens)      # [0, 2, 4, 6, 8]
print(labels)     # ['even', 'odd', 'even', 'odd']
```

> [!NOTE] Key point
>
> A filter `if` goes <strong>after</strong> the `for`. A conditional <em>value</em> (`a if c else b`) goes <strong>before</strong> it.

# Dict &amp; set comprehensions

```python filename:Python
words = ["apple", "bat", "cherry"]
lengths = {w: len(w) for w in words}
inverted = {v: k for k, v in lengths.items()}
first_letters = {w[0] for w in words}
print(lengths)            # {'apple': 5, 'bat': 3, 'cherry': 6}
print(inverted[3])        # bat
print(sorted(first_letters))   # ['a', 'b', 'c']
```

# Nested loops &amp; flattening

```python filename:Python
matrix = [[1, 2, 3], [4, 5, 6]]
flat = [x for row in matrix for x in row]          # outer loop first
transposed = [list(col) for col in zip(*matrix)]
pairs = [(i, j) for i in range(3) for j in range(i + 1, 3)]
print(flat)          # [1, 2, 3, 4, 5, 6]
print(transposed)    # [[1, 4], [2, 5], [3, 6]]
print(pairs)         # [(0, 1), (0, 2), (1, 2)]
```

# Generator expressions

Swap `[]` for `()` and nothing is built up front — values are produced lazily, one at a time. Ideal when you only aggregate.

```python filename:Python
total = sum(x * x for x in range(1_000_000))   # no million-item list in memory
print(total)                                    # 333332833333500000
print(any(n > 10 for n in [3, 12, 5]))          # True
```

> [!TIP] Do
>
> Use comprehensions for simple map/filter transformations that fit on one or two lines.

> [!DANGER] Avoid
>
> Nesting three levels deep or adding side effects (`[print(x) for x in xs]`) — write a normal loop instead.
