---
id: f785d2ec-7dca-73b5-9e85-bff0c23f076f
key: problem:sheet-150/lc-115
subject: sheet-150
topic: dp-2d
title: Distinct Subsequences
slug: distinct-subsequences
order: 3
---

Difficulty: <strong>Hard</strong> · [LeetCode 115](https://leetcode.com/problems/distinct-subsequences/)

# Problem

Count how many times `t` occurs as a subsequence of `s`.

# Understanding the problem

At matching character `s[i-1] == t[j-1]`, we can use it (`dp[i-1][j-1]`) or skip it (`dp[i-1][j]`). Sum both choices!

# Intuition

2D DP table `dp[i][j]` storing ways to form `t[:j]` using prefix `s[:i]`.

# Approach

1. Initialize `dp = [[0] * (n + 1) for _ in range(m + 1)]`.
2. Base case: `dp[i][0] = 1` for all `i` (empty string `t` is always 1 subsequence).
3. For `i` from 1 to `m` and `j` from 1 to `n`: `dp[i][j] = dp[i-1][j]`. If `s[i-1] == t[j-1]`, `dp[i][j] += dp[i-1][j-1]`.
4. Return `dp[m][n]`.

# Naive Solution — Recursion

At every matching character, recursively try using it or skipping it.

```python filename:Python
class Solution:
    def numDistinct(self, s, t):

        def dfs(i, j):
            if j == len(t):
                return 1

            if i == len(s):
                return 0

            if s[i] == t[j]:
                return (
                    dfs(i + 1, j + 1)
                    +
                    dfs(i + 1, j)
                )

            return dfs(i + 1, j)

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int numDistinct(string s, string t) {
        return dfs(s, t, 0, 0);
    }

private:
    int dfs(const string& s, const string& t, int i, int j) {
        if (j == (int)t.size()) return 1;
        if (i == (int)s.size()) return 0;

        if (s[i] == t[j]) {
            return dfs(s, t, i + 1, j + 1) + dfs(s, t, i + 1, j);
        }

        return dfs(s, t, i + 1, j);
    }
};
```

```java filename:Java
class Solution {
    public int numDistinct(String s, String t) {
        return dfs(s, t, 0, 0);
    }

    private int dfs(String s, String t, int i, int j) {
        if (j == t.length()) return 1;
        if (i == s.length()) return 0;

        if (s.charAt(i) == t.charAt(j)) {
            return dfs(s, t, i + 1, j + 1) + dfs(s, t, i + 1, j);
        }

        return dfs(s, t, i + 1, j);
    }
}
```

```javascript filename:JavaScript
var numDistinct = function(s, t) {
    const dfs = (i, j) => {
        if (j === t.length) return 1;
        if (i === s.length) return 0;

        if (s[i] === t[j]) {
            return dfs(i + 1, j + 1) + dfs(i + 1, j);
        }

        return dfs(i + 1, j);
    };

    return dfs(0, 0);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def numDistinct(self, s, t):

        m = len(s)
        n = len(t)

        dp = [
            [0] * (n + 1)
            for _ in range(m + 1)
        ]

        for i in range(m + 1):
            dp[i][0] = 1

        for i in range(1, m + 1):
            for j in range(1, n + 1):

                dp[i][j] = dp[i - 1][j]

                if s[i - 1] == t[j - 1]:
                    dp[i][j] += dp[i - 1][j - 1]

        return dp[m][n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int numDistinct(string s, string t) {
        int m = s.size();
        int n = t.size();

        // unsigned: unrelated cells may overflow, but dp[m][n] always fits
        vector<vector<unsigned long long>> dp(m + 1, vector<unsigned long long>(n + 1, 0));

        for (int i = 0; i <= m; i++) dp[i][0] = 1;

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                dp[i][j] = dp[i - 1][j];

                if (s[i - 1] == t[j - 1]) {
                    dp[i][j] += dp[i - 1][j - 1];
                }
            }
        }

        return (int)dp[m][n];
    }
};
```

```java filename:Java
class Solution {
    public int numDistinct(String s, String t) {
        int m = s.length();
        int n = t.length();

        long[][] dp = new long[m + 1][n + 1];

        for (int i = 0; i <= m; i++) dp[i][0] = 1;

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                dp[i][j] = dp[i - 1][j];

                if (s.charAt(i - 1) == t.charAt(j - 1)) {
                    dp[i][j] += dp[i - 1][j - 1];
                }
            }
        }

        return (int) dp[m][n];
    }
}
```

```javascript filename:JavaScript
var numDistinct = function(s, t) {
    const m = s.length;
    const n = t.length;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = 1;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = dp[i - 1][j];

            if (s[i - 1] === t[j - 1]) {
                dp[i][j] += dp[i - 1][j - 1];
            }
        }
    }

    return dp[m][n];
};
```

<strong>Time: O(mn) · Space: O(mn)</strong>

# Takeaway

<strong>Two-String Counting DP</strong> — Sum choice paths when characters match.
