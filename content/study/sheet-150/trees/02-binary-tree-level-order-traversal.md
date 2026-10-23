---
id: 68cb5286-4f74-7b3d-bedf-c5123a159e36
key: problem:sheet-150/lc-102
subject: sheet-150
topic: trees
title: Binary Tree Level Order Traversal
slug: binary-tree-level-order-traversal
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 102](https://leetcode.com/problems/binary-tree-level-order-traversal/)

# Problem

Given root of a binary tree, return level order traversal of its nodes' values (level by level, left to right).

# Understanding the problem

Process nodes level by level using BFS or DFS with depth indexing.

# Intuition

Iterative BFS using a double-ended queue (deque) natural level-by-level processing.

# Approach

1. If not root return `[]`.
2. Push root into deque.
3. While queue: iterate level size, popleft node, append to level list, push children.
4. Append level list to result.

# Naive Solution

DFS while storing the level index.

```python filename:Python
class Solution:
    def levelOrder(self, root):
        result = []

        def dfs(node, level):
            if not node:
                return

            if level == len(result):
                result.append([])

            result[level].append(node.val)

            dfs(node.left, level + 1)
            dfs(node.right, level + 1)

        dfs(root, 0)
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        vector<vector<int>> result;
        dfs(root, 0, result);
        return result;
    }

private:
    void dfs(TreeNode* node, int level, vector<vector<int>>& result) {
        if (!node) return;

        if (level == (int)result.size()) result.push_back({});

        result[level].push_back(node->val);

        dfs(node->left, level + 1, result);
        dfs(node->right, level + 1, result);
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        dfs(root, 0, result);
        return result;
    }

    private void dfs(TreeNode node, int level, List<List<Integer>> result) {
        if (node == null) return;

        if (level == result.size()) result.add(new ArrayList<>());

        result.get(level).add(node.val);

        dfs(node.left, level + 1, result);
        dfs(node.right, level + 1, result);
    }
}
```

```javascript filename:JavaScript
var levelOrder = function(root) {
    const result = [];

    const dfs = (node, level) => {
        if (!node) return;

        if (level === result.length) result.push([]);

        result[level].push(node.val);

        dfs(node.left, level + 1);
        dfs(node.right, level + 1);
    };

    dfs(root, 0);
    return result;
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def levelOrder(self, root):
        if not root:
            return []

        result = []
        queue = deque([root])

        while queue:
            level = []

            for _ in range(len(queue)):
                node = queue.popleft()
                level.append(node.val)

                if node.left:
                    queue.append(node.left)

                if node.right:
                    queue.append(node.right)

            result.append(level)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        if (!root) return {};

        vector<vector<int>> result;
        queue<TreeNode*> q;
        q.push(root);

        while (!q.empty()) {
            vector<int> level;

            for (int i = q.size(); i > 0; i--) {
                TreeNode* node = q.front();
                q.pop();
                level.push_back(node->val);

                if (node->left) q.push(node->left);
                if (node->right) q.push(node->right);
            }

            result.push_back(level);
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        if (root == null) return result;

        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);

        while (!queue.isEmpty()) {
            List<Integer> level = new ArrayList<>();

            for (int i = queue.size(); i > 0; i--) {
                TreeNode node = queue.poll();
                level.add(node.val);

                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }

            result.add(level);
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var levelOrder = function(root) {
    if (!root) return [];

    const result = [];
    let queue = [root];

    while (queue.length) {
        const level = [];
        const next = [];

        for (const node of queue) {
            level.push(node.val);

            if (node.left) next.push(node.left);
            if (node.right) next.push(node.right);
        }

        result.push(level);
        queue = next;
    }

    return result;
};
```

<strong>Time: O(n) · Aux Space: O(w) · Output Space: O(n)</strong>
