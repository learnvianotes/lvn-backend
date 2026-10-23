---
id: 96583aab-8475-7de0-8241-890ec32d8367
key: problem:sheet-150/lc-994
subject: sheet-150
topic: graphs
title: Rotting Oranges
slug: rotting-oranges
order: 13
---

Difficulty: <strong>Medium</strong> · [LeetCode 994](https://leetcode.com/problems/rotting-oranges/)

# Problem

Return minimum minutes that must elapse until no cell has a fresh orange. If impossible return -1.

# Understanding the problem

Multi-source BFS where all rotten oranges start in queue at minute 0 and rot adjacent fresh oranges simultaneously.

# Intuition

Multi-source BFS starting from all rotten oranges simultaneously.

# Approach

1. Enqueue all rotten oranges (val=2), count total fresh oranges (val=1).
2. While queue and fresh &gt; 0: increment minutes, rot fresh neighbors, push to queue, decrement fresh count.
3. Return minutes if fresh == 0 else -1.

# Naive Solution

Scan full grid minute-by-minute.

```python filename:Python
class Solution:
    def orangesRotting(self, grid):
        rows = len(grid)
        cols = len(grid[0])

        minutes = 0

        # Each minute, rescan the whole grid and rot neighbours of rotten oranges
        while True:
            changed = False

            for r in range(rows):
                for c in range(cols):
                    if grid[r][c] != 2:
                        continue

                    for dr, dc in [
                        (1, 0), (-1, 0),
                        (0, 1), (0, -1)
                    ]:
                        nr, nc = r + dr, c + dc

                        if (
                            0 <= nr < rows and
                            0 <= nc < cols and
                            grid[nr][nc] == 1
                        ):
                            grid[nr][nc] = 3  # rots this minute, spreads next minute
                            changed = True

            if not changed:
                break

            for row in grid:
                for c in range(cols):
                    if row[c] == 3:
                        row[c] = 2

            minutes += 1

        for row in grid:
            if 1 in row:
                return -1

        return minutes
```

```cpp filename:C%2B%2B
class Solution {
public:
    int orangesRotting(vector<vector<int>>& grid) {
        int rows = grid.size(), cols = grid[0].size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        int minutes = 0;

        // Each minute, rescan the whole grid and rot neighbours of rotten oranges
        while (true) {
            bool changed = false;

            for (int r = 0; r < rows; r++) {
                for (int c = 0; c < cols; c++) {
                    if (grid[r][c] != 2) continue;

                    for (auto& d : dirs) {
                        int nr = r + d[0], nc = c + d[1];

                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                            grid[nr][nc] = 3;  // rots this minute, spreads next minute
                            changed = true;
                        }
                    }
                }
            }

            if (!changed) break;

            for (auto& row : grid)
                for (int& cell : row)
                    if (cell == 3) cell = 2;

            minutes++;
        }

        for (auto& row : grid)
            for (int cell : row)
                if (cell == 1) return -1;

        return minutes;
    }
};
```

```java filename:Java
class Solution {
    public int orangesRotting(int[][] grid) {
        int rows = grid.length, cols = grid[0].length;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        int minutes = 0;

        // Each minute, rescan the whole grid and rot neighbours of rotten oranges
        while (true) {
            boolean changed = false;

            for (int r = 0; r < rows; r++) {
                for (int c = 0; c < cols; c++) {
                    if (grid[r][c] != 2) continue;

                    for (int[] d : dirs) {
                        int nr = r + d[0], nc = c + d[1];

                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                            grid[nr][nc] = 3;  // rots this minute, spreads next minute
                            changed = true;
                        }
                    }
                }
            }

            if (!changed) break;

            for (int[] row : grid)
                for (int c = 0; c < cols; c++)
                    if (row[c] == 3) row[c] = 2;

            minutes++;
        }

        for (int[] row : grid)
            for (int cell : row)
                if (cell == 1) return -1;

        return minutes;
    }
}
```

```javascript filename:JavaScript
var orangesRotting = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let minutes = 0;

    // Each minute, rescan the whole grid and rot neighbours of rotten oranges
    while (true) {
        let changed = false;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] !== 2) continue;

                for (const [dr, dc] of dirs) {
                    const nr = r + dr, nc = c + dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 1) {
                        grid[nr][nc] = 3;  // rots this minute, spreads next minute
                        changed = true;
                    }
                }
            }
        }

        if (!changed) break;

        for (const row of grid)
            for (let c = 0; c < cols; c++)
                if (row[c] === 3) row[c] = 2;

        minutes++;
    }

    for (const row of grid)
        if (row.includes(1)) return -1;

    return minutes;
};
```

<strong>Time: O((R × C)^2) · Aux Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def orangesRotting(self, grid):
        rows = len(grid)
        cols = len(grid[0])

        queue = deque()
        fresh = 0

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 2:
                    queue.append((r, c))
                elif grid[r][c] == 1:
                    fresh += 1

        minutes = 0

        while queue and fresh:
            for _ in range(len(queue)):
                r, c = queue.popleft()

                for dr, dc in [
                    (1, 0), (-1, 0),
                    (0, 1), (0, -1)
                ]:
                    nr, nc = r + dr, c + dc

                    if (
                        0 <= nr < rows and
                        0 <= nc < cols
                        and grid[nr][nc] == 1
                    ):
                        grid[nr][nc] = 2
                        fresh -= 1
                        queue.append((nr, nc))

            minutes += 1

        return minutes if fresh == 0 else -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int orangesRotting(vector<vector<int>>& grid) {
        int rows = grid.size(), cols = grid[0].size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        queue<pair<int, int>> q;
        int fresh = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == 2) q.push({r, c});
                else if (grid[r][c] == 1) fresh++;
            }
        }

        int minutes = 0;

        while (!q.empty() && fresh) {
            for (int i = q.size(); i > 0; i--) {
                auto [r, c] = q.front();
                q.pop();

                for (auto& d : dirs) {
                    int nr = r + d[0], nc = c + d[1];

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                        grid[nr][nc] = 2;
                        fresh--;
                        q.push({nr, nc});
                    }
                }
            }

            minutes++;
        }

        return fresh == 0 ? minutes : -1;
    }
};
```

```java filename:Java
class Solution {
    public int orangesRotting(int[][] grid) {
        int rows = grid.length, cols = grid[0].length;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        Deque<int[]> queue = new ArrayDeque<>();
        int fresh = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == 2) queue.offer(new int[]{r, c});
                else if (grid[r][c] == 1) fresh++;
            }
        }

        int minutes = 0;

        while (!queue.isEmpty() && fresh > 0) {
            for (int i = queue.size(); i > 0; i--) {
                int[] cell = queue.poll();

                for (int[] d : dirs) {
                    int nr = cell[0] + d[0], nc = cell[1] + d[1];

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                        grid[nr][nc] = 2;
                        fresh--;
                        queue.offer(new int[]{nr, nc});
                    }
                }
            }

            minutes++;
        }

        return fresh == 0 ? minutes : -1;
    }
}
```

```javascript filename:JavaScript
var orangesRotting = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    let queue = [];
    let fresh = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === 2) queue.push([r, c]);
            else if (grid[r][c] === 1) fresh++;
        }
    }

    let minutes = 0;

    while (queue.length && fresh) {
        const next = [];

        for (const [r, c] of queue) {
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;

                if (
                    nr >= 0 && nr < rows &&
                    nc >= 0 && nc < cols &&
                    grid[nr][nc] === 1
                ) {
                    grid[nr][nc] = 2;
                    fresh--;
                    next.push([nr, nc]);
                }
            }
        }

        queue = next;
        minutes++;
    }

    return fresh === 0 ? minutes : -1;
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C)</strong>

# Takeaway

<strong>Pattern:</strong> Multi-source BFS = simultaneous expansion.
