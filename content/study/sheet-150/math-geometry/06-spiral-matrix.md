---
id: ac342f4d-cc71-77cc-bf04-1e0ca0f85725
key: problem:sheet-150/lc-54
subject: sheet-150
topic: math-geometry
title: Spiral Matrix
slug: spiral-matrix
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 54](https://leetcode.com/problems/spiral-matrix/)

# Problem

Given an `m × n` matrix, return all elements in spiral order.

# Understanding the problem

Track four boundaries: `top`, `bottom`, `left`, `right`. Process the outermost ring in four sweeps (→ ↓ ← ↑), then shrink boundaries inward and repeat.

# Intuition

Maintain four boundary variables. Process the current ring's four edges in order, then shrink each boundary inward. Guard against single-row or single-column cases before the ← and ↑ sweeps.

# Approach

1. Initialize `top=0, bottom=rows-1, left=0, right=cols-1`.
2. While `top <= bottom` and `left <= right`:
3. → Append `matrix[top][left..right]`; increment `top`.
4. ↓ Append `matrix[top..bottom][right]`; decrement `right`.
5. ← If `top <= bottom`: append `matrix[bottom][right..left]` reversed; decrement `bottom`.
6. ↑ If `left <= right`: append `matrix[bottom..top][left]` reversed; increment `left`.

# Naive Solution — Brute Force

Use a visited boolean matrix and change direction when hitting a boundary or visited cell.

```python filename:Python
class Solution:
    def spiralOrder(self, matrix):
        rows = len(matrix)
        cols = len(matrix[0])
        visited = [
            [False] * cols
            for _ in range(rows)
        ]
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
        result = []
        r = c = direction = 0

        for _ in range(rows * cols):
            result.append(matrix[r][c])
            visited[r][c] = True

            nr = r + directions[direction][0]
            nc = c + directions[direction][1]

            if (
                nr < 0 or nr >= rows
                or nc < 0 or nc >= cols
                or visited[nr][nc]
            ):
                direction = (direction + 1) % 4
                nr = r + directions[direction][0]
                nc = c + directions[direction][1]

            r, c = nr, nc

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> spiralOrder(vector<vector<int>>& matrix) {
        int rows = matrix.size();
        int cols = matrix[0].size();
        vector<vector<bool>> visited(rows, vector<bool>(cols, false));
        int directions[4][2] = {{0, 1}, {1, 0}, {0, -1}, {-1, 0}};
        vector<int> result;
        int r = 0, c = 0, direction = 0;

        for (int step = 0; step < rows * cols; step++) {
            result.push_back(matrix[r][c]);
            visited[r][c] = true;

            int nr = r + directions[direction][0];
            int nc = c + directions[direction][1];

            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) {
                direction = (direction + 1) % 4;
                nr = r + directions[direction][0];
                nc = c + directions[direction][1];
            }

            r = nr;
            c = nc;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public List<Integer> spiralOrder(int[][] matrix) {
        int rows = matrix.length;
        int cols = matrix[0].length;
        boolean[][] visited = new boolean[rows][cols];
        int[][] directions = {{0, 1}, {1, 0}, {0, -1}, {-1, 0}};
        List<Integer> result = new ArrayList<>();
        int r = 0, c = 0, direction = 0;

        for (int step = 0; step < rows * cols; step++) {
            result.add(matrix[r][c]);
            visited[r][c] = true;

            int nr = r + directions[direction][0];
            int nc = c + directions[direction][1];

            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) {
                direction = (direction + 1) % 4;
                nr = r + directions[direction][0];
                nc = c + directions[direction][1];
            }

            r = nr;
            c = nc;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var spiralOrder = function(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const result = [];
    let r = 0, c = 0, direction = 0;

    for (let step = 0; step < rows * cols; step++) {
        result.push(matrix[r][c]);
        visited[r][c] = true;

        let nr = r + directions[direction][0];
        let nc = c + directions[direction][1];

        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) {
            direction = (direction + 1) % 4;
            nr = r + directions[direction][0];
            nc = c + directions[direction][1];
        }

        r = nr;
        c = nc;
    }

    return result;
};
```

<strong>Time: O(mn) · Space: O(mn)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def spiralOrder(self, matrix):
        result = []
        top = 0
        bottom = len(matrix) - 1
        left = 0
        right = len(matrix[0]) - 1

        while top <= bottom and left <= right:

            # Left → Right
            for c in range(left, right + 1):
                result.append(matrix[top][c])
            top += 1

            # Top → Bottom
            for r in range(top, bottom + 1):
                result.append(matrix[r][right])
            right -= 1

            if top <= bottom:
                # Right → Left
                for c in range(right, left - 1, -1):
                    result.append(matrix[bottom][c])
                bottom -= 1

            if left <= right:
                # Bottom → Top
                for r in range(bottom, top - 1, -1):
                    result.append(matrix[r][left])
                left += 1

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> spiralOrder(vector<vector<int>>& matrix) {
        vector<int> result;
        int top = 0;
        int bottom = matrix.size() - 1;
        int left = 0;
        int right = matrix[0].size() - 1;

        while (top <= bottom && left <= right) {

            // Left → Right
            for (int c = left; c <= right; c++) {
                result.push_back(matrix[top][c]);
            }
            top++;

            // Top → Bottom
            for (int r = top; r <= bottom; r++) {
                result.push_back(matrix[r][right]);
            }
            right--;

            if (top <= bottom) {
                // Right → Left
                for (int c = right; c >= left; c--) {
                    result.push_back(matrix[bottom][c]);
                }
                bottom--;
            }

            if (left <= right) {
                // Bottom → Top
                for (int r = bottom; r >= top; r--) {
                    result.push_back(matrix[r][left]);
                }
                left++;
            }
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public List<Integer> spiralOrder(int[][] matrix) {
        List<Integer> result = new ArrayList<>();
        int top = 0;
        int bottom = matrix.length - 1;
        int left = 0;
        int right = matrix[0].length - 1;

        while (top <= bottom && left <= right) {

            // Left → Right
            for (int c = left; c <= right; c++) {
                result.add(matrix[top][c]);
            }
            top++;

            // Top → Bottom
            for (int r = top; r <= bottom; r++) {
                result.add(matrix[r][right]);
            }
            right--;

            if (top <= bottom) {
                // Right → Left
                for (int c = right; c >= left; c--) {
                    result.add(matrix[bottom][c]);
                }
                bottom--;
            }

            if (left <= right) {
                // Bottom → Top
                for (int r = bottom; r >= top; r--) {
                    result.add(matrix[r][left]);
                }
                left++;
            }
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var spiralOrder = function(matrix) {
    const result = [];
    let top = 0;
    let bottom = matrix.length - 1;
    let left = 0;
    let right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {

        // Left → Right
        for (let c = left; c <= right; c++) {
            result.push(matrix[top][c]);
        }
        top++;

        // Top → Bottom
        for (let r = top; r <= bottom; r++) {
            result.push(matrix[r][right]);
        }
        right--;

        if (top <= bottom) {
            // Right → Left
            for (let c = right; c >= left; c--) {
                result.push(matrix[bottom][c]);
            }
            bottom--;
        }

        if (left <= right) {
            // Bottom → Top
            for (let r = bottom; r >= top; r--) {
                result.push(matrix[r][left]);
            }
            left++;
        }
    }

    return result;
};
```

<strong>Time: O(mn) · Space: O(1) auxiliary</strong>

# Takeaway

<strong>Pattern</strong> — Four shrinking boundaries — process outermost ring, collapse inward, repeat
