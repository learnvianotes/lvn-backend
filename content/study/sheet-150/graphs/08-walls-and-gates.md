---
id: d98582c2-bcd8-744d-92b7-0573725b1df8
key: problem:sheet-150/lc-286
subject: sheet-150
topic: graphs
title: Walls and Gates
slug: walls-and-gates
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 286](https://leetcode.com/problems/walls-and-gates/)

# Problem

Fill each empty room with distance to its nearest gate. Empty room=INF (2147483647), Wall=-1, Gate=0.

# Understanding the problem

Multi-source BFS starting from all gates simultaneously.

# Intuition

Multi-source BFS from all gates simultaneously.

# Approach

1. Enqueue all gate positions (0).
2. While queue: pop (r, c), check 4 neighbors. If neighbor is INF, update distance to `rooms[r][c] + 1` and push.

# Naive Solution

Run BFS from every empty room.

```python filename:Python
from collections import deque

class Solution:
    def wallsAndGates(self, rooms):
        INF = 2147483647
        rows = len(rooms)
        cols = len(rooms[0])

        # BFS outward from one empty room until the nearest gate is found
        def nearest_gate(sr, sc):
            visited = {(sr, sc)}
            queue = deque([(sr, sc, 0)])

            while queue:
                r, c, dist = queue.popleft()

                if rooms[r][c] == 0:
                    return dist

                for dr, dc in [
                    (1, 0), (-1, 0),
                    (0, 1), (0, -1)
                ]:
                    nr, nc = r + dr, c + dc

                    if (
                        0 <= nr < rows
                        and 0 <= nc < cols
                        and (nr, nc) not in visited
                        and rooms[nr][nc] != -1
                    ):
                        visited.add((nr, nc))
                        queue.append((nr, nc, dist + 1))

            return INF

        for r in range(rows):
            for c in range(cols):
                if rooms[r][c] == INF:
                    rooms[r][c] = nearest_gate(r, c)
```

```cpp filename:C%2B%2B
class Solution {
public:
    void wallsAndGates(vector<vector<int>>& rooms) {
        const int INF = 2147483647;
        int rows = rooms.size(), cols = rooms[0].size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        // BFS outward from one empty room until the nearest gate is found
        auto nearestGate = [&](int sr, int sc) {
            vector<vector<bool>> visited(rows, vector<bool>(cols, false));
            queue<tuple<int, int, int>> q;
            q.push({sr, sc, 0});
            visited[sr][sc] = true;

            while (!q.empty()) {
                auto [r, c, dist] = q.front();
                q.pop();

                if (rooms[r][c] == 0) return dist;

                for (auto& d : dirs) {
                    int nr = r + d[0], nc = c + d[1];

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                        !visited[nr][nc] && rooms[nr][nc] != -1) {
                        visited[nr][nc] = true;
                        q.push({nr, nc, dist + 1});
                    }
                }
            }

            return INF;
        };

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (rooms[r][c] == INF)
                    rooms[r][c] = nearestGate(r, c);
    }
};
```

```java filename:Java
class Solution {
    private static final int INF = 2147483647;
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    public void wallsAndGates(int[][] rooms) {
        int rows = rooms.length, cols = rooms[0].length;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (rooms[r][c] == INF)
                    rooms[r][c] = nearestGate(rooms, r, c);
    }

    // BFS outward from one empty room until the nearest gate is found
    private int nearestGate(int[][] rooms, int sr, int sc) {
        int rows = rooms.length, cols = rooms[0].length;
        boolean[][] visited = new boolean[rows][cols];
        Deque<int[]> queue = new ArrayDeque<>();
        queue.offer(new int[]{sr, sc, 0});
        visited[sr][sc] = true;

        while (!queue.isEmpty()) {
            int[] cur = queue.poll();
            int r = cur[0], c = cur[1], dist = cur[2];

            if (rooms[r][c] == 0) return dist;

            for (int[] d : DIRS) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                    !visited[nr][nc] && rooms[nr][nc] != -1) {
                    visited[nr][nc] = true;
                    queue.offer(new int[]{nr, nc, dist + 1});
                }
            }
        }

        return INF;
    }
}
```

```javascript filename:JavaScript
var wallsAndGates = function(rooms) {
    const INF = 2147483647;
    const rows = rooms.length;
    const cols = rooms[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // BFS outward from one empty room until the nearest gate is found
    const nearestGate = (sr, sc) => {
        const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
        const queue = [[sr, sc, 0]];
        visited[sr][sc] = true;

        for (let head = 0; head < queue.length; head++) {
            const [r, c, dist] = queue[head];

            if (rooms[r][c] === 0) return dist;

            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;

                if (
                    nr >= 0 && nr < rows &&
                    nc >= 0 && nc < cols &&
                    !visited[nr][nc] && rooms[nr][nc] !== -1
                ) {
                    visited[nr][nc] = true;
                    queue.push([nr, nc, dist + 1]);
                }
            }
        }

        return INF;
    };

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (rooms[r][c] === INF)
                rooms[r][c] = nearestGate(r, c);
};
```

<strong>Time: O((R × C)^2) · Aux Space: O(R × C)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def wallsAndGates(self, rooms):
        rows = len(rooms)
        cols = len(rooms[0])

        queue = deque()

        for r in range(rows):
            for c in range(cols):
                if rooms[r][c] == 0:
                    queue.append((r, c))

        while queue:
            r, c = queue.popleft()

            for dr, dc in [
                (1, 0), (-1, 0),
                (0, 1), (0, -1)
            ]:
                nr, nc = r + dr, c + dc

                if (
                    0 <= nr < rows
                    and 0 <= nc < cols
                    and rooms[nr][nc] == 2147483647
                ):
                    rooms[nr][nc] = rooms[r][c] + 1
                    queue.append((nr, nc))
```

```cpp filename:C%2B%2B
class Solution {
public:
    void wallsAndGates(vector<vector<int>>& rooms) {
        int rows = rooms.size(), cols = rooms[0].size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        queue<pair<int, int>> q;

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (rooms[r][c] == 0) q.push({r, c});

        while (!q.empty()) {
            auto [r, c] = q.front();
            q.pop();

            for (auto& d : dirs) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                    rooms[nr][nc] == 2147483647) {
                    rooms[nr][nc] = rooms[r][c] + 1;
                    q.push({nr, nc});
                }
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public void wallsAndGates(int[][] rooms) {
        int rows = rooms.length, cols = rooms[0].length;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        Deque<int[]> queue = new ArrayDeque<>();

        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (rooms[r][c] == 0) queue.offer(new int[]{r, c});

        while (!queue.isEmpty()) {
            int[] cell = queue.poll();
            int r = cell[0], c = cell[1];

            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                    rooms[nr][nc] == Integer.MAX_VALUE) {
                    rooms[nr][nc] = rooms[r][c] + 1;
                    queue.offer(new int[]{nr, nc});
                }
            }
        }
    }
}
```

```javascript filename:JavaScript
var wallsAndGates = function(rooms) {
    const rows = rooms.length;
    const cols = rooms[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const queue = [];

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (rooms[r][c] === 0) queue.push([r, c]);

    for (let head = 0; head < queue.length; head++) {
        const [r, c] = queue[head];

        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;

            if (
                nr >= 0 && nr < rows &&
                nc >= 0 && nc < cols &&
                rooms[nr][nc] === 2147483647
            ) {
                rooms[nr][nc] = rooms[r][c] + 1;
                queue.push([nr, nc]);
            }
        }
    }
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C)</strong>
