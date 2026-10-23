---
id: 8f9f0c0a-9f59-7c6c-9e5c-ba285e5a97bf
key: problem:sheet-150/lc-73
subject: sheet-150
topic: math-geometry
title: Set Matrix Zeroes
slug: set-matrix-zeroes
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 73](https://leetcode.com/problems/set-matrix-zeroes/)

# Problem

Given an `m × n` matrix, if any cell is 0, set its entire row and column to 0. Do it in-place.

# Understanding the problem

Store which rows and columns need zeroing — but use the matrix itself as the storage. The first row and first column act as marker arrays. Handle them separately at the end.

# Intuition

Repurpose `matrix[0][c]` and `matrix[r][0]` as markers for columns and rows. Pre-check if the first row or column itself contains a zero so they can be handled last without ambiguity.

# Approach

1. Check `first_row_zero = any(matrix[0][c] == 0 for c)` and `first_col_zero = any(matrix[r][0] == 0 for r)`.
2. For `r` in 1..rows, `c` in 1..cols: if `matrix[r][c] == 0`, set `matrix[r][0] = 0` and `matrix[0][c] = 0`.
3. Zero rows 1..rows where `matrix[r][0] == 0`.
4. Zero cols 1..cols where `matrix[0][c] == 0`.
5. If `first_row_zero`: zero entire row 0. If `first_col_zero`: zero entire col 0.

# Naive Solution — Brute Force

Use two sets to record which rows and columns contain zeros, then zero them.

```python filename:Python
class Solution:
    def setZeroes(self, matrix):
        rows = set()
        cols = set()

        for r in range(len(matrix)):
            for c in range(len(matrix[0])):
                if matrix[r][c] == 0:
                    rows.add(r)
                    cols.add(c)

        for r in rows:
            for c in range(len(matrix[0])):
                matrix[r][c] = 0

        for c in cols:
            for r in range(len(matrix)):
                matrix[r][c] = 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    void setZeroes(vector<vector<int>>& matrix) {
        unordered_set<int> rows;
        unordered_set<int> cols;

        for (int r = 0; r < (int)matrix.size(); r++) {
            for (int c = 0; c < (int)matrix[0].size(); c++) {
                if (matrix[r][c] == 0) {
                    rows.insert(r);
                    cols.insert(c);
                }
            }
        }

        for (int r : rows) {
            for (int c = 0; c < (int)matrix[0].size(); c++) {
                matrix[r][c] = 0;
            }
        }

        for (int c : cols) {
            for (int r = 0; r < (int)matrix.size(); r++) {
                matrix[r][c] = 0;
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public void setZeroes(int[][] matrix) {
        Set<Integer> rows = new HashSet<>();
        Set<Integer> cols = new HashSet<>();

        for (int r = 0; r < matrix.length; r++) {
            for (int c = 0; c < matrix[0].length; c++) {
                if (matrix[r][c] == 0) {
                    rows.add(r);
                    cols.add(c);
                }
            }
        }

        for (int r : rows) {
            for (int c = 0; c < matrix[0].length; c++) {
                matrix[r][c] = 0;
            }
        }

        for (int c : cols) {
            for (int r = 0; r < matrix.length; r++) {
                matrix[r][c] = 0;
            }
        }
    }
}
```

```javascript filename:JavaScript
var setZeroes = function(matrix) {
    const rows = new Set();
    const cols = new Set();

    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[0].length; c++) {
            if (matrix[r][c] === 0) {
                rows.add(r);
                cols.add(c);
            }
        }
    }

    for (const r of rows) {
        for (let c = 0; c < matrix[0].length; c++) {
            matrix[r][c] = 0;
        }
    }

    for (const c of cols) {
        for (let r = 0; r < matrix.length; r++) {
            matrix[r][c] = 0;
        }
    }
};
```

<strong>Time: O(mn) · Space: O(m+n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def setZeroes(self, matrix):
        rows = len(matrix)
        cols = len(matrix[0])

        first_row_zero = any(
            matrix[0][c] == 0
            for c in range(cols)
        )
        first_col_zero = any(
            matrix[r][0] == 0
            for r in range(rows)
        )

        # Use first row/col as markers
        for r in range(1, rows):
            for c in range(1, cols):
                if matrix[r][c] == 0:
                    matrix[r][0] = 0
                    matrix[0][c] = 0

        # Zero marked rows
        for r in range(1, rows):
            if matrix[r][0] == 0:
                for c in range(1, cols):
                    matrix[r][c] = 0

        # Zero marked columns
        for c in range(1, cols):
            if matrix[0][c] == 0:
                for r in range(1, rows):
                    matrix[r][c] = 0

        # Handle first row and column
        if first_row_zero:
            for c in range(cols):
                matrix[0][c] = 0

        if first_col_zero:
            for r in range(rows):
                matrix[r][0] = 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    void setZeroes(vector<vector<int>>& matrix) {
        int rows = matrix.size();
        int cols = matrix[0].size();

        bool firstRowZero = false;
        for (int c = 0; c < cols; c++) {
            if (matrix[0][c] == 0) firstRowZero = true;
        }
        bool firstColZero = false;
        for (int r = 0; r < rows; r++) {
            if (matrix[r][0] == 0) firstColZero = true;
        }

        // Use first row/col as markers
        for (int r = 1; r < rows; r++) {
            for (int c = 1; c < cols; c++) {
                if (matrix[r][c] == 0) {
                    matrix[r][0] = 0;
                    matrix[0][c] = 0;
                }
            }
        }

        // Zero marked rows
        for (int r = 1; r < rows; r++) {
            if (matrix[r][0] == 0) {
                for (int c = 1; c < cols; c++) {
                    matrix[r][c] = 0;
                }
            }
        }

        // Zero marked columns
        for (int c = 1; c < cols; c++) {
            if (matrix[0][c] == 0) {
                for (int r = 1; r < rows; r++) {
                    matrix[r][c] = 0;
                }
            }
        }

        // Handle first row and column
        if (firstRowZero) {
            for (int c = 0; c < cols; c++) {
                matrix[0][c] = 0;
            }
        }

        if (firstColZero) {
            for (int r = 0; r < rows; r++) {
                matrix[r][0] = 0;
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public void setZeroes(int[][] matrix) {
        int rows = matrix.length;
        int cols = matrix[0].length;

        boolean firstRowZero = false;
        for (int c = 0; c < cols; c++) {
            if (matrix[0][c] == 0) firstRowZero = true;
        }
        boolean firstColZero = false;
        for (int r = 0; r < rows; r++) {
            if (matrix[r][0] == 0) firstColZero = true;
        }

        // Use first row/col as markers
        for (int r = 1; r < rows; r++) {
            for (int c = 1; c < cols; c++) {
                if (matrix[r][c] == 0) {
                    matrix[r][0] = 0;
                    matrix[0][c] = 0;
                }
            }
        }

        // Zero marked rows
        for (int r = 1; r < rows; r++) {
            if (matrix[r][0] == 0) {
                for (int c = 1; c < cols; c++) {
                    matrix[r][c] = 0;
                }
            }
        }

        // Zero marked columns
        for (int c = 1; c < cols; c++) {
            if (matrix[0][c] == 0) {
                for (int r = 1; r < rows; r++) {
                    matrix[r][c] = 0;
                }
            }
        }

        // Handle first row and column
        if (firstRowZero) {
            for (int c = 0; c < cols; c++) {
                matrix[0][c] = 0;
            }
        }

        if (firstColZero) {
            for (int r = 0; r < rows; r++) {
                matrix[r][0] = 0;
            }
        }
    }
}
```

```javascript filename:JavaScript
var setZeroes = function(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    const firstRowZero = matrix[0].some((v) => v === 0);
    const firstColZero = matrix.some((row) => row[0] === 0);

    // Use first row/col as markers
    for (let r = 1; r < rows; r++) {
        for (let c = 1; c < cols; c++) {
            if (matrix[r][c] === 0) {
                matrix[r][0] = 0;
                matrix[0][c] = 0;
            }
        }
    }

    // Zero marked rows
    for (let r = 1; r < rows; r++) {
        if (matrix[r][0] === 0) {
            for (let c = 1; c < cols; c++) {
                matrix[r][c] = 0;
            }
        }
    }

    // Zero marked columns
    for (let c = 1; c < cols; c++) {
        if (matrix[0][c] === 0) {
            for (let r = 1; r < rows; r++) {
                matrix[r][c] = 0;
            }
        }
    }

    // Handle first row and column
    if (firstRowZero) {
        for (let c = 0; c < cols; c++) {
            matrix[0][c] = 0;
        }
    }

    if (firstColZero) {
        for (let r = 0; r < rows; r++) {
            matrix[r][0] = 0;
        }
    }
};
```

<strong>Time: O(mn) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Use the input matrix itself as metadata — repurpose first row and column as markers
