---
id: 238a9647-834c-7b7e-bfb3-3d19c8dbc7fc
key: problem:sheet-150/lc-48
subject: sheet-150
topic: math-geometry
title: Rotate Image
slug: rotate-image
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 48](https://leetcode.com/problems/rotate-image/)

# Problem

Rotate an `n × n` matrix <strong>90° clockwise in-place</strong>. You must do this without allocating another matrix.

# Understanding the problem

A 90° clockwise rotation maps `matrix[r][c]` → `result[c][n-1-r]`. Instead of allocating a new matrix, two sequential in-place operations achieve the same result: first transpose (flip across the main diagonal), then reverse each row.

# Intuition

Two in-place operations compose to give a 90° rotation:<br><br>① <strong>Transpose</strong>: swap `matrix[r][c]` with `matrix[c][r]` for all `r < c`.<br>② <strong>Reverse each row</strong>: call `row.reverse()`.<br><br>No extra memory needed.

# Approach

1. Transpose: for `r` in range(n), for `c` in range(r+1, n): swap `matrix[r][c]` ↔ `matrix[c][r]`.
2. Reverse rows: for each `row` in `matrix`: `row.reverse()`.

# Naive Solution — Brute Force

Allocate a second matrix, copy cells to their rotated positions, then copy back.

```python filename:Python
class Solution:
    def rotate(self, matrix):
        n = len(matrix)

        result = [
            [0] * n
            for _ in range(n)
        ]

        for r in range(n):
            for c in range(n):
                result[c][n - 1 - r] = matrix[r][c]

        for r in range(n):
            for c in range(n):
                matrix[r][c] = result[r][c]
```

```cpp filename:C%2B%2B
class Solution {
public:
    void rotate(vector<vector<int>>& matrix) {
        int n = matrix.size();

        vector<vector<int>> result(n, vector<int>(n, 0));

        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                result[c][n - 1 - r] = matrix[r][c];
            }
        }

        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                matrix[r][c] = result[r][c];
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;

        int[][] result = new int[n][n];

        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                result[c][n - 1 - r] = matrix[r][c];
            }
        }

        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                matrix[r][c] = result[r][c];
            }
        }
    }
}
```

```javascript filename:JavaScript
var rotate = function(matrix) {
    const n = matrix.length;

    const result = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            result[c][n - 1 - r] = matrix[r][c];
        }
    }

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            matrix[r][c] = result[r][c];
        }
    }
};
```

<strong>Time: O(n²) · Space: O(n²)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def rotate(self, matrix):
        n = len(matrix)

        # Step 1 — Transpose
        for r in range(n):
            for c in range(r + 1, n):
                matrix[r][c], matrix[c][r] = (
                    matrix[c][r],
                    matrix[r][c]
                )

        # Step 2 — Reverse each row
        for row in matrix:
            row.reverse()
```

```cpp filename:C%2B%2B
class Solution {
public:
    void rotate(vector<vector<int>>& matrix) {
        int n = matrix.size();

        // Step 1 — Transpose
        for (int r = 0; r < n; r++) {
            for (int c = r + 1; c < n; c++) {
                swap(matrix[r][c], matrix[c][r]);
            }
        }

        // Step 2 — Reverse each row
        for (auto& row : matrix) {
            reverse(row.begin(), row.end());
        }
    }
};
```

```java filename:Java
class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;

        // Step 1 — Transpose
        for (int r = 0; r < n; r++) {
            for (int c = r + 1; c < n; c++) {
                int temp = matrix[r][c];
                matrix[r][c] = matrix[c][r];
                matrix[c][r] = temp;
            }
        }

        // Step 2 — Reverse each row
        for (int[] row : matrix) {
            for (int left = 0, right = n - 1; left < right; left++, right--) {
                int temp = row[left];
                row[left] = row[right];
                row[right] = temp;
            }
        }
    }
}
```

```javascript filename:JavaScript
var rotate = function(matrix) {
    const n = matrix.length;

    // Step 1 — Transpose
    for (let r = 0; r < n; r++) {
        for (let c = r + 1; c < n; c++) {
            [matrix[r][c], matrix[c][r]] = [matrix[c][r], matrix[r][c]];
        }
    }

    // Step 2 — Reverse each row
    for (const row of matrix) {
        row.reverse();
    }
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — 90° clockwise = Transpose + Reverse rows (counter-clockwise = Transpose + Reverse columns)
