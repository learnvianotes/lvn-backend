---
id: e5cb64c4-4d2d-784e-895a-68a4709603c1
key: problem:sheet-150/lc-371
subject: sheet-150
topic: bit-manipulation
title: Sum of Two Integers
slug: sum-of-two-integers
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 371](https://leetcode.com/problems/sum-of-two-integers/)

# Problem

Calculate `a + b` without using the operators `+` or `-`.

# Understanding the problem

`a ^ b` computes the sum bit-by-bit ignoring carries. `(a & b) << 1` produces the carry bits shifted into position. Repeat, treating the carry as the new addend, until there is no carry left.

# Intuition

Binary addition: XOR gives the digit sum without carry; AND gives where carries occur, shifted left one position. Mask to 32 bits to simulate fixed-width arithmetic. Handle sign extension at the end for negative results.

# Approach

1. Set `MASK = 0xFFFFFFFF` (32 bits), `MAX_INT = 0x7FFFFFFF`.
2. While `b != 0`: compute `carry = (a & b) << 1`.
3. `a = (a ^ b) & MASK`, `b = carry & MASK`.
4. If `a <= MAX_INT` return `a`, else return `~(a ^ MASK)` (sign-extend negative).

# Naive Solution — Brute Force

In Python, just return `a + b` — but this violates the constraint.

```python filename:Python
class Solution:
    def getSum(self, a, b):
        return a + b  # violates constraint
```

```cpp filename:C%2B%2B
class Solution {
public:
    int getSum(int a, int b) {
        return a + b;  // violates constraint
    }
};
```

```java filename:Java
class Solution {
    public int getSum(int a, int b) {
        return a + b;  // violates constraint
    }
}
```

```javascript filename:JavaScript
var getSum = function(a, b) {
    return a + b;  // violates constraint
};
```

<strong>Time: O(1) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def getSum(self, a, b):
        MASK = 0xFFFFFFFF
        MAX_INT = 0x7FFFFFFF

        while b != 0:
            carry = (a & b) << 1
            a = (a ^ b) & MASK
            b = carry & MASK

        if a <= MAX_INT:
            return a

        return ~(a ^ MASK)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int getSum(int a, int b) {
        // uint32_t wraps at 32 bits, doing the job of Python's MASK
        uint32_t x = a;
        uint32_t y = b;

        while (y != 0) {
            uint32_t carry = (x & y) << 1;
            x = x ^ y;
            y = carry;
        }

        // Reinterpret the 32-bit pattern as a signed int
        return (int)x;
    }
};
```

```java filename:Java
class Solution {
    public int getSum(int a, int b) {
        // Java ints are already 32-bit two's complement, so no MASK is needed
        while (b != 0) {
            int carry = (a & b) << 1;
            a = a ^ b;
            b = carry;
        }

        return a;
    }
}
```

```javascript filename:JavaScript
var getSum = function(a, b) {
    // JS bitwise operators work on 32-bit signed ints, so no MASK is needed
    while (b !== 0) {
        const carry = (a & b) << 1;
        a = a ^ b;
        b = carry;
    }

    return a;
};
```

<strong>Time: O(1) — max 32 iterations · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — XOR = addition without carry; (a &amp; b) &lt;&lt; 1 = carry; repeat until carry is 0
