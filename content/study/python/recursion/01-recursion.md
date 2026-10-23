---
id: 77a66806-f957-77d1-867e-285b04eff3c1
key: topic:python/recursion
subject: python
topic: recursion
title: Recursion
slug: recursion
order: 1
---

A recursive function solves a problem by calling itself on a smaller piece of it. Natural for trees, divide-and-conquer and backtracking — but in Python, mind the stack depth.

> [!INFO]
>
> <strong>Recursion</strong> — a function that calls itself. It needs a <strong>base case</strong> that returns without recursing, and a <strong>recursive case</strong> that moves strictly closer to the base case.

# Anatomy

```python filename:Python
def factorial(n: int) -> int:
    if n <= 1:                    # base case
        return 1
    return n * factorial(n - 1)   # recursive case: smaller input

def digit_sum(n: int) -> int:
    return n if n < 10 else n % 10 + digit_sum(n // 10)

print(factorial(5), factorial(20))   # 120 2432902008176640000
print(digit_sum(98765))              # 35
```

1. <strong>Define the base case</strong>

   The smallest input you can answer directly (`n <= 1`, empty list, `None` node).

2. <strong>Trust the recursion</strong>

   Assume the call on the smaller input returns the right answer.

3. <strong>Combine</strong>

   Build this level's answer from the smaller result(s).

4. <strong>Check progress</strong>

   Every call must shrink the input, or it never reaches the base case.

# The call stack

Each call gets its own <strong>frame</strong> (its local variables) pushed on the call stack; it is popped when the call returns. `factorial(4)` stacks four frames before any multiplication happens.

```python filename:Python
def countdown(n, depth=0):
    print("  " * depth + f"enter {n}")
    if n > 0:
        countdown(n - 1, depth + 1)
    print("  " * depth + f"leave {n}")

countdown(2)
```

```text filename:Output
enter 2
  enter 1
    enter 0
    leave 0
  leave 1
leave 2
```

# Recursion limit &amp; RecursionError

CPython caps the stack depth (default <strong>1000</strong> frames) to avoid crashing the interpreter. Exceeding it raises `RecursionError` — also what you get from a missing base case.

```python filename:Python
import sys

def no_base_case(n):
    return no_base_case(n + 1)

try:
    no_base_case(0)
except RecursionError as e:
    print(type(e).__name__, "-", e)   # RecursionError - maximum recursion depth exceeded
print(sys.getrecursionlimit())        # 1000
```

| Option | When |
| --- | --- |
| Rewrite iteratively (loop / explicit stack) | Best fix for deep, linear recursion (linked lists, DFS on 10⁵ nodes) |
| `sys.setrecursionlimit(10**5)` | Quick fix in contests — the C stack may still overflow and crash |
| Memoize (`@cache`) | When the depth is fine but the <em>number</em> of calls explodes |

> [!WARNING] Watch out
>
> Python does <strong>not</strong> optimise tail calls. `return f(n - 1)` still consumes a frame per call, so tail-recursive style doesn't save you from `RecursionError` — Guido rejected TCO to keep full tracebacks.

# Memoization: from exponential to linear

```python filename:Python
from functools import cache

calls = 0
def fib_slow(n):
    global calls
    calls += 1
    return n if n < 2 else fib_slow(n - 1) + fib_slow(n - 2)

fib_slow(20)
print(calls)                 # 21891   ← O(2^n) calls

@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(90))               # 2880067194370816120
print(fib.cache_info().misses)   # 91   ← each n computed once
```

# Recursion → iteration with an explicit stack

```python filename:Python
tree = {"a": ["b", "c"], "b": ["d"], "c": [], "d": []}

def dfs_recursive(node, out):
    out.append(node)
    for child in tree[node]:
        dfs_recursive(child, out)
    return out

def dfs_iterative(root):
    out, stack = [], [root]
    while stack:
        node = stack.pop()
        out.append(node)
        stack.extend(reversed(tree[node]))   # reversed → same order as recursion
    return out

print(dfs_recursive("a", []))   # ['a', 'b', 'd', 'c']
print(dfs_iterative("a"))       # ['a', 'b', 'd', 'c']
```

