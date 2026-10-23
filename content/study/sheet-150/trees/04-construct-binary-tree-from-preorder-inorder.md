---
id: ccb768fb-ae8b-7c1a-9177-53095ed15b0a
key: problem:sheet-150/lc-105
subject: sheet-150
topic: trees
title: Construct Binary Tree from Preorder & Inorder
slug: construct-binary-tree-from-preorder-inorder
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 105](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/)

# Problem

Given two integer arrays `preorder` and `inorder`, construct and return the binary tree.

# Understanding the problem

Preorder gives root values sequentially. Inorder splits into left subtree (left of root index) and right subtree (right of root index).

# Intuition

Use hashmap for O(1) inorder index lookups and preorder index pointer instead of array slicing.

# Approach

1. Store `positions = {val: i for i, val in enumerate(inorder)}`.
2. Maintain `preorder_index = 0`.
3. Define `build(left, right)`: if `left > right` return None.
4. Get `root_val = preorder[preorder_index]`, increment pointer, build left and right using `mid = positions[root_val]`.

# Naive Solution

Slicing arrays and using `.index()` search.

```python filename:Python
class Solution:
    def buildTree(self, preorder, inorder):
        if not preorder or not inorder:
            return None

        root_val = preorder[0]
        root = TreeNode(root_val)

        index = inorder.index(root_val)

        root.left = self.buildTree(
            preorder[1:index + 1],
            inorder[:index]
        )

        root.right = self.buildTree(
            preorder[index + 1:],
            inorder[index + 1:]
        )

        return root
```

```cpp filename:C%2B%2B
class Solution {
public:
    TreeNode* buildTree(vector<int>& preorder, vector<int>& inorder) {
        if (preorder.empty() || inorder.empty()) return nullptr;

        int rootVal = preorder[0];
        TreeNode* root = new TreeNode(rootVal);

        int index = find(inorder.begin(), inorder.end(), rootVal) - inorder.begin();

        vector<int> leftPre(preorder.begin() + 1, preorder.begin() + index + 1);
        vector<int> leftIn(inorder.begin(), inorder.begin() + index);
        root->left = buildTree(leftPre, leftIn);

        vector<int> rightPre(preorder.begin() + index + 1, preorder.end());
        vector<int> rightIn(inorder.begin() + index + 1, inorder.end());
        root->right = buildTree(rightPre, rightIn);

        return root;
    }
};
```

```java filename:Java
class Solution {
    public TreeNode buildTree(int[] preorder, int[] inorder) {
        if (preorder.length == 0 || inorder.length == 0) return null;

        int rootVal = preorder[0];
        TreeNode root = new TreeNode(rootVal);

        int index = 0;
        while (inorder[index] != rootVal) index++;

        root.left = buildTree(
            Arrays.copyOfRange(preorder, 1, index + 1),
            Arrays.copyOfRange(inorder, 0, index)
        );

        root.right = buildTree(
            Arrays.copyOfRange(preorder, index + 1, preorder.length),
            Arrays.copyOfRange(inorder, index + 1, inorder.length)
        );

        return root;
    }
}
```

```javascript filename:JavaScript
var buildTree = function(preorder, inorder) {
    if (!preorder.length || !inorder.length) return null;

    const rootVal = preorder[0];
    const root = new TreeNode(rootVal);

    const index = inorder.indexOf(rootVal);

    root.left = buildTree(
        preorder.slice(1, index + 1),
        inorder.slice(0, index)
    );

    root.right = buildTree(
        preorder.slice(index + 1),
        inorder.slice(index + 1)
    );

    return root;
};
```

<strong>Time: O(n^2) worst case · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def buildTree(self, preorder, inorder):

        positions = {
            value: i
            for i, value in enumerate(inorder)
        }

        preorder_index = 0

        def build(left, right):
            nonlocal preorder_index

            if left > right:
                return None

            root_val = preorder[preorder_index]
            preorder_index += 1

            root = TreeNode(root_val)

            mid = positions[root_val]

            root.left = build(left, mid - 1)
            root.right = build(mid + 1, right)

            return root

        return build(0, len(inorder) - 1)
```

```cpp filename:C%2B%2B
class Solution {
public:
    TreeNode* buildTree(vector<int>& preorder, vector<int>& inorder) {
        unordered_map<int, int> positions;
        for (int i = 0; i < (int)inorder.size(); i++) positions[inorder[i]] = i;

        int preorderIndex = 0;

        function<TreeNode*(int, int)> build = [&](int left, int right) -> TreeNode* {
            if (left > right) return nullptr;

            int rootVal = preorder[preorderIndex++];

            TreeNode* root = new TreeNode(rootVal);

            int mid = positions[rootVal];

            root->left = build(left, mid - 1);
            root->right = build(mid + 1, right);

            return root;
        };

        return build(0, (int)inorder.size() - 1);
    }
};
```

```java filename:Java
class Solution {
    private Map<Integer, Integer> positions;
    private int[] preorder;
    private int preorderIndex;

    public TreeNode buildTree(int[] preorder, int[] inorder) {
        positions = new HashMap<>();
        for (int i = 0; i < inorder.length; i++) positions.put(inorder[i], i);

        this.preorder = preorder;
        preorderIndex = 0;

        return build(0, inorder.length - 1);
    }

    private TreeNode build(int left, int right) {
        if (left > right) return null;

        int rootVal = preorder[preorderIndex++];

        TreeNode root = new TreeNode(rootVal);

        int mid = positions.get(rootVal);

        root.left = build(left, mid - 1);
        root.right = build(mid + 1, right);

        return root;
    }
}
```

```javascript filename:JavaScript
var buildTree = function(preorder, inorder) {
    const positions = new Map();
    inorder.forEach((value, i) => positions.set(value, i));

    let preorderIndex = 0;

    const build = (left, right) => {
        if (left > right) return null;

        const rootVal = preorder[preorderIndex++];

        const root = new TreeNode(rootVal);

        const mid = positions.get(rootVal);

        root.left = build(left, mid - 1);
        root.right = build(mid + 1, right);

        return root;
    };

    return build(0, inorder.length - 1);
};
```

<strong>Time: O(n) · Aux Space: O(n)</strong>
