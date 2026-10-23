---
id: 051df233-199a-7655-9510-ef2f1b173616
key: problem:sheet-150/lc-97
subject: sheet-150
topic: dp-2d
title: Interleaving String
slug: interleaving-string
order: 11
---

Difficulty: <strong>Medium</strong> · [LeetCode 97](https://leetcode.com/problems/interleaving-string/)

# Problem

Determine whether `s3` can be formed by interleaving `s1` and `s2`.

# Understanding the problem

If `len(s1) + len(s2) != len(s3)` return False. `dp[i][j]` tracks whether `s1[:i]` and `s2[:j]` interleave to form `s3[:i+j]`.

# Intuition

2D boolean table `dp[i][j]` where `dp[i][j] = (dp[i-1][j] and s1[i-1] == s3[k]) or (dp[i][j-1] and s2[j-1] == s3[k])`.

# Approach

1. Check length validity: `if len(s1) + len(s2) != len(s3)` return False.
2. Create grid `dp` of size `(m+1) x (n+1)` with `dp[0][0] = True`.
3. Fill table row by row from 0 to `m` and column from 0 to `n`.
4. Return `dp[m][n]`.

# Naive Solution — Recursion

Branch recursively whenever current char of `s1` or `s2` matches `s3`.

```python filename:Python
class Solution:
    def isInterleave(self, s1, s2, s3):

        if len(s1) + len(s2) != len(s3):
            return False

        def dfs(i, j):
            k = i + j

            if k == len(s3):
                return True

            if i < len(s1) and s1[i] == s3[k]:
                if dfs(i + 1, j):
                    return True

            if j < len(s2) and s2[j] == s3[k]:
                if dfs(i, j + 1):
                    return True

            return False

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isInterleave(string s1, string s2, string s3) {
        if (s1.size() + s2.size() != s3.size()) return false;
        return dfs(s1, s2, s3, 0, 0);
    }

private:
    bool dfs(const string& s1, const string& s2, const string& s3, int i, int j) {
        int k = i + j;
        if (k == (int)s3.size()) return true;

        if (i < (int)s1.size() && s1[i] == s3[k]) {
            if (dfs(s1, s2, s3, i + 1, j)) return true;
        }

        if (j < (int)s2.size() && s2[j] == s3[k]) {
            if (dfs(s1, s2, s3, i, j + 1)) return true;
        }

        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean isInterleave(String s1, String s2, String s3) {
        if (s1.length() + s2.length() != s3.length()) return false;
        return dfs(s1, s2, s3, 0, 0);
    }

    private boolean dfs(String s1, String s2, String s3, int i, int j) {
        int k = i + j;
        if (k == s3.length()) return true;

        if (i < s1.length() && s1.charAt(i) == s3.charAt(k)) {
            if (dfs(s1, s2, s3, i + 1, j)) return true;
        }

        if (j < s2.length() && s2.charAt(j) == s3.charAt(k)) {
            if (dfs(s1, s2, s3, i, j + 1)) return true;
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var isInterleave = function(s1, s2, s3) {
    if (s1.length + s2.length !== s3.length) return false;

    const dfs = (i, j) => {
        const k = i + j;
        if (k === s3.length) return true;

        if (i < s1.length && s1[i] === s3[k]) {
            if (dfs(i + 1, j)) return true;
        }

        if (j < s2.length && s2[j] === s3[k]) {
            if (dfs(i, j + 1)) return true;
        }

        return false;
    };

    return dfs(0, 0);
};
```

<strong>Time: O(2^(m+n)) · Aux Space: O(m+n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isInterleave(self, s1, s2, s3):

        if len(s1) + len(s2) != len(s3):
            return False

        m = len(s1)
        n = len(s2)

        dp = [
            [False] * (n + 1)
            for _ in range(m + 1)
        ]

        dp[0][0] = True

        for i in range(m + 1):
            for j in range(n + 1):

                if i == 0 and j == 0:
                    continue

                k = i + j - 1

                if i > 0 and dp[i - 1][j]:
                    if s1[i - 1] == s3[k]:
                        dp[i][j] = True

                if j > 0 and dp[i][j - 1]:
                    if s2[j - 1] == s3[k]:
                        dp[i][j] = True

        return dp[m][n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isInterleave(string s1, string s2, string s3) {
        if (s1.size() + s2.size() != s3.size()) return false;

        int m = s1.size();
        int n = s2.size();

        vector<vector<bool>> dp(m + 1, vector<bool>(n + 1, false));
        dp[0][0] = true;

        for (int i = 0; i <= m; i++) {
            for (int j = 0; j <= n; j++) {
                if (i == 0 && j == 0) continue;

                int k = i + j - 1;

                if (i > 0 && dp[i - 1][j] && s1[i - 1] == s3[k]) {
                    dp[i][j] = true;
                }

                if (j > 0 && dp[i][j - 1] && s2[j - 1] == s3[k]) {
                    dp[i][j] = true;
                }
            }
        }

        return dp[m][n];
    }
};
```

```java filename:Java
class Solution {
    public boolean isInterleave(String s1, String s2, String s3) {
        if (s1.length() + s2.length() != s3.length()) return false;

        int m = s1.length();
        int n = s2.length();

        boolean[][] dp = new boolean[m + 1][n + 1];
        dp[0][0] = true;

        for (int i = 0; i <= m; i++) {
            for (int j = 0; j <= n; j++) {
                if (i == 0 && j == 0) continue;

                int k = i + j - 1;

                if (i > 0 && dp[i - 1][j] && s1.charAt(i - 1) == s3.charAt(k)) {
                    dp[i][j] = true;
                }

                if (j > 0 && dp[i][j - 1] && s2.charAt(j - 1) == s3.charAt(k)) {
                    dp[i][j] = true;
                }
            }
        }

        return dp[m][n];
    }
}
```

```javascript filename:JavaScript
var isInterleave = function(s1, s2, s3) {
    if (s1.length + s2.length !== s3.length) return false;

    const m = s1.length;
    const n = s2.length;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(false));
    dp[0][0] = true;

    for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= n; j++) {
            if (i === 0 && j === 0) continue;

            const k = i + j - 1;

            if (i > 0 && dp[i - 1][j] && s1[i - 1] === s3[k]) {
                dp[i][j] = true;
            }

            if (j > 0 && dp[i][j - 1] && s2[j - 1] === s3[k]) {
                dp[i][j] = true;
            }
        }
    }

    return dp[m][n];
};
```

<strong>Time: O(mn) · Space: O(mn)</strong>

# Takeaway

<strong>Two-String Grid DP</strong> — Path matching in a 2D matrix representing positions in `s1` and `s2`.