> [!NOTE] Key point
>
> Any recursion can be converted: the explicit stack holds what the call stack held. Heap memory is plentiful; the call stack is not.

# Classic patterns

```python filename:Python
def binary_search(xs, target, lo=0, hi=None):
    hi = len(xs) - 1 if hi is None else hi
    if lo > hi:
        return -1
    mid = (lo + hi) // 2
    if xs[mid] == target:
        return mid
    if xs[mid] < target:
        return binary_search(xs, target, mid + 1, hi)
    return binary_search(xs, target, lo, mid - 1)

def power(x, n):                       # fast exponentiation: O(log n) calls
    if n == 0:
        return 1
    half = power(x, n // 2)
    return half * half * (x if n % 2 else 1)

def flatten(items):
    for it in items:
        if isinstance(it, list):
            yield from flatten(it)     # recursive generator
        else:
            yield it

print(binary_search([1, 3, 5, 7, 9], 7))     # 3
print(power(2, 30))                          # 1073741824
print(list(flatten([1, [2, [3, [4]], 5]])))  # [1, 2, 3, 4, 5]
```

# Backtracking: subsets &amp; permutations

Backtracking explores a tree of choices: <strong>choose</strong>, <strong>recurse</strong>, <strong>un-choose</strong>. It powers subsets, permutations, N-Queens, Sudoku and word search.

```python filename:Python
def subsets(nums):
    result, path = [], []
    def backtrack(i):
        if i == len(nums):
            result.append(path[:])      # copy! path keeps changing
            return
        path.append(nums[i])            # choose nums[i]
        backtrack(i + 1)
        path.pop()                      # un-choose
        backtrack(i + 1)                # skip nums[i]
    backtrack(0)
    return result

def permutations(nums):
    if len(nums) <= 1:
        return [nums[:]]
    out = []
    for i, x in enumerate(nums):
        for rest in permutations(nums[:i] + nums[i + 1:]):
            out.append([x] + rest)
    return out

print(subsets([1, 2]))          # [[1, 2], [1], [2], []]
print(permutations([1, 2, 3]))  # [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]
```

> [!WARNING] Watch out
>
> Appending `path` instead of `path[:]` stores the <em>same</em> list object many times — at the end every entry is the final (empty) path.

# Trees &amp; mutual recursion

```python filename:Python
class Node:
    def __init__(self, val, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def height(node):
    if node is None:
        return 0
    return 1 + max(height(node.left), height(node.right))

def inorder(node):
    return inorder(node.left) + [node.val] + inorder(node.right) if node else []

root = Node(2, Node(1), Node(4, Node(3)))
print(height(root), inorder(root))    # 3 [1, 2, 3, 4]

def is_even(n):
    return True if n == 0 else is_odd(n - 1)

def is_odd(n):
    return False if n == 0 else is_even(n - 1)

print(is_even(10), is_odd(7))         # True True
```

| Recursion shines | Prefer iteration |
| --- | --- |
| Trees, graphs (DFS), nested data | Simple counting loops |
| Divide and conquer (merge sort, quick sort) | Linear chains deeper than \~1000 |
| Backtracking &amp; top-down DP with `@cache` | Hot loops where call overhead matters |

```question
What is the default recursion limit in Python and how do you work around it?

---

About 1000 frames (`sys.getrecursionlimit()`). Raise it with `sys.setrecursionlimit` (risky — the C stack can still overflow), or better, convert the recursion to a loop with an explicit stack.
```

```question
Does Python optimise tail recursion?

---

No. Every call adds a frame, even `return f(n - 1)`. The design choice preserves full tracebacks. Convert tail recursion to a `while` loop instead.
```

```question
How do you speed up a recursive solution with overlapping subproblems?

---

Memoize it — decorate with `@functools.cache` (or pass a `memo` dict). Fibonacci drops from O(2ⁿ) calls to O(n). That is top-down dynamic programming.
```
