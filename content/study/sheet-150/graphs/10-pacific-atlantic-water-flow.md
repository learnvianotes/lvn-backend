---
id: d7ad4748-9b7f-7b42-82c6-260bcda5ea1c
key: problem:sheet-150/lc-417
subject: sheet-150
topic: graphs
title: Pacific Atlantic Water Flow
slug: pacific-atlantic-water-flow
order: 10
---

Difficulty: <strong>Medium</strong> · [LeetCode 417](https://leetcode.com/problems/pacific-atlantic-water-flow/)

# Problem

Find grid coordinates that can flow water to BOTH Pacific Ocean (top/left) and Atlantic Ocean (bottom/right).

# Understanding the problem

Reverse problem: ask which cells can be reached by starting at ocean borders and flowing UPHILL.

# Intuition

Multi-source BFS starting from ocean borders moving uphill.

# Approach

1. Start multi-source BFS from Pacific ocean borders into set P.
2. Start multi-source BFS from Atlantic ocean borders into set A.
3. Return intersection of sets `P & A`.

# Naive Solution

For every cell, perform DFS to check if it reaches both oceans.

```python filename:Python
class Solution:
    def pacificAtlantic(self, heights):
        rows = len(heights)
        cols = len(heights[0])

        result = []

        def can_reach(r, c, target):
            visited = set()

            def dfs(x, y):
                if (x, y) in visited:
                    return False

                if target == "P" and (x == 0 or y == 0):
                    return True

                if target == "A" and (
                    x == rows - 1 or y == cols - 1
                ):
                    return True

                visited.add((x, y))

                for dx, dy in [
                    (1, 0), (-1, 0),
                    (0, 1), (0, -1)
                ]:
                    nx, ny = x + dx, y + dy

                    if (
                        0 <= nx < rows and
                        0 <= ny < cols and
                        heights[nx][ny] <= heights[x][y]
                    ):
                        if dfs(nx, ny):
                            return True

                return False

            return dfs(r, c)

        for r in range(rows):
            for c in range(cols):
                if (
                    can_reach(r, c, "P")
                    and can_reach(r, c, "A")
                ):
                    result.append([r, c])

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> pacificAtlantic(vector<vector<int>>& heights) {
        int rows = heights.size(), cols = heights[0].size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        auto canReach = [&](int r, int c, char target) {
            vector<vector<bool>> visited(rows, vector<bool>(cols, false));

            function<bool(int, int)> dfs = [&](int x, int y) -> bool {
                if (visited[x][y]) return false;

                if (target == 'P' && (x == 0 || y == 0)) return true;
                if (target == 'A' && (x == rows - 1 || y == cols - 1)) return true;

                visited[x][y] = true;

                for (auto& d : dirs) {
                    int nx = x + d[0], ny = y + d[1];

                    if (nx >= 0 && nx < rows && ny >= 0 && ny < cols &&
                        heights[nx][ny] <= heights[x][y]) {
                        if (dfs(nx, ny)) return true;
                    }
                }

                return false;
            };

            return dfs(r, c);
        };

        vector<vector<int>> result;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (canReach(r, c, 'P') && canReach(r, c, 'A'))
                    result.push_back({r, c});

        return result;
    }
};
```

```java filename:Java
class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    private int[][] heights;
    private int rows, cols;
    private boolean[][] visited;

    public List<List<Integer>> pacificAtlantic(int[][] heights) {
        this.heights = heights;
        rows = heights.length;
        cols = heights[0].length;

        List<List<Integer>> result = new ArrayList<>();

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (canReach(r, c, 'P') && canReach(r, c, 'A'))
                    result.add(Arrays.asList(r, c));

        return result;
    }

    private boolean canReach(int r, int c, char target) {
        visited = new boolean[rows][cols];
        return dfs(r, c, target);
    }

    private boolean dfs(int x, int y, char target) {
        if (visited[x][y]) return false;

        if (target == 'P' && (x == 0 || y == 0)) return true;
        if (target == 'A' && (x == rows - 1 || y == cols - 1)) return true;

        visited[x][y] = true;

        for (int[] d : DIRS) {
            int nx = x + d[0], ny = y + d[1];

            if (nx >= 0 && nx < rows && ny >= 0 && ny < cols &&
                heights[nx][ny] <= heights[x][y]) {
                if (dfs(nx, ny, target)) return true;
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var pacificAtlantic = function(heights) {
    const rows = heights.length;
    const cols = heights[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const result = [];

    const canReach = (r, c, target) => {
        const visited = new Set();

        const dfs = (x, y) => {
            if (visited.has(x * cols + y)) return false;

            if (target === "P" && (x === 0 || y === 0)) return true;
            if (target === "A" && (x === rows - 1 || y === cols - 1)) return true;

            visited.add(x * cols + y);

            for (const [dx, dy] of dirs) {
                const nx = x + dx, ny = y + dy;

                if (
                    nx >= 0 && nx < rows &&
                    ny >= 0 && ny < cols &&
                    heights[nx][ny] <= heights[x][y]
                ) {
                    if (dfs(nx, ny)) return true;
                }
            }

            return false;
        };

        return dfs(r, c);
    };

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (canReach(r, c, "P") && canReach(r, c, "A"))
                result.push([r, c]);

    return result;
};
```

<strong>Time: O((R × C)^2) · Aux Space: O(R × C)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def pacificAtlantic(self, heights):
        rows = len(heights)
        cols = len(heights[0])

        def bfs(starts):
            visited = set()
            queue = deque(starts)

            for cell in starts:
                visited.add(cell)

            while queue:
                r, c = queue.popleft()

                for dr, dc in [
                    (1, 0), (-1, 0),
                    (0, 1), (0, -1)
                ]:
                    nr, nc = r + dr, c + dc

                    if (
                        0 <= nr < rows and
                        0 <= nc < cols
                        and (nr, nc) not in visited
                        and heights[nr][nc] >= heights[r][c]
                    ):
                        visited.add((nr, nc))
                        queue.append((nr, nc))

            return visited

        pacific = []

        for r in range(rows):
            pacific.append((r, 0))

        for c in range(cols):
            pacific.append((0, c))

        atlantic = []

        for r in range(rows):
            atlantic.append((r, cols - 1))

        for c in range(cols):
            atlantic.append((rows - 1, c))

        p = bfs(pacific)
        a = bfs(atlantic)

        return [
            [r, c]
            for r, c in p & a
        ]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> pacificAtlantic(vector<vector<int>>& heights) {
        int rows = heights.size(), cols = heights[0].size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        auto bfs = [&](const vector<pair<int, int>>& starts) {
            vector<vector<bool>> visited(rows, vector<bool>(cols, false));
            queue<pair<int, int>> q;

            for (auto& [r, c] : starts) {
                visited[r][c] = true;
                q.push({r, c});
            }

            while (!q.empty()) {
                auto [r, c] = q.front();
                q.pop();

                for (auto& d : dirs) {
                    int nr = r + d[0], nc = c + d[1];

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                        !visited[nr][nc] && heights[nr][nc] >= heights[r][c]) {
                        visited[nr][nc] = true;
                        q.push({nr, nc});
                    }
                }
            }

            return visited;
        };

        vector<pair<int, int>> pacific, atlantic;

        for (int r = 0; r < rows; r++) pacific.push_back({r, 0});
        for (int c = 0; c < cols; c++) pacific.push_back({0, c});

        for (int r = 0; r < rows; r++) atlantic.push_back({r, cols - 1});
        for (int c = 0; c < cols; c++) atlantic.push_back({rows - 1, c});

        auto p = bfs(pacific);
        auto a = bfs(atlantic);

        vector<vector<int>> result;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (p[r][c] && a[r][c])
                    result.push_back({r, c});

        return result;
    }
};
```

```java filename:Java
class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    private int[][] heights;
    private int rows, cols;

    public List<List<Integer>> pacificAtlantic(int[][] heights) {
        this.heights = heights;
        rows = heights.length;
        cols = heights[0].length;

        List<int[]> pacific = new ArrayList<>();
        for (int r = 0; r < rows; r++) pacific.add(new int[]{r, 0});
        for (int c = 0; c < cols; c++) pacific.add(new int[]{0, c});

        List<int[]> atlantic = new ArrayList<>();
        for (int r = 0; r < rows; r++) atlantic.add(new int[]{r, cols - 1});
        for (int c = 0; c < cols; c++) atlantic.add(new int[]{rows - 1, c});

        boolean[][] p = bfs(pacific);
        boolean[][] a = bfs(atlantic);

        List<List<Integer>> result = new ArrayList<>();

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (p[r][c] && a[r][c])
                    result.add(Arrays.asList(r, c));

        return result;
    }

    private boolean[][] bfs(List<int[]> starts) {
        boolean[][] visited = new boolean[rows][cols];
        Deque<int[]> queue = new ArrayDeque<>();

        for (int[] cell : starts) {
            visited[cell[0]][cell[1]] = true;
            queue.offer(cell);
        }

        while (!queue.isEmpty()) {
            int[] cell = queue.poll();
            int r = cell[0], c = cell[1];

            for (int[] d : DIRS) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                    !visited[nr][nc] && heights[nr][nc] >= heights[r][c]) {
                    visited[nr][nc] = true;
                    queue.offer(new int[]{nr, nc});
                }
            }
        }

        return visited;
    }
}
```

```javascript filename:JavaScript
var pacificAtlantic = function(heights) {
    const rows = heights.length;
    const cols = heights[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const bfs = (starts) => {
        const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
        const queue = [];

        for (const [r, c] of starts) {
            visited[r][c] = true;
            queue.push([r, c]);
        }

        for (let head = 0; head < queue.length; head++) {
            const [r, c] = queue[head];

            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;

                if (
                    nr >= 0 && nr < rows &&
                    nc >= 0 && nc < cols &&
                    !visited[nr][nc] &&
                    heights[nr][nc] >= heights[r][c]
                ) {
                    visited[nr][nc] = true;
                    queue.push([nr, nc]);
                }
            }
        }

        return visited;
    };

    const pacific = [];
    for (let r = 0; r < rows; r++) pacific.push([r, 0]);
    for (let c = 0; c < cols; c++) pacific.push([0, c]);

    const atlantic = [];
    for (let r = 0; r < rows; r++) atlantic.push([r, cols - 1]);
    for (let c = 0; c < cols; c++) atlantic.push([rows - 1, c]);

    const p = bfs(pacific);
    const a = bfs(atlantic);

    const result = [];

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (p[r][c] && a[r][c])
                result.push([r, c]);

    return result;
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C)</strong>

# Takeaway

<strong>Pattern:</strong> Reverse the problem (ask which cells can be reached from ocean flowing uphill).
