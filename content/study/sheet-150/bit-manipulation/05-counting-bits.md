---
id: 587ec36c-4d5a-7dd7-8d02-e7cd9f567146
key: problem:sheet-150/lc-338
subject: sheet-150
topic: bit-manipulation
title: Counting Bits
slug: counting-bits
order: 5
---

Difficulty: <strong>Easy</strong> · [LeetCode 338](https://leetcode.com/problems/counting-bits/)

# Problem

Given `n`, return an array of length `n+1` where `result[i]` is the number of 1-bits in `i`.

# Understanding the problem

Right-shifting a number by 1 removes its last bit: `num >> 1` has the same 1-bits as `num` minus the contribution of its last bit. So `bits[num] = bits[num >> 1] + (num & 1)` — build on already-computed results.

# Intuition

DP recurrence: `bits[num] = bits[num >> 1] + (num & 1)`. Removing the last bit gives a smaller number whose bit count is already known.

# Approach

1. Initialize `result = [0] * (n + 1)`.
2. For `num` in range(1, n+1):
3. `result[num] = result[num >> 1] + (num & 1)`.
4. Return `result`.

# Naive Solution — Brute Force

For each number 0..n, count its 1-bits independently using `n & (n-1)`.

```python filename:Python
class Solution:
    def countBits(self, n):
        result = []

        for num in range(n + 1):
            count = 0
            x = num

            while x:
                x &= x - 1
                count += 1

            result.append(count)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> countBits(int n) {
        vector<int> result;

        for (int num = 0; num <= n; num++) {
            int count = 0;
            int x = num;

            while (x) {
                x &= x - 1;
                count++;
            }

            result.push_back(count);
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] countBits(int n) {
        int[] result = new int[n + 1];

        for (int num = 0; num <= n; num++) {
            int count = 0;
            int x = num;

            while (x != 0) {
                x &= x - 1;
                count++;
            }

            result[num] = count;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var countBits = function(n) {
    const result = [];

    for (let num = 0; num <= n; num++) {
        let count = 0;
        let x = num;

        while (x) {
            x &= x - 1;
            count++;
        }

        result.push(count);
    }

    return result;
};
```

<strong>Time: O(n log n) · Space: O(n) output</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def countBits(self, n):
        result = [0] * (n + 1)

        for num in range(1, n + 1):
            result[num] = (
                result[num >> 1]
                + (num & 1)
            )

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> countBits(int n) {
        vector<int> result(n + 1, 0);

        for (int num = 1; num <= n; num++) {
            result[num] = result[num >> 1] + (num & 1);
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] countBits(int n) {
        int[] result = new int[n + 1];

        for (int num = 1; num <= n; num++) {
            result[num] = result[num >> 1] + (num & 1);
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var countBits = function(n) {
    const result = new Array(n + 1).fill(0);

    for (let num = 1; num <= n; num++) {
        result[num] = result[num >> 1] + (num & 1);
    }

    return result;
};
```

<strong>Time: O(n) · Space: O(n) output</strong>

# Takeaway

<strong>Pattern</strong> — DP + bit shift: bits\[num\] = bits\[num &gt;&gt; 1\] + (num &amp; 1)
