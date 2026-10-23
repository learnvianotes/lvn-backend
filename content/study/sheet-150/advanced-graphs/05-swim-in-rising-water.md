---
id: 05782760-bd33-7b2d-8b44-5fb4a46ad15b
key: problem:sheet-150/lc-778
subject: sheet-150
topic: advanced-graphs
title: Swim in Rising Water
slug: swim-in-rising-water
order: 5
---

Difficulty: <strong>Hard</strong> · [LeetCode 778](https://leetcode.com/problems/swim-in-rising-water/)

# Problem

Return minimum time t to reach bottom-right `(n-1, n-1)` from `(0,0)` in grid of water elevations.

# Understanding the problem

Shortest path where path cost is `max(elevation along path)`. Solved via Modified Dijkstra.

# Intuition

Dijkstra's Algorithm with Min-Heap pops grid cells ordered by `max_elevation` along path.

# Approach

1. Min-heap \[(grid\[0\]\[0\], 0, 0)\], visited = {(0,0)}.
2. Pop (time, r, c). If (r, c) == (n-1, n-1), return time.
3. Push unvisited neighbors with max(time, grid\[nr\]\[nc\]).

# Naive Solution

Binary search on time t with BFS check.

```python filename:Python
from collections import deque

class Solution:
    def swimInWater(self, grid):
        n = len(grid)

        # Can we reach the corner using only cells with height <= t?
        def can_reach(t):
            if grid[0][0] > t:
                return False

            visited = {(0, 0)}
            queue = deque([(0, 0)])

            while queue:
                r, c = queue.popleft()

                if r == n - 1 and c == n - 1:
                    return True

                for dr, dc in [
                    (1, 0), (-1, 0),
                    (0, 1), (0, -1)
                ]:
                    nr, nc = r + dr, c + dc

                    if (
                        0 <= nr < n and
                        0 <= nc < n and
                        (nr, nc) not in visited and
                        grid[nr][nc] <= t
                    ):
                        visited.add((nr, nc))
                        queue.append((nr, nc))

            return False

        lo, hi = 0, n * n - 1

        while lo < hi:
            mid = (lo + hi) // 2

            if can_reach(mid):
                hi = mid
            else:
                lo = mid + 1

        return lo
```

```cpp filename:C%2B%2B
class Solution {
public:
    int swimInWater(vector<vector<int>>& grid) {
        int n = grid.size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        // Can we reach the corner using only cells with height <= t?
        auto canReach = [&](int t) {
            if (grid[0][0] > t) return false;

            vector<vector<bool>> visited(n, vector<bool>(n, false));
            queue<pair<int, int>> q;
            q.push({0, 0});
            visited[0][0] = true;

            while (!q.empty()) {
                auto [r, c] = q.front();
                q.pop();

                if (r == n - 1 && c == n - 1) return true;

                for (auto& d : dirs) {
                    int nr = r + d[0], nc = c + d[1];

                    if (nr >= 0 && nr < n && nc >= 0 && nc < n &&
                        !visited[nr][nc] && grid[nr][nc] <= t) {
                        visited[nr][nc] = true;
                        q.push({nr, nc});
                    }
                }
            }

            return false;
        };

        int lo = 0, hi = n * n - 1;

        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;

            if (canReach(mid)) hi = mid;
            else lo = mid + 1;
        }

        return lo;
    }
};
```

```java filename:Java
class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    public int swimInWater(int[][] grid) {
        int n = grid.length;
        int lo = 0, hi = n * n - 1;

        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;

            if (canReach(grid, mid)) hi = mid;
            else lo = mid + 1;
        }

        return lo;
    }

    // Can we reach the corner using only cells with height <= t?
    private boolean canReach(int[][] grid, int t) {
        int n = grid.length;
        if (grid[0][0] > t) return false;

        boolean[][] visited = new boolean[n][n];
        Deque<int[]> queue = new ArrayDeque<>();
        queue.offer(new int[]{0, 0});
        visited[0][0] = true;

        while (!queue.isEmpty()) {
            int[] cell = queue.poll();
            int r = cell[0], c = cell[1];

            if (r == n - 1 && c == n - 1) return true;

            for (int[] d : DIRS) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < n && nc >= 0 && nc < n &&
                    !visited[nr][nc] && grid[nr][nc] <= t) {
                    visited[nr][nc] = true;
                    queue.offer(new int[]{nr, nc});
                }
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var swimInWater = function(grid) {
    const n = grid.length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // Can we reach the corner using only cells with height <= t?
    const canReach = (t) => {
        if (grid[0][0] > t) return false;

        const visited = Array.from({ length: n }, () => new Array(n).fill(false));
        const queue = [[0, 0]];
        visited[0][0] = true;

        for (let head = 0; head < queue.length; head++) {
            const [r, c] = queue[head];

            if (r === n - 1 && c === n - 1) return true;

            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;

                if (
                    nr >= 0 && nr < n &&
                    nc >= 0 && nc < n &&
                    !visited[nr][nc] && grid[nr][nc] <= t
                ) {
                    visited[nr][nc] = true;
                    queue.push([nr, nc]);
                }
            }
        }

        return false;
    };

    let lo = 0, hi = n * n - 1;

    while (lo < hi) {
        const mid = (lo + hi) >> 1;

        if (canReach(mid)) hi = mid;
        else lo = mid + 1;
    }

    return lo;
};
```

<strong>Time: O(N^2 log(N^2)) · Aux Space: O(N^2)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def swimInWater(self, grid):
        n = len(grid)

        min_heap = [(grid[0][0], 0, 0)]
        visited = {(0, 0)}

        while min_heap:
            time, r, c = heapq.heappop(min_heap)

            if r == n - 1 and c == n - 1:
                return time

            for dr, dc in [
                (1, 0), (-1, 0),
                (0, 1), (0, -1)
            ]:
                nr, nc = r + dr, c + dc

                if (
                    0 <= nr < n and
                    0 <= nc < n and
                    (nr, nc) not in visited
                ):
                    visited.add((nr, nc))
                    heapq.heappush(
                        min_heap,
                        (max(time, grid[nr][nc]), nr, nc)
                    )

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int swimInWater(vector<vector<int>>& grid) {
        int n = grid.size();
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        // (time, r, c)
        priority_queue<array<int, 3>, vector<array<int, 3>>, greater<>> minHeap;
        minHeap.push({grid[0][0], 0, 0});

        vector<vector<bool>> visited(n, vector<bool>(n, false));
        visited[0][0] = true;

        while (!minHeap.empty()) {
            auto [time, r, c] = minHeap.top();
            minHeap.pop();

            if (r == n - 1 && c == n - 1) return time;

            for (auto& d : dirs) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < n && nc >= 0 && nc < n && !visited[nr][nc]) {
                    visited[nr][nc] = true;
                    minHeap.push({max(time, grid[nr][nc]), nr, nc});
                }
            }
        }

        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int swimInWater(int[][] grid) {
        int n = grid.length;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

        // {time, r, c}
        PriorityQueue<int[]> minHeap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        minHeap.offer(new int[]{grid[0][0], 0, 0});

        boolean[][] visited = new boolean[n][n];
        visited[0][0] = true;

        while (!minHeap.isEmpty()) {
            int[] top = minHeap.poll();
            int time = top[0], r = top[1], c = top[2];

            if (r == n - 1 && c == n - 1) return time;

            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];

                if (nr >= 0 && nr < n && nc >= 0 && nc < n && !visited[nr][nc]) {
                    visited[nr][nc] = true;
                    minHeap.offer(new int[]{Math.max(time, grid[nr][nc]), nr, nc});
                }
            }
        }

        return -1;
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor() { this.heap = []; }

    get size() { return this.heap.length; }

    push(item) {
        const h = this.heap;
        h.push(item);
        let i = h.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (h[p][0] <= h[i][0]) break;
            [h[p], h[i]] = [h[i], h[p]];
            i = p;
        }
    }

    pop() {
        const h = this.heap;
        const top = h[0];
        const last = h.pop();
        if (h.length) {
            h[0] = last;
            let i = 0;
            while (true) {
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < h.length && h[l][0] < h[m][0]) m = l;
                if (r < h.length && h[r][0] < h[m][0]) m = r;
                if (m === i) break;
                [h[m], h[i]] = [h[i], h[m]];
                i = m;
            }
        }
        return top;
    }
}

var swimInWater = function(grid) {
    const n = grid.length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const minHeap = new MinHeap();
    minHeap.push([grid[0][0], 0, 0]);  // [time, r, c]

    const visited = Array.from({ length: n }, () => new Array(n).fill(false));
    visited[0][0] = true;

    while (minHeap.size) {
        const [time, r, c] = minHeap.pop();

        if (r === n - 1 && c === n - 1) return time;

        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;

            if (
                nr >= 0 && nr < n &&
                nc >= 0 && nc < n &&
                !visited[nr][nc]
            ) {
                visited[nr][nc] = true;
                minHeap.push([Math.max(time, grid[nr][nc]), nr, nc]);
            }
        }
    }

    return -1;
};
```

<strong>Time: O(N^2 log N) · Aux Space: O(N^2)</strong>
