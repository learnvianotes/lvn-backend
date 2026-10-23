---
id: 511d2fac-f662-7055-93fb-7a4886ce3446
key: problem:sheet-150/lc-66
subject: sheet-150
topic: math-geometry
title: Plus One
slug: plus-one
order: 7
---

Difficulty: <strong>Easy</strong> · [LeetCode 66](https://leetcode.com/problems/plus-one/)

# Problem

Given a large integer represented as a digit array, increment it by one and return the result as a digit array.

# Understanding the problem

Incrementing from right-to-left naturally handles carry propagation. The only edge case: if all digits are 9, every digit becomes 0 and a new leading 1 must be prepended.

# Intuition

Walk right-to-left. If the digit is &lt; 9: increment it and return immediately (carry stops). If it is 9: set it to 0 and continue (carry propagates). If we exhaust the array, prepend a `1`.

# Approach

1. Iterate `i` from `len(digits)-1` down to 0.
2. If `digits[i] < 9`: increment and return `digits`.
3. Else: set `digits[i] = 0`, continue.
4. After the loop (all 9s case): return `[1] + digits`.

# Naive Solution — Brute Force

Reconstruct the integer, add 1, convert back to a digit array.

```python filename:Python
class Solution:
    def plusOne(self, digits):
        number = 0

        for digit in digits:
            number = number * 10 + digit

        number += 1

        return [int(d) for d in str(number)]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> plusOne(vector<int>& digits) {
        // C++ has no built-in big integer (digits can be 100 long),
        // so the "number" is kept as a decimal string
        string number;

        for (int digit : digits) {
            number += char('0' + digit);
        }

        // number += 1
        int i = number.size() - 1;
        while (i >= 0 && number[i] == '9') {
            number[i--] = '0';
        }
        if (i < 0) {
            number.insert(number.begin(), '1');
        } else {
            number[i]++;
        }

        vector<int> result;
        for (char d : number) {
            result.push_back(d - '0');
        }
        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] plusOne(int[] digits) {
        java.math.BigInteger number = java.math.BigInteger.ZERO;

        for (int digit : digits) {
            number = number.multiply(java.math.BigInteger.TEN)
                           .add(java.math.BigInteger.valueOf(digit));
        }

        number = number.add(java.math.BigInteger.ONE);

        return number.toString().chars().map(d -> d - '0').toArray();
    }
}
```

```javascript filename:JavaScript
var plusOne = function(digits) {
    let number = 0n;

    for (const digit of digits) {
        number = number * 10n + BigInt(digit);
    }

    number += 1n;

    return [...number.toString()].map(Number);
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def plusOne(self, digits):
        for i in range(len(digits) - 1, -1, -1):
            if digits[i] < 9:
                digits[i] += 1
                return digits

            digits[i] = 0

        return [1] + digits
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> plusOne(vector<int>& digits) {
        for (int i = digits.size() - 1; i >= 0; i--) {
            if (digits[i] < 9) {
                digits[i]++;
                return digits;
            }

            digits[i] = 0;
        }

        digits.insert(digits.begin(), 1);
        return digits;
    }
};
```

```java filename:Java
class Solution {
    public int[] plusOne(int[] digits) {
        for (int i = digits.length - 1; i >= 0; i--) {
            if (digits[i] < 9) {
                digits[i]++;
                return digits;
            }

            digits[i] = 0;
        }

        int[] result = new int[digits.length + 1];
        result[0] = 1;  // the rest are already 0
        return result;
    }
}
```

```javascript filename:JavaScript
var plusOne = function(digits) {
    for (let i = digits.length - 1; i >= 0; i--) {
        if (digits[i] < 9) {
            digits[i]++;
            return digits;
        }

        digits[i] = 0;
    }

    return [1, ...digits];
};
```

<strong>Time: O(n) · Space: O(1) auxiliary</strong>

# Takeaway

<strong>Pattern</strong> — Right-to-left carry propagation — stop as soon as carry disappears
