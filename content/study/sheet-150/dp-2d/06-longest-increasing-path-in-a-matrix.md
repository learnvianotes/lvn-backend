---
id: 311e6c51-60f9-70eb-a2be-6c5c97881fe9
key: problem:sheet-150/lc-329
subject: sheet-150
topic: dp-2d
title: Longest Increasing Path in a Matrix
slug: longest-increasing-path-in-a-matrix
order: 6
---

Difficulty: <strong>Hard</strong> · [LeetCode 329](https://leetcode.com/problems/longest-increasing-path-in-a-matrix/)

# Problem

Given an `m x n` integers matrix, return the length of the longest increasing path in matrix.

# Understanding the problem

Since paths must be strictly increasing, there are no cycles (DAG). DFS + Memoization is natural DP on DAG.

# Intuition

Memoize `memo[r][c]` storing longest increasing path starting at cell `(r, c)`.

# Approach

1. Initialize `memo` grid with 0s.
2. In `dfs(r, c)`: if `memo[r][c]` already computed, return it.
3. Explore 4 orthogonal directions where `matrix[nr][nc] > matrix[r][c]`, update `best = max(best, 1 + dfs(nr, nc))`.
4. Store `memo[r][c] = best` and return. Max over all cells is the result.

# Naive Solution — Recursion

DFS from every cell without memoization.

```python filename:Python
class Solution:
    def longestIncreasingPath(self, matrix):

        rows = len(matrix)
        cols = len(matrix[0])

        def dfs(r, c):
            best = 1

            for dr, dc in [
                (1, 0), (-1, 0),
                (0, 1), (0, -1)
            ]:
                nr, nc = r + dr, c + dc

                if (
                    0 <= nr < rows
                    and 0 <= nc < cols
                    and matrix[nr][nc] > matrix[r][c]
                ):
                    best = max(
                        best,
                        1 + dfs(nr, nc)
                    )

            return best

        answer = 0

        for r in range(rows):
            for c in range(cols):
                answer = max(
                    answer,
                    dfs(r, c)
                )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int longestIncreasingPath(vector<vector<int>>& matrix) {
        int rows = matrix.size();
        int cols = matrix[0].size();
        int answer = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                answer = max(answer, dfs(matrix, r, c));
            }
        }

        return answer;
    }

private:
    int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    int dfs(vector<vector<int>>& matrix, int r, int c) {
        int rows = matrix.size();
        int cols = matrix[0].size();
        int best = 1;

        for (auto& d : dirs) {
            int nr = r + d[0], nc = c + d[1];

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                && matrix[nr][nc] > matrix[r][c]) {
                best = max(best, 1 + dfs(matrix, nr, nc));
            }
        }

        return best;
    }
};
```

```java filename:Java
class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    public int longestIncreasingPath(int[][] matrix) {
        int rows = matrix.length;
        int cols = matrix[0].length;
        int answer = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                answer = Math.max(answer, dfs(matrix, r, c));
            }
        }

        return answer;
    }

    private int dfs(int[][] matrix, int r, int c) {
        int rows = matrix.length;
        int cols = matrix[0].length;
        int best = 1;

        for (int[] d : DIRS) {
            int nr = r + d[0], nc = c + d[1];

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                && matrix[nr][nc] > matrix[r][c]) {
                best = Math.max(best, 1 + dfs(matrix, nr, nc));
            }
        }

        return best;
    }
}
```

```javascript filename:JavaScript
var longestIncreasingPath = function(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const dfs = (r, c) => {
        let best = 1;

        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                && matrix[nr][nc] > matrix[r][c]) {
                best = Math.max(best, 1 + dfs(nr, nc));
            }
        }

        return best;
    };

    let answer = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            answer = Math.max(answer, dfs(r, c));
        }
    }

    return answer;
};
```

<strong>Time: Exponential · Aux Space: O(RC)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def longestIncreasingPath(self, matrix):

        rows = len(matrix)
        cols = len(matrix[0])

        memo = [[0] * cols for _ in range(rows)]

        def dfs(r, c):
            if memo[r][c]:
                return memo[r][c]

            best = 1

            for dr, dc in [
                (1, 0), (-1, 0),
                (0, 1), (0, -1)
            ]:
                nr, nc = r + dr, c + dc

                if (
                    0 <= nr < rows
                    and 0 <= nc < cols
                    and matrix[nr][nc] > matrix[r][c]
                ):
                    best = max(
                        best,
                        1 + dfs(nr, nc)
                    )

            memo[r][c] = best
            return best

        answer = 0

        for r in range(rows):
            for c in range(cols):
                answer = max(
                    answer,
                    dfs(r, c)
                )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int longestIncreasingPath(vector<vector<int>>& matrix) {
        int rows = matrix.size();
        int cols = matrix[0].size();

        memo.assign(rows, vector<int>(cols, 0));
        int answer = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                answer = max(answer, dfs(matrix, r, c));
            }
        }

        return answer;
    }

private:
    int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    vector<vector<int>> memo;

    int dfs(vector<vector<int>>& matrix, int r, int c) {
        if (memo[r][c]) return memo[r][c];

        int rows = matrix.size();
        int cols = matrix[0].size();
        int best = 1;

        for (auto& d : dirs) {
            int nr = r + d[0], nc = c + d[1];

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                && matrix[nr][nc] > matrix[r][c]) {
                best = max(best, 1 + dfs(matrix, nr, nc));
            }
        }

        memo[r][c] = best;
        return best;
    }
};
```

```java filename:Java
class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    private int[][] memo;

    public int longestIncreasingPath(int[][] matrix) {
        int rows = matrix.length;
        int cols = matrix[0].length;

        memo = new int[rows][cols];
        int answer = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                answer = Math.max(answer, dfs(matrix, r, c));
            }
        }

        return answer;
    }

    private int dfs(int[][] matrix, int r, int c) {
        if (memo[r][c] != 0) return memo[r][c];

        int rows = matrix.length;
        int cols = matrix[0].length;
        int best = 1;

        for (int[] d : DIRS) {
            int nr = r + d[0], nc = c + d[1];

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                && matrix[nr][nc] > matrix[r][c]) {
                best = Math.max(best, 1 + dfs(matrix, nr, nc));
            }
        }

        memo[r][c] = best;
        return best;
    }
}
```

```javascript filename:JavaScript
var longestIncreasingPath = function(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const memo = Array.from({ length: rows }, () => new Array(cols).fill(0));

    const dfs = (r, c) => {
        if (memo[r][c]) return memo[r][c];

        let best = 1;

        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                && matrix[nr][nc] > matrix[r][c]) {
                best = Math.max(best, 1 + dfs(nr, nc));
            }
        }

        memo[r][c] = best;
        return best;
    };

    let answer = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            answer = Math.max(answer, dfs(r, c));
        }
    }

    return answer;
};
```

<strong>Time: O(R × C) · Space: O(R × C)</strong>

# Takeaway

<strong>DFS + memoization = DP on a graph/DAG.</strong>
