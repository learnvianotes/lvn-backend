---
id: d85ffc37-108d-73bf-8b1a-ed908281f9fd
key: problem:sheet-150/lc-50
subject: sheet-150
topic: math-geometry
title: Pow(x, n)
slug: pow-x-n
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 50](https://leetcode.com/problems/powx-n/)

# Problem

Implement `pow(x, n)` — raise `x` to the power `n`. `n` may be negative.

# Understanding the problem

Multiplying `x` by itself `n` times is O(n). Binary exponentiation observes that `x^n = (x²)^(n/2)`, halving the exponent each step — this gives O(log n).

# Intuition

If `n` is even: `x^n = (x²)^(n//2)` — square `x` and halve `n`. If `n` is odd: multiply the current `x` into result first, then halve. Negative `n` → invert `x`.

# Approach

1. If `n < 0`: set `x = 1/x`, `n = -n`.
2. Initialize `result = 1`.
3. While `n > 0`: if `n % 2 == 1`, multiply `result *= x`.
4. Square: `x *= x`; halve: `n //= 2`.
5. Return `result`.

# Naive Solution — Brute Force

Multiply `x` by itself `n` times in a loop.

```python filename:Python
class Solution:
    def myPow(self, x, n):
        if n < 0:
            x = 1 / x
            n = -n

        result = 1

        for _ in range(n):
            result *= x

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    double myPow(double x, int n) {
        long long N = n;  // -n overflows int when n == INT_MIN
        if (N < 0) {
            x = 1 / x;
            N = -N;
        }

        double result = 1;

        for (long long i = 0; i < N; i++) {
            result *= x;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public double myPow(double x, int n) {
        long N = n;  // -n overflows int when n == Integer.MIN_VALUE
        if (N < 0) {
            x = 1 / x;
            N = -N;
        }

        double result = 1;

        for (long i = 0; i < N; i++) {
            result *= x;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var myPow = function(x, n) {
    if (n < 0) {
        x = 1 / x;
        n = -n;
    }

    let result = 1;

    for (let i = 0; i < n; i++) {
        result *= x;
    }

    return result;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def myPow(self, x, n):
        if n < 0:
            x = 1 / x
            n = -n

        result = 1

        while n:
            if n % 2 == 1:
                result *= x

            x *= x
            n //= 2

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    double myPow(double x, int n) {
        long long N = n;  // -n overflows int when n == INT_MIN
        if (N < 0) {
            x = 1 / x;
            N = -N;
        }

        double result = 1;

        while (N) {
            if (N % 2 == 1) {
                result *= x;
            }

            x *= x;
            N /= 2;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public double myPow(double x, int n) {
        long N = n;  // -n overflows int when n == Integer.MIN_VALUE
        if (N < 0) {
            x = 1 / x;
            N = -N;
        }

        double result = 1;

        while (N != 0) {
            if (N % 2 == 1) {
                result *= x;
            }

            x *= x;
            N /= 2;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var myPow = function(x, n) {
    if (n < 0) {
        x = 1 / x;
        n = -n;
    }

    let result = 1;

    while (n) {
        if (n % 2 === 1) {
            result *= x;
        }

        x *= x;
        n = Math.floor(n / 2);
    }

    return result;
};
```

<strong>Time: O(log n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Binary Exponentiation — halve the exponent at each step by squaring the base
