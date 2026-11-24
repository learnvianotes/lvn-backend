---
id: ca61f1d3-9e3b-7a70-9cac-7fdad85b4a7f
key: problem:sheet-150/lc-110
subject: sheet-150
topic: trees
title: Balanced Binary Tree
slug: balanced-binary-tree
order: 5
---

Difficulty: <strong>Easy</strong> · [LeetCode 110](https://leetcode.com/problems/balanced-binary-tree/)

# Problem

Given a binary tree, determine if it is height-balanced (left and right subtree heights differ by at most 1 for every node).

# Understanding the problem

A tree is balanced if `abs(height(left) - height(right)) <= 1` for all nodes.

# Intuition

Return -1 immediately when an unbalanced subtree is found.

# Approach

1. Define `dfs(node)`: if node is None return 0.
2. `left = dfs(node.left)`; if `left == -1` return -1.
3. `right = dfs(node.right)`; if `right == -1` return -1.
4. If `abs(left - right) > 1` return -1.
5. Return `1 + max(left, right)`.

# Naive Solution

Repeatedly calculate subtree heights.

```python filename:Python
class Solution:
    def isBalanced(self, root):

        def height(node):
            if not node:
                return 0

            return 1 + max(
                height(node.left),
                height(node.right)
            )

        if not root:
            return True

        left = height(root.left)
        right = height(root.right)

        if abs(left - right) > 1:
            return False

        return (
            self.isBalanced(root.left) and
            self.isBalanced(root.right)
        )
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isBalanced(TreeNode* root) {
        if (!root) return true;

        int left = height(root->left);
        int right = height(root->right);

        if (abs(left - right) > 1) return false;

        return isBalanced(root->left) && isBalanced(root->right);
    }

private:
    int height(TreeNode* node) {
        if (!node) return 0;
        return 1 + max(height(node->left), height(node->right));
    }
};
```

```java filename:Java
class Solution {
    public boolean isBalanced(TreeNode root) {
        if (root == null) return true;

        int left = height(root.left);
        int right = height(root.right);

        if (Math.abs(left - right) > 1) return false;

        return isBalanced(root.left) && isBalanced(root.right);
    }

    private int height(TreeNode node) {
        if (node == null) return 0;
        return 1 + Math.max(height(node.left), height(node.right));
    }
}
```

```javascript filename:JavaScript
var isBalanced = function(root) {
    const height = (node) => {
        if (!node) return 0;
        return 1 + Math.max(height(node.left), height(node.right));
    };

    if (!root) return true;

    const left = height(root.left);
    const right = height(root.right);

    if (Math.abs(left - right) > 1) return false;

    return isBalanced(root.left) && isBalanced(root.right);
};
```

<strong>Time: O(n^2) worst case · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isBalanced(self, root):

        def dfs(node):
            if not node:
                return 0

            left = dfs(node.left)
            if left == -1:
                return -1

            right = dfs(node.right)
            if right == -1:
                return -1

            if abs(left - right) > 1:
                return -1

            return 1 + max(left, right)

        return dfs(root) != -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isBalanced(TreeNode* root) {
        return dfs(root) != -1;
    }

private:
    int dfs(TreeNode* node) {
        if (!node) return 0;

        int left = dfs(node->left);
        if (left == -1) return -1;

        int right = dfs(node->right);
        if (right == -1) return -1;

        if (abs(left - right) > 1) return -1;

        return 1 + max(left, right);
    }
};
```

```java filename:Java
class Solution {
    public boolean isBalanced(TreeNode root) {
        return dfs(root) != -1;
    }

    private int dfs(TreeNode node) {
        if (node == null) return 0;

        int left = dfs(node.left);
        if (left == -1) return -1;

        int right = dfs(node.right);
        if (right == -1) return -1;

        if (Math.abs(left - right) > 1) return -1;

        return 1 + Math.max(left, right);
    }
}
```

```javascript filename:JavaScript
var isBalanced = function(root) {
    const dfs = (node) => {
        if (!node) return 0;

        const left = dfs(node.left);
        if (left === -1) return -1;

        const right = dfs(node.right);
        if (right === -1) return -1;

        if (Math.abs(left - right) > 1) return -1;

        return 1 + Math.max(left, right);
    };

    return dfs(root) !== -1;
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>
