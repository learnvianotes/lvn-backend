---
id: a5cfa384-dad0-7b38-a6fe-3c9b8e74c844
key: problem:sheet-150/lc-191
subject: sheet-150
topic: bit-manipulation
title: Number of 1 Bits
slug: number-of-1-bits
order: 3
---

Difficulty: <strong>Easy</strong> · [LeetCode 191](https://leetcode.com/problems/number-of-1-bits/)

# Problem

Given an unsigned integer, return the number of set bits (1s) in its binary representation (Hamming weight).

# Understanding the problem

`n & (n-1)` clears the lowest set bit. Repeating this until `n == 0` tells us exactly how many 1-bits exist — one iteration per set bit, not per total bit.

# Intuition

`n - 1` flips the lowest set bit and all bits below it. So `n & (n-1)` removes exactly the lowest 1-bit. Each iteration costs one set bit — loop runs exactly `k` times where `k` is the Hamming weight.

# Approach

1. Initialize `count = 0`.
2. While `n != 0`: `n &= n - 1`; `count += 1`.
3. Return `count`.

# Naive Solution — Brute Force

Check all 32 bits one by one using `n & 1` and right-shift.

```python filename:Python
class Solution:
    def hammingWeight(self, n):
        count = 0

        for _ in range(32):
            if n & 1:
                count += 1

            n >>= 1

        return count
```

```cpp filename:C%2B%2B
class Solution {
public:
    int hammingWeight(uint32_t n) {
        int count = 0;

        for (int i = 0; i < 32; i++) {
            if (n & 1) {
                count++;
            }

            n >>= 1;
        }

        return count;
    }
};
```

```java filename:Java
class Solution {
    // you need to treat n as an unsigned value
    public int hammingWeight(int n) {
        int count = 0;

        for (int i = 0; i < 32; i++) {
            if ((n & 1) == 1) {
                count++;
            }

            n >>>= 1;
        }

        return count;
    }
}
```

```javascript filename:JavaScript
var hammingWeight = function(n) {
    let count = 0;

    for (let i = 0; i < 32; i++) {
        if (n & 1) {
            count++;
        }

        n >>>= 1;
    }

    return count;
};
```

<strong>Time: O(32) = O(1) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def hammingWeight(self, n):
        count = 0

        while n:
            n &= n - 1
            count += 1

        return count
```

```cpp filename:C%2B%2B
class Solution {
public:
    int hammingWeight(uint32_t n) {
        int count = 0;

        while (n) {
            n &= n - 1;
            count++;
        }

        return count;
    }
};
```

```java filename:Java
class Solution {
    // you need to treat n as an unsigned value
    public int hammingWeight(int n) {
        int count = 0;

        while (n != 0) {
            n &= n - 1;
            count++;
        }

        return count;
    }
}
```

```javascript filename:JavaScript
var hammingWeight = function(n) {
    let count = 0;

    while (n !== 0) {
        n &= n - 1;
        count++;
    }

    return count;
};
```

<strong>Time: O(k) — k = number of set bits · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — n &amp; (n-1) removes the lowest set bit — loop runs once per 1-bit
