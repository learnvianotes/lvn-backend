---
id: 89ef20ca-6519-7b72-a2b6-f3de9604c100
key: problem:sheet-150/lc-226
subject: sheet-150
topic: trees
title: Invert Binary Tree
slug: invert-binary-tree
order: 9
---

Difficulty: <strong>Easy</strong> · [LeetCode 226](https://leetcode.com/problems/invert-binary-tree/)

# Problem

Given the root of a binary tree, invert the tree, and return its root (swap left and right subtrees recursively).

# Understanding the problem

Inverting a tree means swapping every left child with its corresponding right child at every node in the tree.

# Intuition

Iterative BFS avoids recursion depth issues on deep skewed trees.

# Approach

1. If root is None return None.
2. Push root into BFS queue.
3. While queue: pop node, swap `node.left, node.right = node.right, node.left`.
4. Push left and right children into queue if they exist.

# Naive Solution — Recursive Swap

Recursively swap the left and right children.

```python filename:Python
class Solution:
    def invertTree(self, root):
        if not root:
            return None

        left = self.invertTree(root.left)
        right = self.invertTree(root.right)

        root.left = right
        root.right = left

        return root
```

```cpp filename:C%2B%2B
class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        if (!root) return nullptr;

        TreeNode* left = invertTree(root->left);
        TreeNode* right = invertTree(root->right);

        root->left = right;
        root->right = left;

        return root;
    }
};
```

```java filename:Java
class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null;

        TreeNode left = invertTree(root.left);
        TreeNode right = invertTree(root.right);

        root.left = right;
        root.right = left;

        return root;
    }
}
```

```javascript filename:JavaScript
var invertTree = function(root) {
    if (!root) return null;

    const left = invertTree(root.left);
    const right = invertTree(root.right);

    root.left = right;
    root.right = left;

    return root;
};
```

<strong>Time: O(n) · Aux Space: O(h) · Output Space: O(n) for tree</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def invertTree(self, root):
        if not root:
            return None

        queue = deque([root])

        while queue:
            node = queue.popleft()

            node.left, node.right = node.right, node.left

            if node.left:
                queue.append(node.left)

            if node.right:
                queue.append(node.right)

        return root
```

```cpp filename:C%2B%2B
class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        if (!root) return nullptr;

        queue<TreeNode*> q;
        q.push(root);

        while (!q.empty()) {
            TreeNode* node = q.front();
            q.pop();

            swap(node->left, node->right);

            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }

        return root;
    }
};
```

```java filename:Java
class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null;

        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);

        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();

            TreeNode temp = node.left;
            node.left = node.right;
            node.right = temp;

            if (node.left != null) queue.offer(node.left);
            if (node.right != null) queue.offer(node.right);
        }

        return root;
    }
}
```

```javascript filename:JavaScript
var invertTree = function(root) {
    if (!root) return null;

    const queue = [root];
    let head = 0;

    while (head < queue.length) {
        const node = queue[head++];

        [node.left, node.right] = [node.right, node.left];

        if (node.left) queue.push(node.left);
        if (node.right) queue.push(node.right);
    }

    return root;
};
```

<strong>Time: O(n) · Aux Space: O(w)</strong>
