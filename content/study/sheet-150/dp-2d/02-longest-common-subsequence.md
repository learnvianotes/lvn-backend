---
id: 731f6b3b-01c4-7584-9c78-446627baf775
key: problem:sheet-150/lc-1143
subject: sheet-150
topic: dp-2d
title: Longest Common Subsequence
slug: longest-common-subsequence
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 1143](https://leetcode.com/problems/longest-common-subsequence/)

# Problem

Given two strings `text1` and `text2`, return length of their longest common subsequence.

# Understanding the problem

At each pair of characters: if equal → take both (`1 + dfs(i+1, j+1)`). Otherwise → skip one side (`max(dfs(i+1, j), dfs(i, j+1))`).

# Intuition

2D DP matrix `dp[i][j]` where `i` and `j` index `text1` and `text2`. Space can be optimized to 1D row array.

# Approach

1. Create `dp` grid of size `(m+1) x (n+1)`.
2. Loop `i` from 1 to `m` and `j` from 1 to `n`.
3. If `text1[i-1] == text2[j-1]`: `dp[i][j] = dp[i-1][j-1] + 1`. Else `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`.
4. Return `dp[m][n]`.

# Naive Solution — Recursion

Recursively match characters or branch by skipping one side.

```python filename:Python
class Solution:
    def longestCommonSubsequence(self, text1, text2):

        def dfs(i, j):
            if i == len(text1) or j == len(text2):
                return 0

            if text1[i] == text2[j]:
                return 1 + dfs(i + 1, j + 1)

            return max(
                dfs(i + 1, j),
                dfs(i, j + 1)
            )

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int longestCommonSubsequence(string text1, string text2) {
        return dfs(text1, text2, 0, 0);
    }

private:
    int dfs(const string& text1, const string& text2, int i, int j) {
        if (i == (int)text1.size() || j == (int)text2.size()) return 0;

        if (text1[i] == text2[j]) {
            return 1 + dfs(text1, text2, i + 1, j + 1);
        }

        return max(dfs(text1, text2, i + 1, j), dfs(text1, text2, i, j + 1));
    }
};
```

```java filename:Java
class Solution {
    public int longestCommonSubsequence(String text1, String text2) {
        return dfs(text1, text2, 0, 0);
    }

    private int dfs(String text1, String text2, int i, int j) {
        if (i == text1.length() || j == text2.length()) return 0;

        if (text1.charAt(i) == text2.charAt(j)) {
            return 1 + dfs(text1, text2, i + 1, j + 1);
        }

        return Math.max(dfs(text1, text2, i + 1, j), dfs(text1, text2, i, j + 1));
    }
}
```

```javascript filename:JavaScript
var longestCommonSubsequence = function(text1, text2) {
    const dfs = (i, j) => {
        if (i === text1.length || j === text2.length) return 0;

        if (text1[i] === text2[j]) {
            return 1 + dfs(i + 1, j + 1);
        }

        return Math.max(dfs(i + 1, j), dfs(i, j + 1));
    };

    return dfs(0, 0);
};
```

<strong>Time: O(2^(m+n)) · Aux Space: O(m+n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def longestCommonSubsequence(self, text1, text2):

        m = len(text1)
        n = len(text2)

        dp = [
            [0] * (n + 1)
            for _ in range(m + 1)
        ]

        for i in range(1, m + 1):
            for j in range(1, n + 1):

                if text1[i - 1] == text2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1

                else:
                    dp[i][j] = max(
                        dp[i - 1][j],
                        dp[i][j - 1]
                    )

        return dp[m][n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int longestCommonSubsequence(string text1, string text2) {
        int m = text1.size();
        int n = text2.size();

        vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (text1[i - 1] == text2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        return dp[m][n];
    }
};
```

```java filename:Java
class Solution {
    public int longestCommonSubsequence(String text1, String text2) {
        int m = text1.length();
        int n = text2.length();

        int[][] dp = new int[m + 1][n + 1];

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        return dp[m][n];
    }
}
```

```javascript filename:JavaScript
var longestCommonSubsequence = function(text1, text2) {
    const m = text1.length;
    const n = text2.length;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (text1[i - 1] === text2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    return dp[m][n];
};
```

<strong>Time: O(mn) · Space: O(min(m,n)) (Space Optimized) / O(mn) (2D DP Matrix)</strong>

# Takeaway

<strong>Two-String DP</strong> — Compare prefix `i` of string A and prefix `j` of string B.
