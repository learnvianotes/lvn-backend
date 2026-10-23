---
id: 44c78af7-fad8-781c-9b85-b2d659764409
key: problem:sheet-150/lc-124
subject: sheet-150
topic: trees
title: Binary Tree Maximum Path Sum
slug: binary-tree-maximum-path-sum
order: 6
---

Difficulty: <strong>Hard</strong> · [LeetCode 124](https://leetcode.com/problems/binary-tree-maximum-path-sum/)

# Problem

Return maximum path sum of any non-empty path in a binary tree.

# Understanding the problem

A path can split through current node (left + val + right), but extending to parent can only take ONE branch (val + max(left, right)). Clamp negative branch gains to 0.

# Intuition

Single DFS computing gain to return upward and updating global max path sum.

# Approach

1. Initialize `answer = -inf`.
2. Define `dfs(node)`: get `left = max(0, dfs(node.left))`, `right = max(0, dfs(node.right))`.
3. Update `answer = max(answer, node.val + left + right)`.
4. Return single branch gain: `node.val + max(left, right)`.

# Naive Solution

For every node, calculate maximum gain separately.

```python filename:Python
class Solution:
    def maxPathSum(self, root):

        def gain(node):
            if not node:
                return 0

            return node.val + max(
                0,
                gain(node.left),
                gain(node.right)
            )

        def path(node):
            if not node:
                return -float("inf")

            left = gain(node.left)
            right = gain(node.right)

            current = node.val + max(0, left) + max(0, right)

            return max(
                current,
                path(node.left),
                path(node.right)
            )

        return path(root)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxPathSum(TreeNode* root) {
        return path(root);
    }

private:
    int gain(TreeNode* node) {
        if (!node) return 0;

        return node->val + max({0, gain(node->left), gain(node->right)});
    }

    int path(TreeNode* node) {
        if (!node) return INT_MIN;

        int left = gain(node->left);
        int right = gain(node->right);

        int current = node->val + max(0, left) + max(0, right);

        return max({current, path(node->left), path(node->right)});
    }
};
```

```java filename:Java
class Solution {
    public int maxPathSum(TreeNode root) {
        return path(root);
    }

    private int gain(TreeNode node) {
        if (node == null) return 0;

        return node.val + Math.max(0, Math.max(gain(node.left), gain(node.right)));
    }

    private int path(TreeNode node) {
        if (node == null) return Integer.MIN_VALUE;

        int left = gain(node.left);
        int right = gain(node.right);

        int current = node.val + Math.max(0, left) + Math.max(0, right);

        return Math.max(current, Math.max(path(node.left), path(node.right)));
    }
}
```

```javascript filename:JavaScript
var maxPathSum = function(root) {
    const gain = (node) => {
        if (!node) return 0;

        return node.val + Math.max(0, gain(node.left), gain(node.right));
    };

    const path = (node) => {
        if (!node) return -Infinity;

        const left = gain(node.left);
        const right = gain(node.right);

        const current = node.val + Math.max(0, left) + Math.max(0, right);

        return Math.max(current, path(node.left), path(node.right));
    };

    return path(root);
};
```

<strong>Time: O(n^2) worst case · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxPathSum(self, root):
        answer = -float("inf")

        def dfs(node):
            nonlocal answer

            if not node:
                return 0

            left = max(0, dfs(node.left))
            right = max(0, dfs(node.right))

            current = node.val + left + right

            answer = max(answer, current)

            return node.val + max(left, right)

        dfs(root)
        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxPathSum(TreeNode* root) {
        int answer = INT_MIN;
        dfs(root, answer);
        return answer;
    }

private:
    int dfs(TreeNode* node, int& answer) {
        if (!node) return 0;

        int left = max(0, dfs(node->left, answer));
        int right = max(0, dfs(node->right, answer));

        int current = node->val + left + right;

        answer = max(answer, current);

        return node->val + max(left, right);
    }
};
```

```java filename:Java
class Solution {
    private int answer;

    public int maxPathSum(TreeNode root) {
        answer = Integer.MIN_VALUE;
        dfs(root);
        return answer;
    }

    private int dfs(TreeNode node) {
        if (node == null) return 0;

        int left = Math.max(0, dfs(node.left));
        int right = Math.max(0, dfs(node.right));

        int current = node.val + left + right;

        answer = Math.max(answer, current);

        return node.val + Math.max(left, right);
    }
}
```

```javascript filename:JavaScript
var maxPathSum = function(root) {
    let answer = -Infinity;

    const dfs = (node) => {
        if (!node) return 0;

        const left = Math.max(0, dfs(node.left));
        const right = Math.max(0, dfs(node.right));

        const current = node.val + left + right;

        answer = Math.max(answer, current);

        return node.val + Math.max(left, right);
    };

    dfs(root);
    return answer;
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>

# Takeaway

<strong>Critical Pattern:</strong> Two values: Best path through current node → update answer; Best path going upward → return one branch only.
