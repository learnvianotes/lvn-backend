---
id: 53c07b7a-5581-7f47-a747-97d130156461
key: problem:sheet-150/lc-261
subject: sheet-150
topic: graphs
title: Graph Valid Tree
slug: graph-valid-tree
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 261](https://leetcode.com/problems/graph-valid-tree/)

# Problem

Determine if an undirected graph of n nodes is a valid tree.

# Understanding the problem

A tree must have exactly n-1 edges and be fully connected with no cycles.

# Intuition

Union-Find with path compression and rank optimization.

# Approach

1. If len(edges) != n-1 return False.
2. Initialize parent array \[0..n-1\].
3. Union endpoints of each edge; if find(a) == find(b), cycle detected → return False.
4. Return True.

# Naive Solution

DFS cycle and connectivity check.

```python filename:Python
class Solution:
    def validTree(self, n, edges):
        if len(edges) != n - 1:
            return False

        graph = [[] for _ in range(n)]

        for a, b in edges:
            graph[a].append(b)
            graph[b].append(a)

        visited = set()

        def dfs(node, parent):
            if node in visited:
                return False

            visited.add(node)

            for neighbor in graph[node]:
                if neighbor == parent:
                    continue

                if not dfs(neighbor, node):
                    return False

            return True

        return dfs(0, -1) and len(visited) == n
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool validTree(int n, vector<vector<int>>& edges) {
        if ((int)edges.size() != n - 1) return false;

        vector<vector<int>> graph(n);

        for (auto& e : edges) {
            graph[e[0]].push_back(e[1]);
            graph[e[1]].push_back(e[0]);
        }

        vector<bool> visited(n, false);
        int count = 0;

        function<bool(int, int)> dfs = [&](int node, int parent) -> bool {
            if (visited[node]) return false;

            visited[node] = true;
            count++;

            for (int neighbor : graph[node]) {
                if (neighbor == parent) continue;
                if (!dfs(neighbor, node)) return false;
            }

            return true;
        };

        return dfs(0, -1) && count == n;
    }
};
```

```java filename:Java
class Solution {
    private List<List<Integer>> graph = new ArrayList<>();
    private boolean[] visited;
    private int count = 0;

    public boolean validTree(int n, int[][] edges) {
        if (edges.length != n - 1) return false;

        for (int i = 0; i < n; i++) graph.add(new ArrayList<>());

        for (int[] e : edges) {
            graph.get(e[0]).add(e[1]);
            graph.get(e[1]).add(e[0]);
        }

        visited = new boolean[n];

        return dfs(0, -1) && count == n;
    }

    private boolean dfs(int node, int parent) {
        if (visited[node]) return false;

        visited[node] = true;
        count++;

        for (int neighbor : graph.get(node)) {
            if (neighbor == parent) continue;
            if (!dfs(neighbor, node)) return false;
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var validTree = function(n, edges) {
    if (edges.length !== n - 1) return false;

    const graph = Array.from({ length: n }, () => []);

    for (const [a, b] of edges) {
        graph[a].push(b);
        graph[b].push(a);
    }

    const visited = new Set();

    const dfs = (node, parent) => {
        if (visited.has(node)) return false;

        visited.add(node);

        for (const neighbor of graph[node]) {
            if (neighbor === parent) continue;
            if (!dfs(neighbor, node)) return false;
        }

        return true;
    };

    return dfs(0, -1) && visited.size === n;
};
```

<strong>Time: O(V + E) · Aux Space: O(V + E)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def validTree(self, n, edges):
        if len(edges) != n - 1:
            return False

        parent = list(range(n))
        rank = [1] * n

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

        for a, b in edges:
            if not union(a, b):
                return False

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool validTree(int n, vector<vector<int>>& edges) {
        if ((int)edges.size() != n - 1) return false;

        vector<int> parent(n), rank(n, 1);
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
            if (!unite(e[0], e[1])) return false;

        return true;
    }
};
```

```java filename:Java
class Solution {
    private int[] parent, rank;

    public boolean validTree(int n, int[][] edges) {
        if (edges.length != n - 1) return false;

        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            rank[i] = 1;
        }

        for (int[] e : edges)
            if (!union(e[0], e[1])) return false;

        return true;
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
var validTree = function(n, edges) {
    if (edges.length !== n - 1) return false;

    const parent = Array.from({ length: n }, (_, i) => i);
    const rank = new Array(n).fill(1);

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

    for (const [a, b] of edges)
        if (!union(a, b)) return false;

    return true;
};
```

<strong>Time: O(E α(V)) · Aux Space: O(V)</strong>
