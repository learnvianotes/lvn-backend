---
id: 008fb64d-0f0c-7374-8477-6a31f1246381
key: problem:sheet-150/lc-200
subject: sheet-150
topic: graphs
title: Number of Islands
slug: number-of-islands
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 200](https://leetcode.com/problems/number-of-islands/)

# Problem

Given an `m x n` 2D binary grid `grid` where `'1'` represents land and `'0'` water, return number of islands.

# Understanding the problem

An island is surrounded by water and formed by connecting adjacent lands horizontally or vertically.

# Intuition

Modify grid in-place (`grid[r][c] = "0"`) to eliminate extra visited set storage.

# Approach

1. Traverse every cell (r, c) in grid.
2. If cell is "1", increment island count and start DFS.
3. In DFS: set cell to "0" (sink island) and recurse 4 directions.

# Naive Solution

DFS using explicit `visited` set.

```python filename:Python
class Solution:
    def numIslands(self, grid):
        rows = len(grid)
        cols = len(grid[0])

        visited = set()

        def dfs(r, c):
            if (
                r < 0 or r >= rows or
                c < 0 or c >= cols or
                grid[r][c] == "0" or
                (r, c) in visited
            ):
                return

            visited.add((r, c))

            dfs(r + 1, c)
            dfs(r - 1, c)
            dfs(r, c + 1)
            dfs(r, c - 1)

        count = 0

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "1" and (r, c) not in visited:
                    count += 1
                    dfs(r, c)

        return count
```

```cpp filename:C%2B%2B
class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        int rows = grid.size(), cols = grid[0].size();
        vector<vector<bool>> visited(rows, vector<bool>(cols, false));

        function<void(int, int)> dfs = [&](int r, int c) {
            if (r < 0 || r >= rows || c < 0 || c >= cols ||
                grid[r][c] == '0' || visited[r][c])
                return;

            visited[r][c] = true;

            dfs(r + 1, c);
            dfs(r - 1, c);
            dfs(r, c + 1);
            dfs(r, c - 1);
        };

        int count = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == '1' && !visited[r][c]) {
                    count++;
                    dfs(r, c);
                }
            }
        }

        return count;
    }
};
```

```java filename:Java
class Solution {
    private char[][] grid;
    private boolean[][] visited;
    private int rows, cols;

    public int numIslands(char[][] grid) {
        this.grid = grid;
        rows = grid.length;
        cols = grid[0].length;
        visited = new boolean[rows][cols];

        int count = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == '1' && !visited[r][c]) {
                    count++;
                    dfs(r, c);
                }
            }
        }

        return count;
    }

    private void dfs(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols ||
            grid[r][c] == '0' || visited[r][c])
            return;

        visited[r][c] = true;

        dfs(r + 1, c);
        dfs(r - 1, c);
        dfs(r, c + 1);
        dfs(r, c - 1);
    }
}
```

```javascript filename:JavaScript
var numIslands = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    const visited = new Set();

    const dfs = (r, c) => {
        if (
            r < 0 || r >= rows ||
            c < 0 || c >= cols ||
            grid[r][c] === "0" ||
            visited.has(r * cols + c)
        ) return;

        visited.add(r * cols + c);

        dfs(r + 1, c);
        dfs(r - 1, c);
        dfs(r, c + 1);
        dfs(r, c - 1);
    };

    let count = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === "1" && !visited.has(r * cols + c)) {
                count++;
                dfs(r, c);
            }
        }
    }

    return count;
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def numIslands(self, grid):
        rows = len(grid)
        cols = len(grid[0])

        def dfs(r, c):
            if (
                r < 0 or r >= rows or
                c < 0 or c >= cols or
                grid[r][c] == "0"
            ):
                return

            grid[r][c] = "0"

            dfs(r + 1, c)
            dfs(r - 1, c)
            dfs(r, c + 1)
            dfs(r, c - 1)

        count = 0

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "1":
                    count += 1
                    dfs(r, c)

        return count
```

```cpp filename:C%2B%2B
class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        int rows = grid.size(), cols = grid[0].size();

        function<void(int, int)> dfs = [&](int r, int c) {
            if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] == '0')
                return;

            grid[r][c] = '0';

            dfs(r + 1, c);
            dfs(r - 1, c);
            dfs(r, c + 1);
            dfs(r, c - 1);
        };

        int count = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == '1') {
                    count++;
                    dfs(r, c);
                }
            }
        }

        return count;
    }
};
```

```java filename:Java
class Solution {
    private char[][] grid;
    private int rows, cols;

    public int numIslands(char[][] grid) {
        this.grid = grid;
        rows = grid.length;
        cols = grid[0].length;

        int count = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == '1') {
                    count++;
                    dfs(r, c);
                }
            }
        }

        return count;
    }

    private void dfs(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] == '0')
            return;

        grid[r][c] = '0';

        dfs(r + 1, c);
        dfs(r - 1, c);
        dfs(r, c + 1);
        dfs(r, c - 1);
    }
}
```

```javascript filename:JavaScript
var numIslands = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    const dfs = (r, c) => {
        if (
            r < 0 || r >= rows ||
            c < 0 || c >= cols ||
            grid[r][c] === "0"
        ) return;

        grid[r][c] = "0";

        dfs(r + 1, c);
        dfs(r - 1, c);
        dfs(r, c + 1);
        dfs(r, c - 1);
    };

    let count = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === "1") {
                count++;
                dfs(r, c);
            }
        }
    }

    return count;
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C) recursion call stack · Extra Visited Space: O(1)</strong>
