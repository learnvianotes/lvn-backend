---
id: 8dec50d9-ea14-7d55-88cf-28491b5f9809
key: problem:sheet-150/lc-62
subject: sheet-150
topic: dp-2d
title: Unique Paths
slug: unique-paths
order: 9
---

Difficulty: <strong>Medium</strong> · [LeetCode 62](https://leetcode.com/problems/unique-paths/)

# Problem

Robot at `(0,0)` in `m x n` grid wants to move to `(m-1, n-1)`. Can only move down or right. Return total unique paths.

# Understanding the problem

To reach cell `(r, c)`, you can arrive from top `(r-1, c)` or left `(r, c-1)`. Thus `dp[r][c] = dp[r-1][c] + dp[r][c-1]`.

# Intuition

Fill 2D grid bottom-up or optimize space to 1D row array of size `n`.

# Approach

1. Initialize `dp = [1] * n`.
2. Loop `m-1` times: for `c` from 1 to `n-1`, `dp[c] += dp[c-1]`.
3. Return `dp[-1]`.

# Naive Solution — Recursion

At every cell, recursively branch right and down until reaching bottom-right corner.

```python filename:Python
class Solution:
    def uniquePaths(self, m, n):

        def dfs(r, c):
            if r == m - 1 and c == n - 1:
                return 1

            if r >= m or c >= n:
                return 0

            return (
                dfs(r + 1, c)
                +
                dfs(r, c + 1)
            )

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int uniquePaths(int m, int n) {
        return dfs(0, 0, m, n);
    }

private:
    int dfs(int r, int c, int m, int n) {
        if (r == m - 1 && c == n - 1) return 1;
        if (r >= m || c >= n) return 0;

        return dfs(r + 1, c, m, n) + dfs(r, c + 1, m, n);
    }
};
```

```java filename:Java
class Solution {
    public int uniquePaths(int m, int n) {
        return dfs(0, 0, m, n);
    }

    private int dfs(int r, int c, int m, int n) {
        if (r == m - 1 && c == n - 1) return 1;
        if (r >= m || c >= n) return 0;

        return dfs(r + 1, c, m, n) + dfs(r, c + 1, m, n);
    }
}
```

```javascript filename:JavaScript
var uniquePaths = function(m, n) {
    const dfs = (r, c) => {
        if (r === m - 1 && c === n - 1) return 1;
        if (r >= m || c >= n) return 0;

        return dfs(r + 1, c) + dfs(r, c + 1);
    };

    return dfs(0, 0);
};
```

<strong>Time: O(2^(m+n)) · Aux Space: O(m+n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def uniquePaths(self, m, n):

        dp = [[0] * n for _ in range(m)]

        for r in range(m):
            dp[r][0] = 1

        for c in range(n):
            dp[0][c] = 1

        for r in range(1, m):
            for c in range(1, n):
                dp[r][c] = (
                    dp[r - 1][c]
                    +
                    dp[r][c - 1]
                )

        return dp[m - 1][n - 1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int uniquePaths(int m, int n) {
        vector<vector<int>> dp(m, vector<int>(n, 0));

        for (int r = 0; r < m; r++) dp[r][0] = 1;
        for (int c = 0; c < n; c++) dp[0][c] = 1;

        for (int r = 1; r < m; r++) {
            for (int c = 1; c < n; c++) {
                dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
            }
        }

        return dp[m - 1][n - 1];
    }
};
```

```java filename:Java
class Solution {
    public int uniquePaths(int m, int n) {
        int[][] dp = new int[m][n];

        for (int r = 0; r < m; r++) dp[r][0] = 1;
        for (int c = 0; c < n; c++) dp[0][c] = 1;

        for (int r = 1; r < m; r++) {
            for (int c = 1; c < n; c++) {
                dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
            }
        }

        return dp[m - 1][n - 1];
    }
}
```

```javascript filename:JavaScript
var uniquePaths = function(m, n) {
    const dp = Array.from({ length: m }, () => new Array(n).fill(0));

    for (let r = 0; r < m; r++) dp[r][0] = 1;
    for (let c = 0; c < n; c++) dp[0][c] = 1;

    for (let r = 1; r < m; r++) {
        for (let c = 1; c < n; c++) {
            dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
        }
    }

    return dp[m - 1][n - 1];
};
```

<strong>Time: O(mn) · Space: O(n) (Space Optimized) / O(mn) (2D Grid)</strong>

# Takeaway

<strong>Grid DP</strong> — Each cell transitions from top and left adjacent neighbors.
