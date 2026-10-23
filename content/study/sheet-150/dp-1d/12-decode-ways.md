---
id: 40076208-1430-7ba2-8e3c-baa2482bc9c4
key: problem:sheet-150/lc-91
subject: sheet-150
topic: dp-1d
title: Decode Ways
slug: decode-ways
order: 12
---

Difficulty: <strong>Medium</strong> · [LeetCode 91](https://leetcode.com/problems/decode-ways/)

# Problem

A message containing letters A-Z is encoded using 1-26. Return total number of ways to decode string `s`.

# Understanding the problem

Try decoding one digit (if non-zero) or two digits (if between 10 and 26). 1 or 2 character state transitions.

# Intuition

`dp[i]` stores number of ways to decode string of length `i`. Optimize space to `prev1` and `prev2`.

# Approach

1. If empty string or starts with `'0'`, return 0.
2. Maintain `prev2 = 1` and `prev1 = 1`.
3. For index `i` from 1 to `len(s)-1`: if `s[i] != '0'`, `current += prev1`. If `10 <= int(s[i-1:i+1]) <= 26`, `current += prev2`.
4. Shift `prev2 = prev1`, `prev1 = current`. Return `prev1`.

# Naive Solution — Recursion

Recursively try single digit and double digit decodings from index `i`.

```python filename:Python
class Solution:
    def numDecodings(self, s):

        def dfs(i):
            if i == len(s):
                return 1

            if s[i] == "0":
                return 0

            result = dfs(i + 1)

            if (
                i + 1 < len(s)
                and 10 <= int(s[i:i + 2]) <= 26
            ):
                result += dfs(i + 2)

            return result

        return dfs(0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int numDecodings(string s) {
        return dfs(s, 0);
    }

private:
    int dfs(const string& s, int i) {
        if (i == (int)s.size()) return 1;
        if (s[i] == '0') return 0;

        int result = dfs(s, i + 1);

        if (i + 1 < (int)s.size()) {
            int twoDigit = stoi(s.substr(i, 2));
            if (twoDigit >= 10 && twoDigit <= 26) {
                result += dfs(s, i + 2);
            }
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int numDecodings(String s) {
        return dfs(s, 0);
    }

    private int dfs(String s, int i) {
        if (i == s.length()) return 1;
        if (s.charAt(i) == '0') return 0;

        int result = dfs(s, i + 1);

        if (i + 1 < s.length()) {
            int twoDigit = Integer.parseInt(s.substring(i, i + 2));
            if (twoDigit >= 10 && twoDigit <= 26) {
                result += dfs(s, i + 2);
            }
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var numDecodings = function(s) {
    const dfs = (i) => {
        if (i === s.length) return 1;
        if (s[i] === "0") return 0;

        let result = dfs(i + 1);

        if (i + 1 < s.length) {
            const twoDigit = Number(s.slice(i, i + 2));
            if (twoDigit >= 10 && twoDigit <= 26) {
                result += dfs(i + 2);
            }
        }

        return result;
    };

    return dfs(0);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def numDecodings(self, s):
        n = len(s)

        if not s or s[0] == "0":
            return 0

        dp = [0] * (n + 1)
        dp[0] = 1
        dp[1] = 1

        for i in range(2, n + 1):

            if s[i - 1] != "0":
                dp[i] += dp[i - 1]

            two_digit = int(s[i - 2:i])

            if 10 <= two_digit <= 26:
                dp[i] += dp[i - 2]

        return dp[n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int numDecodings(string s) {
        int n = s.size();
        if (n == 0 || s[0] == '0') return 0;

        vector<int> dp(n + 1, 0);
        dp[0] = 1;
        dp[1] = 1;

        for (int i = 2; i <= n; i++) {
            if (s[i - 1] != '0') {
                dp[i] += dp[i - 1];
            }

            int twoDigit = (s[i - 2] - '0') * 10 + (s[i - 1] - '0');

            if (twoDigit >= 10 && twoDigit <= 26) {
                dp[i] += dp[i - 2];
            }
        }

        return dp[n];
    }
};
```

```java filename:Java
class Solution {
    public int numDecodings(String s) {
        int n = s.length();
        if (n == 0 || s.charAt(0) == '0') return 0;

        int[] dp = new int[n + 1];
        dp[0] = 1;
        dp[1] = 1;

        for (int i = 2; i <= n; i++) {
            if (s.charAt(i - 1) != '0') {
                dp[i] += dp[i - 1];
            }

            int twoDigit = Integer.parseInt(s.substring(i - 2, i));

            if (twoDigit >= 10 && twoDigit <= 26) {
                dp[i] += dp[i - 2];
            }
        }

        return dp[n];
    }
}
```

```javascript filename:JavaScript
var numDecodings = function(s) {
    const n = s.length;
    if (n === 0 || s[0] === "0") return 0;

    const dp = new Array(n + 1).fill(0);
    dp[0] = 1;
    dp[1] = 1;

    for (let i = 2; i <= n; i++) {
        if (s[i - 1] !== "0") {
            dp[i] += dp[i - 1];
        }

        const twoDigit = Number(s.slice(i - 2, i));

        if (twoDigit >= 10 && twoDigit <= 26) {
            dp[i] += dp[i - 2];
        }
    }

    return dp[n];
};
```

<strong>Time: O(n) · Space: O(1) (Space Optimized) / O(n) (DP Array)</strong>
