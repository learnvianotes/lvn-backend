---
id: b26c7564-3216-7a33-b89e-47c84a159cfe
key: problem:sheet-150/lc-684
subject: sheet-150
topic: graphs
title: Redundant Connection
slug: redundant-connection
order: 11
---

Difficulty: <strong>Medium</strong> · [LeetCode 684](https://leetcode.com/problems/redundant-connection/)

# Problem

Return edge that can be removed so graph becomes a valid tree. If multiple, return edge that appears last in input.

# Understanding the problem

An edge is redundant if its endpoints are ALREADY connected in the Union-Find structure.

# Intuition

Union-Find returning first edge where `find(u) == find(v)`.

# Approach

1. Initialize parent = list(range(n + 1)).
2. Loop edges (u, v). If find(u) == find(v), return \[u, v\]. Else union(u, v).

# Naive Solution

DFS cycle check after adding each edge.

```python filename:Python
class Solution:
    def findRedundantConnection(self, edges):
        n = len(edges)
        graph = [[] for _ in range(n + 1)]

        # Is there already a path from u to v?
        def connected(u, v, visited):
            if u == v:
                return True

            visited.add(u)

            for nxt in graph[u]:
                if nxt not in visited and connected(nxt, v, visited):
                    return True

            return False

        for u, v in edges:
            if connected(u, v, set()):
                return [u, v]  # this edge closes a cycle

            graph[u].append(v)
            graph[v].append(u)

        return []
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> findRedundantConnection(vector<vector<int>>& edges) {
        int n = edges.size();
        vector<vector<int>> graph(n + 1);
        vector<bool> visited;

        // Is there already a path from u to v?
        function<bool(int, int)> connected = [&](int u, int v) -> bool {
            if (u == v) return true;

            visited[u] = true;

            for (int next : graph[u])
                if (!visited[next] && connected(next, v)) return true;

            return false;
        };

        for (auto& e : edges) {
            int u = e[0], v = e[1];

            visited.assign(n + 1, false);

            if (connected(u, v)) return {u, v};  // this edge closes a cycle

            graph[u].push_back(v);
            graph[v].push_back(u);
        }

        return {};
    }
};
```

```java filename:Java
class Solution {
    private List<List<Integer>> graph = new ArrayList<>();
    private boolean[] visited;

    public int[] findRedundantConnection(int[][] edges) {
        int n = edges.length;
        for (int i = 0; i <= n; i++) graph.add(new ArrayList<>());

        for (int[] e : edges) {
            int u = e[0], v = e[1];

            visited = new boolean[n + 1];

            if (connected(u, v)) return new int[]{u, v};  // this edge closes a cycle

            graph.get(u).add(v);
            graph.get(v).add(u);
        }

        return new int[0];
    }

    // Is there already a path from u to v?
    private boolean connected(int u, int v) {
        if (u == v) return true;

        visited[u] = true;

        for (int next : graph.get(u))
            if (!visited[next] && connected(next, v)) return true;

        return false;
    }
}
```

```javascript filename:JavaScript
var findRedundantConnection = function(edges) {
    const n = edges.length;
    const graph = Array.from({ length: n + 1 }, () => []);
    let visited;

    // Is there already a path from u to v?
    const connected = (u, v) => {
        if (u === v) return true;

        visited[u] = true;

        for (const next of graph[u])
            if (!visited[next] && connected(next, v)) return true;

        return false;
    };

    for (const [u, v] of edges) {
        visited = new Array(n + 1).fill(false);

        if (connected(u, v)) return [u, v];  // this edge closes a cycle

        graph[u].push(v);
        graph[v].push(u);
    }

    return [];
};
```

<strong>Time: O(V^2) · Aux Space: O(V)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def findRedundantConnection(self, edges):
        n = len(edges)
        parent = list(range(n + 1))
        rank = [1] * (n + 1)

        def find(x):
            while x != parent[x]:
                parent[x] = parent[parent[x]]
                x = parent[x]

            return x

        def union(a, b):
            root_a = find(a)
            root_b = find(b)

            if root_a == root_b:
                return False

            if rank[root_a] < rank[root_b]:
                root_a, root_b = root_b, root_a

            parent[root_b] = root_a
            rank[root_a] += rank[root_b]

            return True

        for u, v in edges:
            if not union(u, v):
                return [u, v]

        return []
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> findRedundantConnection(vector<vector<int>>& edges) {
        int n = edges.size();
        vector<int> parent(n + 1), rank(n + 1, 1);
        iota(parent.begin(), parent.end(), 0);

        auto find = [&](int x) {
            while (x != parent[x]) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        };

        auto unite = [&](int a, int b) {
            int rootA = find(a), rootB = find(b);

            if (rootA == rootB) return false;

            if (rank[rootA] < rank[rootB]) swap(rootA, rootB);

            parent[rootB] = rootA;
            rank[rootA] += rank[rootB];

            return true;
        };

        for (auto& e : edges)
            if (!unite(e[0], e[1])) return {e[0], e[1]};

        return {};
    }
};
```

```java filename:Java
class Solution {
    private int[] parent, rank;

    public int[] findRedundantConnection(int[][] edges) {
        int n = edges.length;
        parent = new int[n + 1];
        rank = new int[n + 1];
        for (int i = 0; i <= n; i++) {
            parent[i] = i;
            rank[i] = 1;
        }

        for (int[] e : edges)
            if (!union(e[0], e[1])) return new int[]{e[0], e[1]};

        return new int[0];
    }

    private int find(int x) {
        while (x != parent[x]) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    private boolean union(int a, int b) {
        int rootA = find(a), rootB = find(b);

        if (rootA == rootB) return false;

        if (rank[rootA] < rank[rootB]) {
            int tmp = rootA; rootA = rootB; rootB = tmp;
        }

        parent[rootB] = rootA;
        rank[rootA] += rank[rootB];

        return true;
    }
}
```

```javascript filename:JavaScript
var findRedundantConnection = function(edges) {
    const n = edges.length;
    const parent = Array.from({ length: n + 1 }, (_, i) => i);
    const rank = new Array(n + 1).fill(1);

    const find = (x) => {
        while (x !== parent[x]) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    const union = (a, b) => {
        let rootA = find(a), rootB = find(b);

        if (rootA === rootB) return false;

        if (rank[rootA] < rank[rootB]) [rootA, rootB] = [rootB, rootA];

        parent[rootB] = rootA;
        rank[rootA] += rank[rootB];

        return true;
    };

    for (const [u, v] of edges)
        if (!union(u, v)) return [u, v];

    return [];
};
```

<strong>Time: O(N α(N)) · Aux Space: O(N)</strong>
