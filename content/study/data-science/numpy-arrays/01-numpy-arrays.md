---
id: 2ec13ab4-ee88-753f-90ec-247f60a98207
key: topic:data-science/numpy-arrays
subject: data-science
topic: numpy-arrays
title: NumPy Arrays
slug: numpy-arrays
order: 1
---

NumPy's `ndarray` stores numbers in one contiguous block of memory with a single type — which makes maths on millions of values fast and concise.

> [!INFO]
>
> <strong>ndarray</strong> — an N-dimensional array of values that all share one `dtype`. Operations apply to every element at once (<em>vectorisation</em>), running in C instead of a Python loop.

# List vs array

```python filename:Python
import numpy as np
l = [2, 3, 4, 5]
arr = np.array(l)
print(l, type(l).__name__)            # [2, 3, 4, 5] list
print(arr, type(arr).__name__)        # [2 3 4 5] ndarray
print(l * 2)                          # [2, 3, 4, 5, 2, 3, 4, 5]
print(arr * 2)                        # [ 4  6  8 10]
```

> [!NOTE] Key point
>
> `list * 2` repeats the list; `array * 2` multiplies every element. That difference is the whole point of NumPy.

# Shape, size and type

```python filename:Python
import numpy as np
a = np.array([2, 3, 4, 5])
b = np.array([[1, 2, 3, 4], [5, 6, 7, 8]])
print(a.ndim, b.ndim)           # 1 2
print(b.shape, b.size)          # (2, 4) 8
print(b.dtype)                  # int64
```

| Attribute | Meaning | For `b` above |
| --- | --- | --- |
| `ndim` | Number of dimensions (axes) | `2` |
| `shape` | Length along each axis — (rows, columns) | `(2, 4)` |
| `size` | Total number of elements | `8` |
| `dtype` | Element type | `int64` |

# Creating arrays

```python filename:Python
import numpy as np
print(np.zeros(3, dtype=int))                # [0 0 0]
print(np.ones((2, 2), dtype=int))            # [[1 1]
                                             #  [1 1]]
print(np.arange(4, 20, 3))                   # [ 4  7 10 13 16 19]
print(np.linspace(2.0, 3.0, num=5))          # [2.   2.25 2.5  2.75 3.  ]
print(np.full(3, 7))                         # [7 7 7]
print(np.eye(2, dtype=int))                  # [[1 0]
                                             #  [0 1]]
```

| Function | Gives | Note |
| --- | --- | --- |
| `np.zeros(shape)` / `np.ones(shape)` | All 0s / all 1s | Float by default — pass `dtype=int` for ints |
| `np.arange(start, stop, step)` | Evenly spaced by <strong>step</strong> | Like `range`; `stop` excluded |
| `np.linspace(start, stop, num)` | Exactly <strong>num</strong> points | `stop` included by default |
| `np.full(shape, v)` | All `v` |  |
| `np.eye(n)` | Identity matrix |  |

# Random numbers

```python filename:Python
import numpy as np
rng = np.random.default_rng(seed=42)       # the modern API; a seed makes results repeatable
print(rng.random(3).round(3))              # [0.774 0.439 0.859]
print(rng.integers(1, 7, size=5))          # [1 5 2 1 4]
print(rng.normal(0, 1, size=2).round(3))   # [ 0.128 -0.316]
```

> [!NOTE] Key point
>
> The notebook uses `np.random.random(3)` — the older API. Both work; `default_rng` is recommended, and <strong>seeding</strong> matters whenever results must be reproducible (experiments, tests).

# reshape

```python filename:Python
import numpy as np
arr = np.arange(10)
print(arr.reshape(2, 5))        # [[0 1 2 3 4]
                                #  [5 6 7 8 9]]
print(arr.reshape(5, -1).shape) # (5, 2)   ← -1 means "work it out"
print(np.arange(16).reshape(2, 8, 1).shape)   # (2, 8, 1)
```

> [!WARNING] Watch out
>
> The new shape must hold exactly the same number of elements: `np.arange(10).reshape(3, 3)` raises `ValueError`.
