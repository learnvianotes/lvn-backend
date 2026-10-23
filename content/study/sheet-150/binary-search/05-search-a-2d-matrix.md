---
id: efaa5ff2-5a22-7c6c-8590-39ba5e7f49dc
key: problem:sheet-150/lc-74
subject: sheet-150
topic: binary-search
title: Search a 2D Matrix
slug: search-a-2d-matrix
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 74](https://leetcode.com/problems/search-a-2d-matrix/)

# Problem

Write an efficient algorithm that searches for a value `target` in an `m x n` integer matrix where each row is sorted and the first element of each row is greater than the last of the previous row.

# Understanding the problem

The entire matrix behaves like one contiguous sorted 1D array of size `m * n`.

# Intuition

Treat 2D matrix as a virtual 1D sorted array of length `rows * cols`. Map 1D index to 2D cell via: `row = index // cols`, `col = index % cols`.

# Approach

1. Set `left = 0`, `right = rows * cols - 1`.
2. Loop while `left <= right`:
3. Compute `mid = left + (right - left) // 2`.
4. Map `row = mid // cols`, `col = mid % cols`.
5. If `matrix[row][col] == target`, return `True`.
6. If `matrix[row][col] < target`, `left = mid + 1`; else `right = mid - 1`.

# Naive Solution — Brute Force

Nested row and column loops checking every matrix cell.

```python filename:Python
class Solution:
    def searchMatrix(self, matrix, target):

        for row in matrix:
            for value in row:
                if value == target:
                    return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        for (auto row : matrix) {
            for (auto value : row) {
                if (value == target) {
                    return true;
                }
            }
        }
        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        for (int[] row : matrix) {
            for (int value : row) {
                if (value == target) {
                    return true;
                }
            }
        }
        return false;
    }
}
```

```javascript filename:JavaScript
var searchMatrix = function(matrix, target) {
    for (const row of matrix) {
        for (const value of row) {
            if (value === target) {
                return true;
            }
        }
    }

    return false;
};
```

<strong>Time: O(m × n) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def searchMatrix(self, matrix, target):

        rows = len(matrix)
        cols = len(matrix[0])

        left = 0
        right = rows * cols - 1

        while left <= right:
            mid = left + (right - left) // 2

            row = mid // cols
            col = mid % cols

            value = matrix[row][col]

            if value == target:
                return True

            if value < target:
                left = mid + 1
            else:
                right = mid - 1

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        int rows = matrix.size();
        int cols = matrix[0].size();

        int left = 0;
        int right = rows * cols - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;

            int row = mid / cols;
            int col = mid % cols;

            int value = matrix[row][col];

            if (value == target) {
                return true;
            }

            if (value < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int rows = matrix.length;
        int cols = matrix[0].length;

        int left = 0;
        int right = rows * cols - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;

            int row = mid / cols;
            int col = mid % cols;

            int value = matrix[row][col];

            if (value == target) {
                return true;
            }

            if (value < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var searchMatrix = function(matrix, target) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    let left = 0;
    let right = rows * cols - 1;

    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);

        const row = Math.floor(mid / cols);
        const col = mid % cols;

        const value = matrix[row][col];

        if (value === target) {
            return true;
        }

        if (value < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return false;
};
```

<strong>Time: O(log(m × n)) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — 2D Matrix with sorted boundaries → Virtual 1D Binary Search
