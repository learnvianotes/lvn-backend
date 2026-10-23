---
id: e6f1eafd-bdbe-7cae-a8a5-530b55858034
key: problem:sheet-150/lc-323
subject: sheet-150
topic: graphs
title: Number of Connected Components
slug: number-of-connected-components
order: 9
---

Difficulty: <strong>Medium</strong> · [LeetCode 323](https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/)

# Problem

Given n nodes and edges list, return number of connected components.

# Understanding the problem

Start with n components and decrement by 1 on every successful union of disjoint sets.

# Intuition

Union-Find tracking component count (`components -= 1` on successful union).

# Approach

1. Initialize parent = list(range(n)) and components = n.
2. For each edge (a, b), call union. If merged, decrement components.
3. Return components count.

# Naive Solution

DFS component counting.

```python filename:Python
class Solution:
    def countComponents(self, n, edges):
        graph = [[] for _ in range(n)]

        for a, b in edges:
            graph[a].append(b)
            graph[b].append(a)

        visited = [False] * n

        def dfs(node):
            visited[node] = True

            for neighbor in graph[node]:
                if not visited[neighbor]:
                    dfs(neighbor)

        components = 0

        for node in range(n):
            if not visited[node]:
                components += 1
                dfs(node)

        return components
```

```cpp filename:C%2B%2B
class Solution {
public:
    int countComponents(int n, vector<vector<int>>& edges) {
        vector<vector<int>> graph(n);

        for (auto& e : edges) {
            graph[e[0]].push_back(e[1]);
            graph[e[1]].push_back(e[0]);
        }

        vector<bool> visited(n, false);

        function<void(int)> dfs = [&](int node) {
            visited[node] = true;

            for (int neighbor : graph[node])
                if (!visited[neighbor]) dfs(neighbor);
        };

        int components = 0;

        for (int node = 0; node < n; node++) {
            if (!visited[node]) {
                components++;
                dfs(node);
            }
        }

        return components;
    }
};
```

```java filename:Java
class Solution {
    private List<List<Integer>> graph = new ArrayList<>();
    private boolean[] visited;

    public int countComponents(int n, int[][] edges) {
        for (int i = 0; i < n; i++) graph.add(new ArrayList<>());

        for (int[] e : edges) {
            graph.get(e[0]).add(e[1]);
            graph.get(e[1]).add(e[0]);
        }

        visited = new boolean[n];
        int components = 0;

        for (int node = 0; node < n; node++) {
            if (!visited[node]) {
                components++;
                dfs(node);
            }
        }

        return components;
    }

    private void dfs(int node) {
        visited[node] = true;

        for (int neighbor : graph.get(node))
            if (!visited[neighbor]) dfs(neighbor);
    }
}
```

```javascript filename:JavaScript
var countComponents = function(n, edges) {
    const graph = Array.from({ length: n }, () => []);

    for (const [a, b] of edges) {
        graph[a].push(b);
        graph[b].push(a);
    }

    const visited = new Array(n).fill(false);

    const dfs = (node) => {
        visited[node] = true;

        for (const neighbor of graph[node])
            if (!visited[neighbor]) dfs(neighbor);
    };

    let components = 0;

    for (let node = 0; node < n; node++) {
        if (!visited[node]) {
            components++;
            dfs(node);
        }
    }

    return components;
};
```

<strong>Time: O(V + E) · Aux Space: O(V + E)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def countComponents(self, n, edges):
        parent = list(range(n))
        rank = [1] * n
        components = n

        def find(x):
            while x != parent[x]:
                parent[x] = parent[parent[x]]
                x = parent[x]

            return x

        def union(a, b):
            nonlocal components

            root_a = find(a)
            root_b = find(b)

            if root_a == root_b:
                return

            if rank[root_a] < rank[root_b]:
                root_a, root_b = root_b, root_a

            parent[root_b] = root_a
            rank[root_a] += rank[root_b]

            components -= 1

        for a, b in edges:
            union(a, b)

        return components
```

```cpp filename:C%2B%2B
class Solution {
public:
    int countComponents(int n, vector<vector<int>>& edges) {
        vector<int> parent(n), rank(n, 1);
        iota(parent.begin(), parent.end(), 0);
        int components = n;

        auto find = [&](int x) {
            while (x != parent[x]) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        };

        auto unite = [&](int a, int b) {
            int rootA = find(a), rootB = find(b);

            if (rootA == rootB) return;

            if (rank[rootA] < rank[rootB]) swap(rootA, rootB);

            parent[rootB] = rootA;
            rank[rootA] += rank[rootB];

            components--;
        };

        for (auto& e : edges) unite(e[0], e[1]);

        return components;
    }
};
```

```java filename:Java
class Solution {
    private int[] parent, rank;
    private int components;

    public int countComponents(int n, int[][] edges) {
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            rank[i] = 1;
        }
        components = n;

        for (int[] e : edges) union(e[0], e[1]);

        return components;
    }

    private int find(int x) {
        while (x != parent[x]) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    private void union(int a, int b) {
        int rootA = find(a), rootB = find(b);

        if (rootA == rootB) return;

        if (rank[rootA] < rank[rootB]) {
            int tmp = rootA; rootA = rootB; rootB = tmp;
        }

        parent[rootB] = rootA;
        rank[rootA] += rank[rootB];

        components--;
    }
}
```

```javascript filename:JavaScript
var countComponents = function(n, edges) {
    const parent = Array.from({ length: n }, (_, i) => i);
    const rank = new Array(n).fill(1);
    let components = n;

    const find = (x) => {
        while (x !== parent[x]) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    const union = (a, b) => {
        let rootA = find(a), rootB = find(b);

        if (rootA === rootB) return;

        if (rank[rootA] < rank[rootB]) [rootA, rootB] = [rootB, rootA];

        parent[rootB] = rootA;
        rank[rootA] += rank[rootB];

        components--;
    };

    for (const [a, b] of edges) union(a, b);

    return components;
};
```

<strong>Time: O(E α(V)) · Aux Space: O(V)</strong>
