---
id: a1865264-6da5-733a-898e-233348133362
key: problem:sheet-150/lc-199
subject: sheet-150
topic: trees
title: Binary Tree Right Side View
slug: binary-tree-right-side-view
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 199](https://leetcode.com/problems/binary-tree-right-side-view/)

# Problem

Given root of a binary tree, return values of nodes visible when looking at tree from right side.

# Understanding the problem

We want the rightmost node at each depth level of the binary tree.

# Intuition

BFS level-order traversal taking the last element at index `size - 1` of each level.

# Approach

1. If not root return `[]`.
2. Queue with root.
3. For each level: pop nodes, push children left then right.
4. If \`i == size - 1\`, append node.val to result.

# Naive Solution

DFS right-first and take the first node encountered at every level.

```python filename:Python
class Solution:
    def rightSideView(self, root):
        result = []

        def dfs(node, depth):
            if not node:
                return

            if depth == len(result):
                result.append(node.val)

            dfs(node.right, depth + 1)
            dfs(node.left, depth + 1)

        dfs(root, 0)
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> rightSideView(TreeNode* root) {
        vector<int> result;
        dfs(root, 0, result);
        return result;
    }

private:
    void dfs(TreeNode* node, int depth, vector<int>& result) {
        if (!node) return;

        if (depth == (int)result.size()) result.push_back(node->val);

        dfs(node->right, depth + 1, result);
        dfs(node->left, depth + 1, result);
    }
};
```

```java filename:Java
class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        dfs(root, 0, result);
        return result;
    }

    private void dfs(TreeNode node, int depth, List<Integer> result) {
        if (node == null) return;

        if (depth == result.size()) result.add(node.val);

        dfs(node.right, depth + 1, result);
        dfs(node.left, depth + 1, result);
    }
}
```

```javascript filename:JavaScript
var rightSideView = function(root) {
    const result = [];

    const dfs = (node, depth) => {
        if (!node) return;

        if (depth === result.length) result.push(node.val);

        dfs(node.right, depth + 1);
        dfs(node.left, depth + 1);
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
    def rightSideView(self, root):
        if not root:
            return []

        result = []
        queue = deque([root])

        while queue:
            size = len(queue)

            for i in range(size):
                node = queue.popleft()

                if node.left:
                    queue.append(node.left)

                if node.right:
                    queue.append(node.right)

                if i == size - 1:
                    result.append(node.val)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> rightSideView(TreeNode* root) {
        if (!root) return {};

        vector<int> result;
        queue<TreeNode*> q;
        q.push(root);

        while (!q.empty()) {
            int size = q.size();

            for (int i = 0; i < size; i++) {
                TreeNode* node = q.front();
                q.pop();

                if (node->left) q.push(node->left);
                if (node->right) q.push(node->right);

                if (i == size - 1) result.push_back(node->val);
            }
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        if (root == null) return result;

        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);

        while (!queue.isEmpty()) {
            int size = queue.size();

            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();

                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);

                if (i == size - 1) result.add(node.val);
            }
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var rightSideView = function(root) {
    if (!root) return [];

    const result = [];
    let queue = [root];

    while (queue.length) {
        const size = queue.length;
        const next = [];

        for (let i = 0; i < size; i++) {
            const node = queue[i];

            if (node.left) next.push(node.left);
            if (node.right) next.push(node.right);

            if (i === size - 1) result.push(node.val);
        }

        queue = next;
    }

    return result;
};
```

<strong>Time: O(n) · Aux Space: O(w)</strong>
