---
id: 082e4f24-3200-7849-9093-86287ef84c50
key: problem:sheet-150/lc-72
subject: sheet-150
topic: dp-2d
title: Edit Distance
slug: edit-distance
order: 10
---

Difficulty: <strong>Hard</strong> · [LeetCode 72](https://leetcode.com/problems/edit-distance/)

# Problem

Given strings `word1` and `word2`, return minimum operations (insert, delete, replace) to convert `word1` to `word2`.

# Understanding the problem

Standard Levenshtein distance 2D DP. 3 operations at each position: Insert, Delete, or Replace.

# Intuition

2D bottom-up grid `dp[i][j]` where `dp[i][j]` is min operations for `word1[:i]` and `word2[:j]`. Can be space-optimized to 1D row array of size `min(m, n)`.

# Approach

1. Initialize 2D array `dp` of size `(m+1) x (n+1)` with base cases `dp[i][0] = i` and `dp[0][j] = j`.
2. For `i` from 1 to `m` and `j` from 1 to `n`: if `word1[i-1] == word2[j-1]`, `dp[i][j] = dp[i-1][j-1]`.
3. Else `dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])` (delete, insert, replace).
4. Return `dp[m][n]`.

# Naive Solution — Recursion

Recursive evaluation trying all 3 operations (insert, delete, replace) at each step.

```python filename:Python
class Solution:
    def minDistance(self, word1, word2):

        def dfs(i, j):
            if i == len(word1):
                return len(word2) - j

            if j == len(word2):
                return len(word1) - i

            if word1[i] == word2[j]:
                return dfs(i + 1, j + 1)

            insert = dfs(i, j + 1)
            delete = dfs(i + 1, j)
            replace = dfs(i + 1, j + 1)

            return 1 + min(
                insert,
                delete,
                replace
            )

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minDistance(string word1, string word2) {
        return dfs(word1, word2, 0, 0);
    }

private:
    int dfs(const string& word1, const string& word2, int i, int j) {
        if (i == (int)word1.size()) return word2.size() - j;
        if (j == (int)word2.size()) return word1.size() - i;

        if (word1[i] == word2[j]) return dfs(word1, word2, i + 1, j + 1);

        int insert = dfs(word1, word2, i, j + 1);
        int remove = dfs(word1, word2, i + 1, j);
        int replace = dfs(word1, word2, i + 1, j + 1);

        return 1 + min({insert, remove, replace});
    }
};
```

```java filename:Java
class Solution {
    public int minDistance(String word1, String word2) {
        return dfs(word1, word2, 0, 0);
    }

    private int dfs(String word1, String word2, int i, int j) {
        if (i == word1.length()) return word2.length() - j;
        if (j == word2.length()) return word1.length() - i;

        if (word1.charAt(i) == word2.charAt(j)) return dfs(word1, word2, i + 1, j + 1);

        int insert = dfs(word1, word2, i, j + 1);
        int delete = dfs(word1, word2, i + 1, j);
        int replace = dfs(word1, word2, i + 1, j + 1);

        return 1 + Math.min(insert, Math.min(delete, replace));
    }
}
```

```javascript filename:JavaScript
var minDistance = function(word1, word2) {
    const dfs = (i, j) => {
        if (i === word1.length) return word2.length - j;
        if (j === word2.length) return word1.length - i;

        if (word1[i] === word2[j]) return dfs(i + 1, j + 1);

        const insert = dfs(i, j + 1);
        const remove = dfs(i + 1, j);
        const replace = dfs(i + 1, j + 1);

        return 1 + Math.min(insert, remove, replace);
    };

    return dfs(0, 0);
};
```

<strong>Time: O(3^(m+n)) · Aux Space: O(m+n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def minDistance(self, word1, word2):

        m = len(word1)
        n = len(word2)

        dp = [
            [0] * (n + 1)
            for _ in range(m + 1)
        ]

        for i in range(m + 1):
            dp[i][0] = i

        for j in range(n + 1):
            dp[0][j] = j

        for i in range(1, m + 1):
            for j in range(1, n + 1):

                if word1[i - 1] == word2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]

                else:
                    dp[i][j] = 1 + min(
                        dp[i - 1][j],       # delete
                        dp[i][j - 1],       # insert
                        dp[i - 1][j - 1]    # replace
                    )

        return dp[m][n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minDistance(string word1, string word2) {
        int m = word1.size();
        int n = word2.size();

        vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));

        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (word1[i - 1] == word2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + min({
                        dp[i - 1][j],       // delete
                        dp[i][j - 1],       // insert
                        dp[i - 1][j - 1]    // replace
                    });
                }
            }
        }

        return dp[m][n];
    }
};
```

```java filename:Java
class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length();
        int n = word2.length();

        int[][] dp = new int[m + 1][n + 1];

        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(
                        dp[i - 1][j],                           // delete
                        Math.min(dp[i][j - 1], dp[i - 1][j - 1]) // insert, replace
                    );
                }
            }
        }

        return dp[m][n];
    }
}
```

```javascript filename:JavaScript
var minDistance = function(word1, word2) {
    const m = word1.length;
    const n = word2.length;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (word1[i - 1] === word2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],       // delete
                    dp[i][j - 1],       // insert
                    dp[i - 1][j - 1]    // replace
                );
            }
        }
    }

    return dp[m][n];
};
```

<strong>Time: O(mn) · Space: O(min(m,n)) (Space Optimized) / O(mn) (2D Matrix)</strong>

# Takeaway

<strong>Insert / Delete / Replace Two-String DP</strong> — Standard edit distance pattern comparing character prefixes.
