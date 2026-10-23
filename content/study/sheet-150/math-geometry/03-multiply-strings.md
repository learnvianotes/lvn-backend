---
id: 0ecce99a-a489-70df-a1b0-df68e0f5abf5
key: problem:sheet-150/lc-43
subject: sheet-150
topic: math-geometry
title: Multiply Strings
slug: multiply-strings
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 43](https://leetcode.com/problems/multiply-strings/)

# Problem

Given two non-negative integers as strings, return their product as a string. You may not convert them to integers directly.

# Understanding the problem

Digit `i` of `num1` multiplied by digit `j` of `num2` contributes to position `i+j+1` in the result array (of size `n+m`). Propagate carry leftward to position `i+j`.

# Intuition

Simulate elementary-school long multiplication. Use a result array of size `n+m`. For each pair of digits at indices `(i, j)`, add their product to `result[i+j+1]` and propagate the carry to `result[i+j]`. Strip leading zeros at the end.

# Approach

1. Return `'0'` if either input is `'0'`.
2. Allocate `result = [0] * (n + m)`.
3. Nested loops `i` from `n-1` to 0, `j` from `m-1` to 0.
4. `product = int(num1[i]) * int(num2[j])`; add to `result[i+j+1]`.
5. Carry: `result[i+j] += result[i+j+1] // 10`; `result[i+j+1] %= 10`.
6. Strip leading zeros and join digits into a string.

# Naive Solution — Brute Force

Convert both strings to integers, multiply, return the result as a string. (Violates the problem constraint but useful baseline.)

```python filename:Python
class Solution:
    def multiply(self, num1, num2):
        return str(int(num1) * int(num2))
```

```cpp filename:C%2B%2B
class Solution {
public:
    string multiply(string num1, string num2) {
        // C++ has no built-in big integer, so the closest shortcut is
        // "num1 * digit, shifted" for each digit of num2, summed up
        string total = "0";

        for (int j = 0; j < (int)num2.size(); j++) {
            total = add(total + "0", times(num1, num2[j] - '0'));
        }

        int start = 0;
        while (start < (int)total.size() - 1 && total[start] == '0') {
            start++;
        }
        return total.substr(start);
    }

private:
    string times(const string& num, int digit) {
        string result;
        int carry = 0;
        for (int i = num.size() - 1; i >= 0; i--) {
            int value = (num[i] - '0') * digit + carry;
            result += char('0' + value % 10);
            carry = value / 10;
        }
        if (carry) result += char('0' + carry);
        reverse(result.begin(), result.end());
        return result;
    }

    string add(const string& a, const string& b) {
        string result;
        int i = a.size() - 1, j = b.size() - 1, carry = 0;
        while (i >= 0 || j >= 0 || carry) {
            int value = carry;
            if (i >= 0) value += a[i--] - '0';
            if (j >= 0) value += b[j--] - '0';
            result += char('0' + value % 10);
            carry = value / 10;
        }
        reverse(result.begin(), result.end());
        return result;
    }
};
```

```java filename:Java
class Solution {
    public String multiply(String num1, String num2) {
        return new java.math.BigInteger(num1)
            .multiply(new java.math.BigInteger(num2))
            .toString();
    }
}
```

```javascript filename:JavaScript
var multiply = function(num1, num2) {
    return (BigInt(num1) * BigInt(num2)).toString();
};
```

<strong>Time: O(n + m) · Space: O(n + m)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def multiply(self, num1, num2):
        if num1 == "0" or num2 == "0":
            return "0"

        n = len(num1)
        m = len(num2)
        result = [0] * (n + m)

        for i in range(n - 1, -1, -1):
            for j in range(m - 1, -1, -1):
                product = int(num1[i]) * int(num2[j])
                pos = i + j + 1

                result[pos] += product
                result[pos - 1] += result[pos] // 10
                result[pos] %= 10

        # Strip leading zeros
        start = 0
        while start < len(result) - 1 and result[start] == 0:
            start += 1

        return "".join(str(d) for d in result[start:])
```

```cpp filename:C%2B%2B
class Solution {
public:
    string multiply(string num1, string num2) {
        if (num1 == "0" || num2 == "0") {
            return "0";
        }

        int n = num1.size();
        int m = num2.size();
        vector<int> result(n + m, 0);

        for (int i = n - 1; i >= 0; i--) {
            for (int j = m - 1; j >= 0; j--) {
                int product = (num1[i] - '0') * (num2[j] - '0');
                int pos = i + j + 1;

                result[pos] += product;
                result[pos - 1] += result[pos] / 10;
                result[pos] %= 10;
            }
        }

        // Strip leading zeros
        int start = 0;
        while (start < (int)result.size() - 1 && result[start] == 0) {
            start++;
        }

        string answer;
        for (int k = start; k < (int)result.size(); k++) {
            answer += to_string(result[k]);
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public String multiply(String num1, String num2) {
        if (num1.equals("0") || num2.equals("0")) {
            return "0";
        }

        int n = num1.length();
        int m = num2.length();
        int[] result = new int[n + m];

        for (int i = n - 1; i >= 0; i--) {
            for (int j = m - 1; j >= 0; j--) {
                int product = (num1.charAt(i) - '0') * (num2.charAt(j) - '0');
                int pos = i + j + 1;

                result[pos] += product;
                result[pos - 1] += result[pos] / 10;
                result[pos] %= 10;
            }
        }

        // Strip leading zeros
        int start = 0;
        while (start < result.length - 1 && result[start] == 0) {
            start++;
        }

        StringBuilder answer = new StringBuilder();
        for (int k = start; k < result.length; k++) {
            answer.append(result[k]);
        }
        return answer.toString();
    }
}
```

```javascript filename:JavaScript
var multiply = function(num1, num2) {
    if (num1 === "0" || num2 === "0") {
        return "0";
    }

    const n = num1.length;
    const m = num2.length;
    const result = new Array(n + m).fill(0);

    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            const product = Number(num1[i]) * Number(num2[j]);
            const pos = i + j + 1;

            result[pos] += product;
            result[pos - 1] += Math.floor(result[pos] / 10);
            result[pos] %= 10;
        }
    }

    // Strip leading zeros
    let start = 0;
    while (start < result.length - 1 && result[start] === 0) {
        start++;
    }

    return result.slice(start).join("");
};
```

<strong>Time: O(n × m) · Space: O(n + m)</strong>

# Takeaway

<strong>Pattern</strong> — String arithmetic — position array: digit\[i\] × digit\[j\] maps to index i+j+1, carry propagates to i+j
