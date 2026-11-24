---
id: 91a21367-1ebf-7a44-809f-2952d18bf5fe
key: problem:sheet-150/lc-104
subject: sheet-150
topic: trees
title: Maximum Depth of Binary Tree
slug: maximum-depth-of-binary-tree
order: 3
---

Difficulty: <strong>Easy</strong> · [LeetCode 104](https://leetcode.com/problems/maximum-depth-of-binary-tree/)

# Problem

Given the root of a binary tree, return its maximum depth (number of nodes along longest path from root to furthest leaf).

# Understanding the problem

Max depth at root = 1 + max(depth(root.left), depth(root.right)). Base case for empty node is depth 0.

# Intuition

Level-order traversal (BFS) processes nodes level-by-level using a queue, incrementing depth counter after each level.

# Approach

1. If not root return 0.
2. Initialize queue with root and depth = 0.
3. For each level (loop size of queue): pop node and push non-null children.
4. Increment depth after processing level.

# Naive Solution — DFS

Recursive postorder traversal returning height at each node.

```python filename:Python
class Solution:
    def maxDepth(self, root):
        if not root:
            return 0

        return 1 + max(
            self.maxDepth(root.left),
            self.maxDepth(root.right)
        )
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxDepth(TreeNode* root) {
        if (!root) return 0;

        return 1 + max(maxDepth(root->left), maxDepth(root->right));
    }
};
```

```java filename:Java
class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;

        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}
```

```javascript filename:JavaScript
var maxDepth = function(root) {
    if (!root) return 0;

    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def maxDepth(self, root):
        if not root:
            return 0

        queue = deque([root])
        depth = 0

        while queue:
            for _ in range(len(queue)):
                node = queue.popleft()

                if node.left:
                    queue.append(node.left)

                if node.right:
                    queue.append(node.right)

            depth += 1

        return depth
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxDepth(TreeNode* root) {
        if (!root) return 0;

        queue<TreeNode*> q;
        q.push(root);
        int depth = 0;

        while (!q.empty()) {
            for (int i = q.size(); i > 0; i--) {
                TreeNode* node = q.front();
                q.pop();

                if (node->left) q.push(node->left);
                if (node->right) q.push(node->right);
            }

            depth++;
        }

        return depth;
    }
};
```

```java filename:Java
class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;

        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);
        int depth = 0;

        while (!queue.isEmpty()) {
            for (int i = queue.size(); i > 0; i--) {
                TreeNode node = queue.poll();

                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }

            depth++;
        }

        return depth;
    }
}
```

```javascript filename:JavaScript
var maxDepth = function(root) {
    if (!root) return 0;

    let queue = [root];
    let depth = 0;

    while (queue.length) {
        const next = [];

        for (const node of queue) {
            if (node.left) next.push(node.left);
            if (node.right) next.push(node.right);
        }

        queue = next;
        depth++;
    }

    return depth;
};
```

<strong>Time: O(n) · Aux Space: O(w)</strong>

# Takeaway

Both are optimal in time. Choose DFS when recursion is comfortable; BFS naturally gives the number of levels.
