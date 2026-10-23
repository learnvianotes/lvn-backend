---
id: a2132540-99f8-710e-9f4f-3733b2d25516
key: problem:sheet-150/lc-190
subject: sheet-150
topic: bit-manipulation
title: Reverse Bits
slug: reverse-bits
order: 2
---

Difficulty: <strong>Easy</strong> · [LeetCode 190](https://leetcode.com/problems/reverse-bits/)

# Problem

Reverse the bits of a given 32-bit unsigned integer and return the result.

# Understanding the problem

Extract the rightmost bit of `n` using `n & 1`, shift it into the leftmost available position of `result` using `result <<= 1` then `result |= n & 1`, then right-shift `n`. Repeat 32 times.

# Intuition

Per-iteration: shift `result` left to make room, OR in the lowest bit of `n`, then right-shift `n`. After 32 iterations the bits are fully reversed.

# Approach

1. Initialize `result = 0`.
2. Repeat 32 times: `result <<= 1`, `result |= n & 1`, `n >>= 1`.
3. Return `result`.

# Naive Solution — Brute Force

Build a binary string of `n`, reverse it, then reconstruct the integer.

```python filename:Python
class Solution:
    def reverseBits(self, n):
        binary = ""

        for _ in range(32):
            binary += str(n & 1)
            n >>= 1

        result = 0

        for bit in binary:
            result = (result << 1) | int(bit)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    uint32_t reverseBits(uint32_t n) {
        string binary = "";

        for (int i = 0; i < 32; i++) {
            binary += to_string(n & 1);
            n >>= 1;
        }

        uint32_t result = 0;

        for (char bit : binary) {
            result = (result << 1) | (bit - '0');
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    // you need treat n as an unsigned value
    public int reverseBits(int n) {
        StringBuilder binary = new StringBuilder();

        for (int i = 0; i < 32; i++) {
            binary.append(n & 1);
            n >>>= 1;
        }

        int result = 0;

        for (char bit : binary.toString().toCharArray()) {
            result = (result << 1) | (bit - '0');
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var reverseBits = function(n) {
    let binary = "";

    for (let i = 0; i < 32; i++) {
        binary += String(n & 1);
        n >>>= 1;
    }

    let result = 0;

    for (const bit of binary) {
        result = (result << 1) | Number(bit);
    }

    return result >>> 0;  // reinterpret as unsigned
};
```

<strong>Time: O(32) = O(1) · Space: O(32) = O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def reverseBits(self, n):
        result = 0

        for _ in range(32):
            result <<= 1
            result |= n & 1
            n >>= 1

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    uint32_t reverseBits(uint32_t n) {
        uint32_t result = 0;

        for (int i = 0; i < 32; i++) {
            result <<= 1;
            result |= n & 1;
            n >>= 1;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    // you need treat n as an unsigned value
    public int reverseBits(int n) {
        int result = 0;

        for (int i = 0; i < 32; i++) {
            result <<= 1;
            result |= n & 1;
            n >>>= 1;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var reverseBits = function(n) {
    let result = 0;

    for (let i = 0; i < 32; i++) {
        result <<= 1;
        result |= n & 1;
        n >>>= 1;
    }

    return result >>> 0;  // reinterpret as unsigned
};
```

<strong>Time: O(32) = O(1) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Shift + extract each bit: result &lt;&lt;= 1 → result |= (n &amp; 1) → n &gt;&gt;= 1
