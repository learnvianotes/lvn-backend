---
id: ae9426cd-5939-7649-9791-f2b33bb0c1f6
key: problem:sheet-150/lc-743
subject: sheet-150
topic: advanced-graphs
title: Network Delay Time
slug: network-delay-time
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 743](https://leetcode.com/problems/network-delay-time/)

# Problem

Return minimum time for all `n` nodes to receive signal from source node `k`. Return -1 if impossible.

# Understanding the problem

Single-source shortest path on weighted directed graph with non-negative edge weights → Dijkstra's Algorithm!

# Intuition

Dijkstra's with Min-Heap pops minimum distance node greedily. Maximum distance in final visited map is total time.

# Approach

1. Build graph adjacency list (neighbor, weight).
2. Min-heap \[(0, k)\], distances map = {}.
3. Pop (time, node). If node visited continue. Save distances\[node\] = time.
4. Push unvisited neighbors with time + weight.
5. Return max(distances.values()) if len(distances) == n else -1.

# Naive Solution

Bellman-Ford algorithm relaxing edges N-1 times.

```python filename:Python
class Solution:
    def networkDelayTime(self, times, n, k):
        dist = [float("inf")] * (n + 1)
        dist[k] = 0

        # Relax every edge n - 1 times
        for _ in range(n - 1):
            for u, v, w in times:
                if dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w

        answer = max(dist[1:])

        return answer if answer != float("inf") else -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int networkDelayTime(vector<vector<int>>& times, int n, int k) {
        const int INF = INT_MAX;
        vector<int> dist(n + 1, INF);
        dist[k] = 0;

        // Relax every edge n - 1 times
        for (int i = 0; i < n - 1; i++) {
            for (auto& t : times) {
                int u = t[0], v = t[1], w = t[2];
                if (dist[u] != INF && dist[u] + w < dist[v])
                    dist[v] = dist[u] + w;
            }
        }

        int answer = 0;
        for (int node = 1; node <= n; node++) {
            if (dist[node] == INF) return -1;
            answer = max(answer, dist[node]);
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int networkDelayTime(int[][] times, int n, int k) {
        final int INF = Integer.MAX_VALUE;
        int[] dist = new int[n + 1];
        Arrays.fill(dist, INF);
        dist[k] = 0;

        // Relax every edge n - 1 times
        for (int i = 0; i < n - 1; i++) {
            for (int[] t : times) {
                int u = t[0], v = t[1], w = t[2];
                if (dist[u] != INF && dist[u] + w < dist[v])
                    dist[v] = dist[u] + w;
            }
        }

        int answer = 0;
        for (int node = 1; node <= n; node++) {
            if (dist[node] == INF) return -1;
            answer = Math.max(answer, dist[node]);
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var networkDelayTime = function(times, n, k) {
    const dist = new Array(n + 1).fill(Infinity);
    dist[k] = 0;

    // Relax every edge n - 1 times
    for (let i = 0; i < n - 1; i++) {
        for (const [u, v, w] of times) {
            if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
        }
    }

    let answer = 0;
    for (let node = 1; node <= n; node++) {
        if (dist[node] === Infinity) return -1;
        answer = Math.max(answer, dist[node]);
    }

    return answer;
};
```

<strong>Time: O(V × E) · Aux Space: O(V)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import defaultdict
import heapq

class Solution:
    def networkDelayTime(self, times, n, k):
        graph = defaultdict(list)

        for u, v, w in times:
            graph[u].append((v, w))

        min_heap = [(0, k)]
        distances = {}

        while min_heap:
            time, node = heapq.heappop(min_heap)

            if node in distances:
                continue

            distances[node] = time

            for neighbor, weight in graph[node]:
                if neighbor not in distances:
                    heapq.heappush(
                        min_heap,
                        (time + weight, neighbor)
                    )

        if len(distances) == n:
            return max(distances.values())

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int networkDelayTime(vector<vector<int>>& times, int n, int k) {
        vector<vector<pair<int, int>>> graph(n + 1);

        for (auto& t : times)
            graph[t[0]].push_back({t[1], t[2]});

        // (time, node)
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> minHeap;
        minHeap.push({0, k});

        vector<int> distances(n + 1, -1);
        int reached = 0, answer = 0;

        while (!minHeap.empty()) {
            auto [time, node] = minHeap.top();
            minHeap.pop();

            if (distances[node] != -1) continue;

            distances[node] = time;
            reached++;
            answer = max(answer, time);

            for (auto& [neighbor, weight] : graph[node])
                if (distances[neighbor] == -1)
                    minHeap.push({time + weight, neighbor});
        }

        return reached == n ? answer : -1;
    }
};
```

```java filename:Java
class Solution {
    public int networkDelayTime(int[][] times, int n, int k) {
        List<List<int[]>> graph = new ArrayList<>();
        for (int i = 0; i <= n; i++) graph.add(new ArrayList<>());

        for (int[] t : times)
            graph.get(t[0]).add(new int[]{t[1], t[2]});

        // {time, node}
        PriorityQueue<int[]> minHeap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        minHeap.offer(new int[]{0, k});

        Map<Integer, Integer> distances = new HashMap<>();

        while (!minHeap.isEmpty()) {
            int[] top = minHeap.poll();
            int time = top[0], node = top[1];

            if (distances.containsKey(node)) continue;

            distances.put(node, time);

            for (int[] edge : graph.get(node))
                if (!distances.containsKey(edge[0]))
                    minHeap.offer(new int[]{time + edge[1], edge[0]});
        }

        if (distances.size() == n) return Collections.max(distances.values());

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

var networkDelayTime = function(times, n, k) {
    const graph = Array.from({ length: n + 1 }, () => []);

    for (const [u, v, w] of times)
        graph[u].push([v, w]);

    const minHeap = new MinHeap();
    minHeap.push([0, k]);  // [time, node]

    const distances = new Map();

    while (minHeap.size) {
        const [time, node] = minHeap.pop();

        if (distances.has(node)) continue;

        distances.set(node, time);

        for (const [neighbor, weight] of graph[node])
            if (!distances.has(neighbor))
                minHeap.push([time + weight, neighbor]);
    }

    if (distances.size === n) return Math.max(...distances.values());

    return -1;
};
```

<strong>Time: O(E log V) · Aux Space: O(V + E)</strong>
