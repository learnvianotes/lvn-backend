---
id: 82be6509-cd70-72eb-a6fc-21fefe0b9527
key: problem:sheet-150/lc-133
subject: sheet-150
topic: graphs
title: Clone Graph
slug: clone-graph
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 133](https://leetcode.com/problems/clone-graph/)

# Problem

Given reference of node in connected undirected graph, return deep copy (clone) of graph.

# Understanding the problem

Map original nodes to new cloned node instances using a map/dictionary to handle cycles and shared neighbors.

# Intuition

BFS iterative cloning with queue and map prevents stack overflow on deep graphs.

# Approach

1. If node is None return None.
2. Create clones dictionary and queue with root node.
3. While queue: pop current, iterate neighbors, clone unvisited neighbors, push to queue, and link cloned neighbors.

# Naive Solution

DFS recursive cloning with map.

```python filename:Python
class Solution:
    def cloneGraph(self, node):
        if not node:
            return None

        visited = {}

        def dfs(original):
            if original in visited:
                return visited[original]

            clone = Node(original.val)
            visited[original] = clone

            for neighbor in original.neighbors:
                clone.neighbors.append(
                    dfs(neighbor)
                )

            return clone

        return dfs(node)
```

```cpp filename:C%2B%2B
class Solution {
public:
    Node* cloneGraph(Node* node) {
        if (!node) return nullptr;

        unordered_map<Node*, Node*> visited;

        function<Node*(Node*)> dfs = [&](Node* original) -> Node* {
            if (visited.count(original)) return visited[original];

            Node* clone = new Node(original->val);
            visited[original] = clone;

            for (Node* neighbor : original->neighbors)
                clone->neighbors.push_back(dfs(neighbor));

            return clone;
        };

        return dfs(node);
    }
};
```

```java filename:Java
class Solution {
    private Map<Node, Node> visited = new HashMap<>();

    public Node cloneGraph(Node node) {
        if (node == null) return null;
        return dfs(node);
    }

    private Node dfs(Node original) {
        if (visited.containsKey(original)) return visited.get(original);

        Node clone = new Node(original.val);
        visited.put(original, clone);

        for (Node neighbor : original.neighbors)
            clone.neighbors.add(dfs(neighbor));

        return clone;
    }
}
```

```javascript filename:JavaScript
var cloneGraph = function(node) {
    if (!node) return null;

    const visited = new Map();

    const dfs = (original) => {
        if (visited.has(original)) return visited.get(original);

        const clone = new _Node(original.val);
        visited.set(original, clone);

        for (const neighbor of original.neighbors) {
            clone.neighbors.push(dfs(neighbor));
        }

        return clone;
    };

    return dfs(node);
};
```

<strong>Time: O(V + E) · Aux Space: O(V)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def cloneGraph(self, node):
        if not node:
            return None

        clones = {
            node: Node(node.val)
        }

        queue = deque([node])

        while queue:
            current = queue.popleft()

            for neighbor in current.neighbors:
                if neighbor not in clones:
                    clones[neighbor] = Node(neighbor.val)
                    queue.append(neighbor)

                clones[current].neighbors.append(
                    clones[neighbor]
                )

        return clones[node]
```

```cpp filename:C%2B%2B
class Solution {
public:
    Node* cloneGraph(Node* node) {
        if (!node) return nullptr;

        unordered_map<Node*, Node*> clones;
        clones[node] = new Node(node->val);

        queue<Node*> q;
        q.push(node);

        while (!q.empty()) {
            Node* current = q.front();
            q.pop();

            for (Node* neighbor : current->neighbors) {
                if (!clones.count(neighbor)) {
                    clones[neighbor] = new Node(neighbor->val);
                    q.push(neighbor);
                }

                clones[current]->neighbors.push_back(clones[neighbor]);
            }
        }

        return clones[node];
    }
};
```

```java filename:Java
class Solution {
    public Node cloneGraph(Node node) {
        if (node == null) return null;

        Map<Node, Node> clones = new HashMap<>();
        clones.put(node, new Node(node.val));

        Deque<Node> queue = new ArrayDeque<>();
        queue.offer(node);

        while (!queue.isEmpty()) {
            Node current = queue.poll();

            for (Node neighbor : current.neighbors) {
                if (!clones.containsKey(neighbor)) {
                    clones.put(neighbor, new Node(neighbor.val));
                    queue.offer(neighbor);
                }

                clones.get(current).neighbors.add(clones.get(neighbor));
            }
        }

        return clones.get(node);
    }
}
```

```javascript filename:JavaScript
var cloneGraph = function(node) {
    if (!node) return null;

    const clones = new Map([[node, new _Node(node.val)]]);

    const queue = [node];
    let head = 0;

    while (head < queue.length) {
        const current = queue[head++];

        for (const neighbor of current.neighbors) {
            if (!clones.has(neighbor)) {
                clones.set(neighbor, new _Node(neighbor.val));
                queue.push(neighbor);
            }

            clones.get(current).neighbors.push(clones.get(neighbor));
        }
    }

    return clones.get(node);
};
```

<strong>Time: O(V + E) · Aux Space: O(V)</strong>
