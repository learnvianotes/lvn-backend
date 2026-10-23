---
id: c01ffcbb-c985-7186-9937-df8d172ca99a
key: topic:data-science/numpy-operations
subject: data-science
topic: numpy-operations
title: Array Operations
slug: array-operations
order: 1
---

Arithmetic, aggregation, sorting, joining, splitting and filtering — all without writing a loop.

# Element-wise arithmetic

```python filename:Python
import numpy as np
a = np.array([1, 2, 3, 4])
b = np.array([5, 6, 7, 8])
print(a + 2, a * 2, a / 2)        # [3 4 5 6] [2 4 6 8] [0.5 1.  1.5 2. ]
print(a + b, b - a)               # [ 6  8 10 12] [4 4 4 4]
print(np.add(1, b), np.multiply(a, b))   # [6 7 8 9] [ 5 12 21 32]
```

> [!NOTE] Key point
>
> Combining an array with a single number (or arrays of compatible shapes) is called <strong>broadcasting</strong> — the number is applied to every element.

# Aggregations and axes

```python filename:Python
import numpy as np
m = np.array([[1, 4, 2],
              [3, 4, 6]])
print(m.max(), m.min(), m.sum())      # 6 1 20
print(m.max(axis=0))                  # [3 4 6]   ← down each column
print(m.max(axis=1))                  # [4 6]     ← across each row
print(m.mean(axis=1))                 # [2.33333333 4.33333333]
```

> [!NOTE] axis=0
>
> Collapse the rows — one result <strong>per column</strong>.

> [!NOTE] axis=1
>
> Collapse the columns — one result <strong>per row</strong>.

# Sorting

```python filename:Python
import numpy as np
arr = np.array([[1, 4, 2], [3, 4, 6], [0, -1, 5]])
print(np.sort(arr))                   # sorts each row (axis=-1 by default)
print(np.sort(arr, axis=0))           # sorts each column
```

```filename:Output
[[ 1  2  4]
 [ 3  4  6]
 [-1  0  5]]
[[ 0 -1  2]
 [ 1  4  5]
 [ 3  4  6]]
```

> [!NOTE] Key point
>
> `kind="quicksort" | "mergesort" | "stable"` picks the algorithm; the result is the same, only speed and stability (order of equal elements) differ.

# Joining and splitting

```python filename:Python
import numpy as np
a = np.array([1, 2, 3, 4])
b = np.array([5, 6, 7, 8])
print(np.vstack((a, b)).shape)        # (2, 4)   ← stacked as rows
print(np.hstack((a, b)))              # [1 2 3 4 5 6 7 8]
m = np.array([[1, 2], [3, 4]])
print(np.concatenate((m, m), axis=0).shape)   # (4, 2)
top, bottom = np.vsplit(np.vstack((a, b)), 2)
left, right = np.hsplit(np.vstack((a, b)), 2)
print(top, right[1])                  # [[1 2 3 4]] [7 8]
```

# Slicing and boolean filtering

```python filename:Python
import numpy as np
arr = np.array([1, 2, 3, 4, 5, 6, 7])
print(arr[1:5], arr[1:5:2], arr[-3:-1], arr[::2])   # [2 3 4 5] [2 4] [5 6] [1 3 5 7]

nums = np.arange(1, 40)
print(nums[nums > 35])                  # [36 37 38 39]
print(nums[(nums % 10 == 0)])           # [10 20 30]
m = np.arange(12).reshape(3, 4)
print(m[1], m[:, 2], m[1:, :2].tolist())   # [4 5 6 7] [ 2  6 10] [[4, 5], [8, 9]]
```

> [!NOTE] Correction
>
> The notebook labels slicing “DAP (Distributed Array Protocol)” — that's unrelated. Slicing is plain `start:stop:step` indexing, per axis, separated by commas.

> [!WARNING] Watch out
>
> A slice of a NumPy array is a <strong>view</strong> — changing it changes the original. Use `.copy()` when you need an independent array. (List slices, by contrast, are copies.)

> [!TIP] Do
>
> Replace Python loops over numbers with vectorised expressions: `arr[arr > 2]`, `arr * 2`, `arr.sum()`.

> [!DANGER] Avoid
>
> Building NumPy arrays by appending in a loop — collect into a list first, then call `np.array(list)` once.
