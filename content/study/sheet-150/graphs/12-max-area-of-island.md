---
id: b6dcad48-3231-762e-b09c-8af372857103
key: problem:sheet-150/lc-695
subject: sheet-150
topic: graphs
title: Max Area of Island
slug: max-area-of-island
order: 12
---

Difficulty: <strong>Medium</strong> · [LeetCode 695](https://leetcode.com/problems/max-area-of-island/)

# Problem

Return maximum area of an island (number of connected 1s) in a grid.

# Understanding the problem

Island area is total land cells connected 4-directionally.

# Intuition

In-place grid modification (`grid[r][c] = 0`) while summing connected land cells.

# Approach

1. Iterate grid cells. When 1 is found, call DFS.
2. DFS sets current cell to 0 and returns `1 + dfs(up) + dfs(down) + dfs(left) + dfs(right)`.
3. Track maximum area returned across all islands.

# Naive Solution

DFS with explicit `visited` set.

```python filename:Python
class Solution:
    def maxAreaOfIsland(self, grid):
        rows = len(grid)
        cols = len(grid[0])

        visited = set()

        def dfs(r, c):
            if (
                r < 0 or r >= rows or
                c < 0 or c >= cols or
                grid[r][c] == 0 or
                (r, c) in visited
            ):
                return 0

            visited.add((r, c))

            return (
                1
                + dfs(r + 1, c)
                + dfs(r - 1, c)
                + dfs(r, c + 1)
                + dfs(r, c - 1)
            )

        answer = 0

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 1 and (r, c) not in visited:
                    answer = max(answer, dfs(r, c))

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxAreaOfIsland(vector<vector<int>>& grid) {
        int rows = grid.size(), cols = grid[0].size();
        vector<vector<bool>> visited(rows, vector<bool>(cols, false));

        function<int(int, int)> dfs = [&](int r, int c) -> int {
            if (r < 0 || r >= rows || c < 0 || c >= cols ||
                grid[r][c] == 0 || visited[r][c])
                return 0;

            visited[r][c] = true;

            return 1 + dfs(r + 1, c) + dfs(r - 1, c)
                     + dfs(r, c + 1) + dfs(r, c - 1);
        };

        int answer = 0;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (grid[r][c] == 1 && !visited[r][c])
                    answer = max(answer, dfs(r, c));

        return answer;
    }
};
```

```java filename:Java
class Solution {
    private int[][] grid;
    private boolean[][] visited;
    private int rows, cols;

    public int maxAreaOfIsland(int[][] grid) {
        this.grid = grid;
        rows = grid.length;
        cols = grid[0].length;
        visited = new boolean[rows][cols];

        int answer = 0;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (grid[r][c] == 1 && !visited[r][c])
                    answer = Math.max(answer, dfs(r, c));

        return answer;
    }

    private int dfs(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols ||
            grid[r][c] == 0 || visited[r][c])
            return 0;

        visited[r][c] = true;

        return 1 + dfs(r + 1, c) + dfs(r - 1, c)
                 + dfs(r, c + 1) + dfs(r, c - 1);
    }
}
```

```javascript filename:JavaScript
var maxAreaOfIsland = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));

    const dfs = (r, c) => {
        if (
            r < 0 || r >= rows ||
            c < 0 || c >= cols ||
            grid[r][c] === 0 || visited[r][c]
        ) return 0;

        visited[r][c] = true;

        return 1 + dfs(r + 1, c) + dfs(r - 1, c)
                 + dfs(r, c + 1) + dfs(r, c - 1);
    };

    let answer = 0;

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (grid[r][c] === 1 && !visited[r][c])
                answer = Math.max(answer, dfs(r, c));

    return answer;
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxAreaOfIsland(self, grid):
        rows = len(grid)
        cols = len(grid[0])

        def dfs(r, c):
            if (
                r < 0 or r >= rows or
                c < 0 or c >= cols or
                grid[r][c] == 0
            ):
                return 0

            grid[r][c] = 0

            return (
                1
                + dfs(r + 1, c)
                + dfs(r - 1, c)
                + dfs(r, c + 1)
                + dfs(r, c - 1)
            )

        answer = 0

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 1:
                    answer = max(answer, dfs(r, c))

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxAreaOfIsland(vector<vector<int>>& grid) {
        int rows = grid.size(), cols = grid[0].size();

        function<int(int, int)> dfs = [&](int r, int c) -> int {
            if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] == 0)
                return 0;

            grid[r][c] = 0;

            return 1 + dfs(r + 1, c) + dfs(r - 1, c)
                     + dfs(r, c + 1) + dfs(r, c - 1);
        };

        int answer = 0;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (grid[r][c] == 1)
                    answer = max(answer, dfs(r, c));

        return answer;
    }
};
```

```java filename:Java
class Solution {
    private int[][] grid;
    private int rows, cols;

    public int maxAreaOfIsland(int[][] grid) {
        this.grid = grid;
        rows = grid.length;
        cols = grid[0].length;

        int answer = 0;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (grid[r][c] == 1)
                    answer = Math.max(answer, dfs(r, c));

        return answer;
    }

    private int dfs(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] == 0)
            return 0;

        grid[r][c] = 0;

        return 1 + dfs(r + 1, c) + dfs(r - 1, c)
                 + dfs(r, c + 1) + dfs(r, c - 1);
    }
}
```

```javascript filename:JavaScript
var maxAreaOfIsland = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    const dfs = (r, c) => {
        if (
            r < 0 || r >= rows ||
            c < 0 || c >= cols ||
            grid[r][c] === 0
        ) return 0;

        grid[r][c] = 0;

        return 1 + dfs(r + 1, c) + dfs(r - 1, c)
                 + dfs(r, c + 1) + dfs(r, c - 1);
    };

    let answer = 0;

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (grid[r][c] === 1)
                answer = Math.max(answer, dfs(r, c));

    return answer;
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C) · Extra Visited Space: O(1)</strong>
