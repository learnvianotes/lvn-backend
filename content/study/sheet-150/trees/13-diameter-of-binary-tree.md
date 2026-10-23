---
id: 8358ecd9-bd59-78b0-8395-c2a3b2be10f2
key: problem:sheet-150/lc-543
subject: sheet-150
topic: trees
title: Diameter of Binary Tree
slug: diameter-of-binary-tree
order: 13
---

Difficulty: <strong>Easy</strong> · [LeetCode 543](https://leetcode.com/problems/diameter-of-binary-tree/)

# Problem

Given the root of a binary tree, return the length of the diameter of the tree (longest path between any two nodes).

# Understanding the problem

The longest path passing through node u is `left_height + right_height`. The overall diameter is the max of this value across all nodes.

# Intuition

Calculate height and diameter in the same bottom-up DFS traversal.

# Approach

1. Initialize `diameter = 0`.
2. Define `dfs(node)`: if node is None return 0.
3. Get `left = dfs(node.left)` and `right = dfs(node.right)`.
4. Update `diameter = max(diameter, left + right)`.
5. Return node height: `1 + max(left, right)`.

# Naive Solution

For every node, separately calculate the height of its left and right subtree.

```python filename:Python
class Solution:
    def diameterOfBinaryTree(self, root):

        def height(node):
            if not node:
                return 0

            return 1 + max(
                height(node.left),
                height(node.right)
            )

        if not root:
            return 0

        left_diameter = self.diameterOfBinaryTree(root.left)
        right_diameter = self.diameterOfBinaryTree(root.right)

        current = height(root.left) + height(root.right)

        return max(current, left_diameter, right_diameter)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int diameterOfBinaryTree(TreeNode* root) {
        if (!root) return 0;

        int leftDiameter = diameterOfBinaryTree(root->left);
        int rightDiameter = diameterOfBinaryTree(root->right);

        int current = height(root->left) + height(root->right);

        return max({current, leftDiameter, rightDiameter});
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
    public int diameterOfBinaryTree(TreeNode root) {
        if (root == null) return 0;

        int leftDiameter = diameterOfBinaryTree(root.left);
        int rightDiameter = diameterOfBinaryTree(root.right);

        int current = height(root.left) + height(root.right);

        return Math.max(current, Math.max(leftDiameter, rightDiameter));
    }

    private int height(TreeNode node) {
        if (node == null) return 0;
        return 1 + Math.max(height(node.left), height(node.right));
    }
}
```

```javascript filename:JavaScript
var diameterOfBinaryTree = function(root) {
    const height = (node) => {
        if (!node) return 0;
        return 1 + Math.max(height(node.left), height(node.right));
    };

    if (!root) return 0;

    const leftDiameter = diameterOfBinaryTree(root.left);
    const rightDiameter = diameterOfBinaryTree(root.right);

    const current = height(root.left) + height(root.right);

    return Math.max(current, leftDiameter, rightDiameter);
};
```

<strong>Time: O(n^2) worst case · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def diameterOfBinaryTree(self, root):
        diameter = 0

        def dfs(node):
            nonlocal diameter

            if not node:
                return 0

            left = dfs(node.left)
            right = dfs(node.right)

            diameter = max(diameter, left + right)

            return 1 + max(left, right)

        dfs(root)
        return diameter
```

```cpp filename:C%2B%2B
class Solution {
public:
    int diameterOfBinaryTree(TreeNode* root) {
        int diameter = 0;
        dfs(root, diameter);
        return diameter;
    }

private:
    int dfs(TreeNode* node, int& diameter) {
        if (!node) return 0;

        int left = dfs(node->left, diameter);
        int right = dfs(node->right, diameter);

        diameter = max(diameter, left + right);

        return 1 + max(left, right);
    }
};
```

```java filename:Java
class Solution {
    private int diameter = 0;

    public int diameterOfBinaryTree(TreeNode root) {
        diameter = 0;
        dfs(root);
        return diameter;
    }

    private int dfs(TreeNode node) {
        if (node == null) return 0;

        int left = dfs(node.left);
        int right = dfs(node.right);

        diameter = Math.max(diameter, left + right);

        return 1 + Math.max(left, right);
    }
}
```

```javascript filename:JavaScript
var diameterOfBinaryTree = function(root) {
    let diameter = 0;

    const dfs = (node) => {
        if (!node) return 0;

        const left = dfs(node.left);
        const right = dfs(node.right);

        diameter = Math.max(diameter, left + right);

        return 1 + Math.max(left, right);
    };

    dfs(root);
    return diameter;
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>

# Takeaway

<strong>Pattern:</strong> Postorder DFS + return useful information upward. This pattern is extremely important.
