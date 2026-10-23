---
id: 396e0dc9-271a-765e-846e-19d1205cdefb
key: problem:sheet-150/lc-787
subject: sheet-150
topic: advanced-graphs
title: Cheapest Flights Within K Stops
slug: cheapest-flights-within-k-stops
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 787](https://leetcode.com/problems/cheapest-flights-within-k-stops/)

# Problem

Return cheapest price from `src` to `dst` with at most `k` stops. If no path, return -1.

# Understanding the problem

Shortest path with step limit constraint (at most K+1 edges). Ideal for Bellman-Ford algorithm!

# Intuition

Bellman-Ford algorithm run K+1 iterations using a copy of previous distances array.

# Approach

1. Distance array prices = \[inf\] \* n, prices\[src\] = 0.
2. Loop k + 1 times: copy tmp = list(prices). For u, v, w in flights: if prices\[u\] != inf, update tmp\[v\] = min(tmp\[v\], prices\[u\] + w).
3. Set prices = tmp. Return prices\[dst\] if prices\[dst\] != inf else -1.

# Naive Solution

Dijkstra-style search over `(cost, city, flights taken)` that respects the `k`-stop limit but keeps no visited set, so the same city can be expanded many times — correct, but it may explore every route of up to `k + 1` flights.

```python filename:Python
import heapq

class Solution:
    def findCheapestPrice(self, n, flights, src, dst, k):
        graph = [[] for _ in range(n)]

        for u, v, price in flights:
            graph[u].append((v, price))

        # (cost, node, flights taken) - no visited set, so states can repeat
        min_heap = [(0, src, 0)]

        while min_heap:
            cost, node, used = heapq.heappop(min_heap)

            if node == dst:
                return cost

            if used > k:
                continue  # at most k stops = k + 1 flights

            for nxt, price in graph[node]:
                heapq.heappush(min_heap, (cost + price, nxt, used + 1))

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findCheapestPrice(int n, vector<vector<int>>& flights, int src, int dst, int k) {
        vector<vector<pair<int, int>>> graph(n);
        for (auto& f : flights)
            graph[f[0]].push_back({f[1], f[2]});

        // (cost, node, flights taken) - no visited set, so states can repeat
        priority_queue<array<int, 3>, vector<array<int, 3>>, greater<>> minHeap;
        minHeap.push({0, src, 0});

        while (!minHeap.empty()) {
            auto [cost, node, used] = minHeap.top();
            minHeap.pop();

            if (node == dst) return cost;
            if (used > k) continue;  // at most k stops = k + 1 flights

            for (auto& [next, price] : graph[node])
                minHeap.push({cost + price, next, used + 1});
        }

        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
        List<List<int[]>> graph = new ArrayList<>();
        for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
        for (int[] f : flights)
            graph.get(f[0]).add(new int[]{f[1], f[2]});

        // {cost, node, flights taken} - no visited set, so states can repeat
        PriorityQueue<int[]> minHeap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        minHeap.offer(new int[]{0, src, 0});

        while (!minHeap.isEmpty()) {
            int[] top = minHeap.poll();
            int cost = top[0], node = top[1], used = top[2];

            if (node == dst) return cost;
            if (used > k) continue;  // at most k stops = k + 1 flights

            for (int[] edge : graph.get(node))
                minHeap.offer(new int[]{cost + edge[1], edge[0], used + 1});
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

var findCheapestPrice = function(n, flights, src, dst, k) {
    const graph = Array.from({ length: n }, () => []);
    for (const [u, v, price] of flights)
        graph[u].push([v, price]);

    // [cost, node, flights taken] - no visited set, so states can repeat
    const minHeap = new MinHeap();
    minHeap.push([0, src, 0]);

    while (minHeap.size) {
        const [cost, node, used] = minHeap.pop();

        if (node === dst) return cost;
        if (used > k) continue;  // at most k stops = k + 1 flights

        for (const [next, price] of graph[node])
            minHeap.push([cost + price, next, used + 1]);
    }

    return -1;
};
```

<strong>Time: O(d^(k+1) · log) — d = max flights out of a city · Aux Space: O(d^(k+1))</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def findCheapestPrice(self, n, flights, src, dst, k):
        prices = [float("inf")] * n
        prices[src] = 0

        for _ in range(k + 1):
            tmp = list(prices)

            for u, v, price in flights:
                if prices[u] == float("inf"):
                    continue

                if prices[u] + price < tmp[v]:
                    tmp[v] = prices[u] + price

            prices = tmp

        if prices[dst] != float("inf"):
            return prices[dst]

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findCheapestPrice(int n, vector<vector<int>>& flights, int src, int dst, int k) {
        const int INF = INT_MAX;
        vector<int> prices(n, INF);
        prices[src] = 0;

        for (int i = 0; i <= k; i++) {
            vector<int> tmp = prices;

            for (auto& f : flights) {
                int u = f[0], v = f[1], price = f[2];

                if (prices[u] == INF) continue;

                if (prices[u] + price < tmp[v])
                    tmp[v] = prices[u] + price;
            }

            prices = tmp;
        }

        return prices[dst] != INF ? prices[dst] : -1;
    }
};
```

```java filename:Java
class Solution {
    public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
        final int INF = Integer.MAX_VALUE;
        int[] prices = new int[n];
        Arrays.fill(prices, INF);
        prices[src] = 0;

        for (int i = 0; i <= k; i++) {
            int[] tmp = prices.clone();

            for (int[] f : flights) {
                int u = f[0], v = f[1], price = f[2];

                if (prices[u] == INF) continue;

                if (prices[u] + price < tmp[v])
                    tmp[v] = prices[u] + price;
            }

            prices = tmp;
        }

        return prices[dst] != INF ? prices[dst] : -1;
    }
}
```

```javascript filename:JavaScript
var findCheapestPrice = function(n, flights, src, dst, k) {
    let prices = new Array(n).fill(Infinity);
    prices[src] = 0;

    for (let i = 0; i <= k; i++) {
        const tmp = [...prices];

        for (const [u, v, price] of flights) {
            if (prices[u] === Infinity) continue;

            if (prices[u] + price < tmp[v]) tmp[v] = prices[u] + price;
        }

        prices = tmp;
    }

    return prices[dst] !== Infinity ? prices[dst] : -1;
};
```

<strong>Time: O(K × E) · Aux Space: O(V)</strong>
