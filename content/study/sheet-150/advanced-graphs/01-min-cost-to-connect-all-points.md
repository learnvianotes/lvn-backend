---
id: 67c3de5c-8c76-7627-999c-ea46ac4373ed
key: problem:sheet-150/lc-1584
subject: sheet-150
topic: advanced-graphs
title: Min Cost to Connect All Points
slug: min-cost-to-connect-all-points
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 1584](https://leetcode.com/problems/min-cost-to-connect-all-points/)

# Problem

Return minimum cost to connect all points (Manhattan distance `|x1-x2| + |y1-y2|`).

# Understanding the problem

Minimum Spanning Tree (MST) problem on complete graph using Prim's algorithm.

# Intuition

Prim's algorithm with min-heap dynamically tracks minimum edge cost from current MST tree to unvisited nodes.

# Approach

1. Min-heap \[(0, 0)\], visited set, total\_cost = 0.
2. Pop (cost, node). If visited continue. Add to visited, add cost.
3. For all unvisited points: compute distance, push to min-heap.

# Naive Solution

Kruskal's algorithm building and sorting all N^2 edges.

```python filename:Python
class Solution:
    def minCostConnectPoints(self, points):
        n = len(points)

        # Build every edge (dist, i, j) and sort them
        edges = []

        for i in range(n):
            for j in range(i + 1, n):
                dist = (
                    abs(points[i][0] - points[j][0])
                    + abs(points[i][1] - points[j][1])
                )
                edges.append((dist, i, j))

        edges.sort()

        parent = list(range(n))

        def find(x):
            while x != parent[x]:
                parent[x] = parent[parent[x]]
                x = parent[x]

            return x

        total_cost = 0
        used = 0

        for dist, i, j in edges:
            root_i = find(i)
            root_j = find(j)

            if root_i == root_j:
                continue

            parent[root_i] = root_j
            total_cost += dist
            used += 1

            if used == n - 1:
                break

        return total_cost
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minCostConnectPoints(vector<vector<int>>& points) {
        int n = points.size();

        // Build every edge (dist, i, j) and sort them
        vector<array<int, 3>> edges;
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                int dist = abs(points[i][0] - points[j][0]) + abs(points[i][1] - points[j][1]);
                edges.push_back({dist, i, j});
            }
        }
        sort(edges.begin(), edges.end());

        vector<int> parent(n);
        iota(parent.begin(), parent.end(), 0);

        function<int(int)> find = [&](int x) {
            return parent[x] == x ? x : parent[x] = find(parent[x]);
        };

        int totalCost = 0, used = 0;

        for (auto& [dist, i, j] : edges) {
            int rootI = find(i), rootJ = find(j);
            if (rootI == rootJ) continue;

            parent[rootI] = rootJ;
            totalCost += dist;

            if (++used == n - 1) break;
        }

        return totalCost;
    }
};
```

```java filename:Java
class Solution {
    private int[] parent;

    public int minCostConnectPoints(int[][] points) {
        int n = points.length;

        // Build every edge (dist, i, j) and sort them
        List<int[]> edges = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                int dist = Math.abs(points[i][0] - points[j][0]) + Math.abs(points[i][1] - points[j][1]);
                edges.add(new int[]{dist, i, j});
            }
        }
        edges.sort((a, b) -> Integer.compare(a[0], b[0]));

        parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;

        int totalCost = 0, used = 0;

        for (int[] e : edges) {
            int rootI = find(e[1]), rootJ = find(e[2]);
            if (rootI == rootJ) continue;

            parent[rootI] = rootJ;
            totalCost += e[0];

            if (++used == n - 1) break;
        }

        return totalCost;
    }

    private int find(int x) {
        while (x != parent[x]) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }
}
```

```javascript filename:JavaScript
var minCostConnectPoints = function(points) {
    const n = points.length;

    // Build every edge [dist, i, j] and sort them
    const edges = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dist = Math.abs(points[i][0] - points[j][0]) + Math.abs(points[i][1] - points[j][1]);
            edges.push([dist, i, j]);
        }
    }
    edges.sort((a, b) => a[0] - b[0]);

    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (x) => {
        while (x !== parent[x]) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    let totalCost = 0, used = 0;

    for (const [dist, i, j] of edges) {
        const rootI = find(i), rootJ = find(j);
        if (rootI === rootJ) continue;

        parent[rootI] = rootJ;
        totalCost += dist;

        if (++used === n - 1) break;
    }

    return totalCost;
};
```

<strong>Time: O(N^2 log N) · Aux Space: O(N^2)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def minCostConnectPoints(self, points):
        n = len(points)
        visited = set()
        min_heap = [(0, 0)]  # (cost, point_index)

        total_cost = 0

        while len(visited) < n:
            cost, u = heapq.heappop(min_heap)

            if u in visited:
                continue

            visited.add(u)
            total_cost += cost

            x1, y1 = points[u]

            for v in range(n):
                if v not in visited:
                    x2, y2 = points[v]
                    dist = abs(x1 - x2) + abs(y1 - y2)
                    heapq.heappush(min_heap, (dist, v))

        return total_cost
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minCostConnectPoints(vector<vector<int>>& points) {
        int n = points.size();
        vector<bool> visited(n, false);
        int visitedCount = 0;

        // (cost, point_index)
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> minHeap;
        minHeap.push({0, 0});

        int totalCost = 0;

        while (visitedCount < n) {
            auto [cost, u] = minHeap.top();
            minHeap.pop();

            if (visited[u]) continue;

            visited[u] = true;
            visitedCount++;
            totalCost += cost;

            for (int v = 0; v < n; v++) {
                if (!visited[v]) {
                    int dist = abs(points[u][0] - points[v][0]) + abs(points[u][1] - points[v][1]);
                    minHeap.push({dist, v});
                }
            }
        }

        return totalCost;
    }
};
```

```java filename:Java
class Solution {
    public int minCostConnectPoints(int[][] points) {
        int n = points.length;
        boolean[] visited = new boolean[n];
        int visitedCount = 0;

        // {cost, point_index}
        PriorityQueue<int[]> minHeap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        minHeap.offer(new int[]{0, 0});

        int totalCost = 0;

        while (visitedCount < n) {
            int[] top = minHeap.poll();
            int cost = top[0], u = top[1];

            if (visited[u]) continue;

            visited[u] = true;
            visitedCount++;
            totalCost += cost;

            for (int v = 0; v < n; v++) {
                if (!visited[v]) {
                    int dist = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]);
                    minHeap.offer(new int[]{dist, v});
                }
            }
        }

        return totalCost;
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

var minCostConnectPoints = function(points) {
    const n = points.length;
    const visited = new Array(n).fill(false);
    let visitedCount = 0;

    const minHeap = new MinHeap();
    minHeap.push([0, 0]);  // [cost, point_index]

    let totalCost = 0;

    while (visitedCount < n) {
        const [cost, u] = minHeap.pop();

        if (visited[u]) continue;

        visited[u] = true;
        visitedCount++;
        totalCost += cost;

        const [x1, y1] = points[u];

        for (let v = 0; v < n; v++) {
            if (!visited[v]) {
                const [x2, y2] = points[v];
                minHeap.push([Math.abs(x1 - x2) + Math.abs(y1 - y2), v]);
            }
        }
    }

    return totalCost;
};
```

<strong>Time: O(N^2 log N) · Aux Space: O(N^2)</strong>
