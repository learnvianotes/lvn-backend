---
id: 73c32941-1ad2-7e39-a04a-c8ed3764bf2e
key: problem:sheet-150/lc-98
subject: sheet-150
topic: trees
title: Validate Binary Search Tree
slug: validate-binary-search-tree
order: 15
---

Difficulty: <strong>Medium</strong> · [LeetCode 98](https://leetcode.com/problems/validate-binary-search-tree/)

# Problem

Given root of a binary tree, determine if it is a valid Binary Search Tree (BST).

# Understanding the problem

For every node, all left descendants must be strictly smaller, and all right descendants must be strictly larger.

# Intuition

Pass valid lower and upper bounds `(low, high)` down during DFS traversal.

# Approach

1. Define `dfs(node, low, high)`.
2. If node is None return True.
3. If not `(low < node.val < high)` return False.
4. Recurse `dfs(node.left, low, node.val)` and `dfs(node.right, node.val, high)`.

# Naive Solution

For every node, calculate max of left subtree and min of right subtree.

```python filename:Python
class Solution:
    def isValidBST(self, root):

        def min_value(node):
            if not node:
                return float("inf")
            return min(
                node.val,
                min_value(node.left),
                min_value(node.right)
            )

        def max_value(node):
            if not node:
                return -float("inf")
            return max(
                node.val,
                max_value(node.left),
                max_value(node.right)
            )

        def check(node):
            if not node:
                return True

            left_max = max_value(node.left)
            right_min = min_value(node.right)

            if node.val <= left_max or node.val >= right_min:
                return False

            return check(node.left) and check(node.right)

        return check(root)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isValidBST(TreeNode* root) {
        return check(root);
    }

private:
    long long minValue(TreeNode* node) {
        if (!node) return LLONG_MAX;
        return min({(long long)node->val, minValue(node->left), minValue(node->right)});
    }

    long long maxValue(TreeNode* node) {
        if (!node) return LLONG_MIN;
        return max({(long long)node->val, maxValue(node->left), maxValue(node->right)});
    }

    bool check(TreeNode* node) {
        if (!node) return true;

        long long leftMax = maxValue(node->left);
        long long rightMin = minValue(node->right);

        if (node->val <= leftMax || node->val >= rightMin) return false;

        return check(node->left) && check(node->right);
    }
};
```

```java filename:Java
class Solution {
    public boolean isValidBST(TreeNode root) {
        return check(root);
    }

    private long minValue(TreeNode node) {
        if (node == null) return Long.MAX_VALUE;
        return Math.min(node.val, Math.min(minValue(node.left), minValue(node.right)));
    }

    private long maxValue(TreeNode node) {
        if (node == null) return Long.MIN_VALUE;
        return Math.max(node.val, Math.max(maxValue(node.left), maxValue(node.right)));
    }

    private boolean check(TreeNode node) {
        if (node == null) return true;

        long leftMax = maxValue(node.left);
        long rightMin = minValue(node.right);

        if (node.val <= leftMax || node.val >= rightMin) return false;

        return check(node.left) && check(node.right);
    }
}
```

```javascript filename:JavaScript
var isValidBST = function(root) {
    const minValue = (node) => {
        if (!node) return Infinity;
        return Math.min(node.val, minValue(node.left), minValue(node.right));
    };

    const maxValue = (node) => {
        if (!node) return -Infinity;
        return Math.max(node.val, maxValue(node.left), maxValue(node.right));
    };

    const check = (node) => {
        if (!node) return true;

        const leftMax = maxValue(node.left);
        const rightMin = minValue(node.right);

        if (node.val <= leftMax || node.val >= rightMin) return false;

        return check(node.left) && check(node.right);
    };

    return check(root);
};
```

<strong>Time: O(n^2) worst case · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isValidBST(self, root):

        def dfs(node, low, high):
            if not node:
                return True

            if not (low < node.val < high):
                return False

            return (
                dfs(node.left, low, node.val)
                and
                dfs(node.right, node.val, high)
            )

        return dfs(root, -float("inf"), float("inf"))
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isValidBST(TreeNode* root) {
        return dfs(root, LLONG_MIN, LLONG_MAX);
    }

private:
    bool dfs(TreeNode* node, long long low, long long high) {
        if (!node) return true;

        if (!(low < node->val && node->val < high)) return false;

        return dfs(node->left, low, node->val) && dfs(node->right, node->val, high);
    }
};
```

```java filename:Java
class Solution {
    public boolean isValidBST(TreeNode root) {
        return dfs(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private boolean dfs(TreeNode node, long low, long high) {
        if (node == null) return true;

        if (!(low < node.val && node.val < high)) return false;

        return dfs(node.left, low, node.val) && dfs(node.right, node.val, high);
    }
}
```

```javascript filename:JavaScript
var isValidBST = function(root) {
    const dfs = (node, low, high) => {
        if (!node) return true;

        if (!(low < node.val && node.val < high)) return false;

        return dfs(node.left, low, node.val) && dfs(node.right, node.val, high);
    };

    return dfs(root, -Infinity, Infinity);
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>
