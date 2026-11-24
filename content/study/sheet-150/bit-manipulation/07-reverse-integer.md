---
id: e65f0b7f-87a4-760b-ba68-f06f42146af7
key: problem:sheet-150/lc-7
subject: sheet-150
topic: bit-manipulation
title: Reverse Integer
slug: reverse-integer
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 7](https://leetcode.com/problems/reverse-integer/)

# Problem

Given a signed 32-bit integer `x`, return `x` with its digits reversed. If the reversed value overflows the 32-bit signed range `[-2³¹, 2³¹-1]`, return 0.

# Understanding the problem

Extract digits right-to-left using `x % 10` and rebuild the reversed number using `result * 10 + digit`. Handle sign separately. Check overflow against 32-bit bounds before returning.

# Intuition

Digit extraction: `x % 10` gives the last digit; `x //= 10` removes it. Accumulate into `result = result * 10 + digit`. Multiply sign back in at the end and validate the 32-bit range.

# Approach

1. Store `sign = -1 if x < 0 else 1`, then `x = abs(x)`.
2. Initialize `result = 0`.
3. While `x > 0`: `digit = x % 10`, `result = result * 10 + digit`, `x //= 10`.
4. `result *= sign`.
5. If result is outside `[-2³¹, 2³¹-1]`: return 0; else return `result`.

# Naive Solution — Brute Force

Convert to string, reverse, convert back to int, then check overflow.

```python filename:Python
class Solution:
    def reverse(self, x):
        sign = -1 if x < 0 else 1
        x = abs(x)

        reversed_num = int(str(x)[::-1])
        reversed_num *= sign

        if (
            reversed_num < -(2 ** 31)
            or reversed_num > 2 ** 31 - 1
        ):
            return 0

        return reversed_num
```

```cpp filename:C%2B%2B
class Solution {
public:
    int reverse(int x) {
        int sign = x < 0 ? -1 : 1;
        long long value = llabs((long long)x);  // abs(INT_MIN) overflows int

        string digits = to_string(value);
        std::reverse(digits.begin(), digits.end());
        long long reversedNum = stoll(digits);
        reversedNum *= sign;

        if (reversedNum < INT_MIN || reversedNum > INT_MAX) {
            return 0;
        }

        return (int)reversedNum;
    }
};
```

```java filename:Java
class Solution {
    public int reverse(int x) {
        int sign = x < 0 ? -1 : 1;
        long value = Math.abs((long) x);  // Math.abs(Integer.MIN_VALUE) overflows int

        long reversedNum = Long.parseLong(
            new StringBuilder(String.valueOf(value)).reverse().toString()
        );
        reversedNum *= sign;

        if (reversedNum < Integer.MIN_VALUE || reversedNum > Integer.MAX_VALUE) {
            return 0;
        }

        return (int) reversedNum;
    }
}
```

```javascript filename:JavaScript
var reverse = function(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    let reversedNum = parseInt(String(x).split("").reverse().join(""), 10);
    reversedNum *= sign;

    if (reversedNum < -(2 ** 31) || reversedNum > 2 ** 31 - 1) {
        return 0;
    }

    return reversedNum;
};
```

<strong>Time: O(log |x|) · Space: O(log |x|)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def reverse(self, x):
        sign = -1 if x < 0 else 1
        x = abs(x)

        result = 0

        while x:
            digit = x % 10
            result = result * 10 + digit
            x //= 10

        result *= sign

        if result < -(2 ** 31) or result > 2 ** 31 - 1:
            return 0

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    int reverse(int x) {
        int sign = x < 0 ? -1 : 1;
        long long value = llabs((long long)x);  // abs(INT_MIN) overflows int

        // 64-bit result can hold any reversed 10-digit value
        long long result = 0;

        while (value) {
            int digit = value % 10;
            result = result * 10 + digit;
            value /= 10;
        }

        result *= sign;

        if (result < INT_MIN || result > INT_MAX) {
            return 0;
        }

        return (int)result;
    }
};
```

```java filename:Java
class Solution {
    public int reverse(int x) {
        int sign = x < 0 ? -1 : 1;
        long value = Math.abs((long) x);  // Math.abs(Integer.MIN_VALUE) overflows int

        // 64-bit result can hold any reversed 10-digit value
        long result = 0;

        while (value != 0) {
            long digit = value % 10;
            result = result * 10 + digit;
            value /= 10;
        }

        result *= sign;

        if (result < Integer.MIN_VALUE || result > Integer.MAX_VALUE) {
            return 0;
        }

        return (int) result;
    }
}
```

```javascript filename:JavaScript
var reverse = function(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    let result = 0;

    while (x) {
        const digit = x % 10;
        result = result * 10 + digit;
        x = Math.floor(x / 10);
    }

    result *= sign;

    if (result < -(2 ** 31) || result > 2 ** 31 - 1) {
        return 0;
    }

    return result;
};
```

<strong>Time: O(log |x|) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Digit extraction right-to-left: digit = x % 10, remove with x //= 10, rebuild with result \* 10 + digit
