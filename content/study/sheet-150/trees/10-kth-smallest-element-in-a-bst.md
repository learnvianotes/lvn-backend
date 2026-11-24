---
id: d48bad46-ca4e-7a82-b26c-f7e1489b8514
key: problem:sheet-150/lc-230
subject: sheet-150
topic: trees
title: Kth Smallest Element in a BST
slug: kth-smallest-element-in-a-bst
order: 10
---

Difficulty: <strong>Medium</strong> · [LeetCode 230](https://leetcode.com/problems/kth-smallest-element-in-a-bst/)

# Problem

Given root of BST and integer `k`, return `k-th` smallest value (1-indexed) in tree.

# Understanding the problem

An in-order traversal of a BST visits nodes in strictly ascending sorted order.

# Intuition

Iterative stack inorder traversal stopping immediately when kth node is reached.

# Approach

1. Use explicit stack for inorder traversal.
2. Push left children until node is None.
3. Pop node, decrement k. If k == 0 return node.val.
4. Set node = node.right and continue.

# Naive Solution

Store the complete inorder traversal in a list and return `values[k-1]`.

```python filename:Python
class Solution:
    def kthSmallest(self, root, k):
        values = []

        def inorder(node):
            if not node:
                return

            inorder(node.left)
            values.append(node.val)
            inorder(node.right)

        inorder(root)

        return values[k - 1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int kthSmallest(TreeNode* root, int k) {
        vector<int> values;
        inorder(root, values);

        return values[k - 1];
    }

private:
    void inorder(TreeNode* node, vector<int>& values) {
        if (!node) return;

        inorder(node->left, values);
        values.push_back(node->val);
        inorder(node->right, values);
    }
};
```

```java filename:Java
class Solution {
    public int kthSmallest(TreeNode root, int k) {
        List<Integer> values = new ArrayList<>();
        inorder(root, values);

        return values.get(k - 1);
    }

    private void inorder(TreeNode node, List<Integer> values) {
        if (node == null) return;

        inorder(node.left, values);
        values.add(node.val);
        inorder(node.right, values);
    }
}
```

```javascript filename:JavaScript
var kthSmallest = function(root, k) {
    const values = [];

    const inorder = (node) => {
        if (!node) return;

        inorder(node.left);
        values.push(node.val);
        inorder(node.right);
    };

    inorder(root);

    return values[k - 1];
};
```

<strong>Time: O(n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def kthSmallest(self, root, k):
        stack = []
        node = root

        while True:
            while node:
                stack.append(node)
                node = node.left

            node = stack.pop()
            k -= 1

            if k == 0:
                return node.val

            node = node.right
```

```cpp filename:C%2B%2B
class Solution {
public:
    int kthSmallest(TreeNode* root, int k) {
        stack<TreeNode*> st;
        TreeNode* node = root;

        while (true) {
            while (node) {
                st.push(node);
                node = node->left;
            }

            node = st.top();
            st.pop();
            k--;

            if (k == 0) return node->val;

            node = node->right;
        }
    }
};
```

```java filename:Java
class Solution {
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode node = root;

        while (true) {
            while (node != null) {
                stack.push(node);
                node = node.left;
            }

            node = stack.pop();
            k--;

            if (k == 0) return node.val;

            node = node.right;
        }
    }
}
```

```javascript filename:JavaScript
var kthSmallest = function(root, k) {
    const stack = [];
    let node = root;

    while (true) {
        while (node) {
            stack.push(node);
            node = node.left;
        }

        node = stack.pop();
        k--;

        if (k === 0) return node.val;

        node = node.right;
    }
};
```

<strong>Time: O(h + k) · Aux Space: O(h)</strong>

# Takeaway

<strong>Pattern:</strong> BST + inorder = sorted order.
