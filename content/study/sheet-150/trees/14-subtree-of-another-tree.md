---
id: e0238f4d-ea66-7bbf-aa41-21dff0a498a5
key: problem:sheet-150/lc-572
subject: sheet-150
topic: trees
title: Subtree of Another Tree
slug: subtree-of-another-tree
order: 14
---

Difficulty: <strong>Easy</strong> · [LeetCode 572](https://leetcode.com/problems/subtree-of-another-tree/)

# Problem

Given roots of `root` and `subRoot`, return true if `subRoot` is a valid subtree of `root`.

# Understanding the problem

For every node in `root`, check whether `subRoot` is identical to that subtree.

# Intuition

Serialize both trees with null markers and run string matching algorithm (KMP) in linear time.

# Approach

1. Serialize `root` and `subRoot` using preorder traversal into strings with null markers.
2. Build KMP Partial Match Table (LPS) for pattern string.
3. Run KMP search to find `pattern` in `text` in O(n + m) time.

# Naive Solution

For every node in root, check whether subRoot is identical to the subtree.

```python filename:Python
class Solution:
    def isSubtree(self, root, subRoot):
        
        def same(a, b):
            if not a and not b:
                return True

            if not a or not b:
                return False

            return (
                a.val == b.val
                and same(a.left, b.left)
                and same(a.right, b.right)
            )

        if not root:
            return False

        if same(root, subRoot):
            return True

        return (
            self.isSubtree(root.left, subRoot)
            or
            self.isSubtree(root.right, subRoot)
        )
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isSubtree(TreeNode* root, TreeNode* subRoot) {
        if (!root) return false;

        if (same(root, subRoot)) return true;

        return isSubtree(root->left, subRoot) || isSubtree(root->right, subRoot);
    }

private:
    bool same(TreeNode* a, TreeNode* b) {
        if (!a && !b) return true;
        if (!a || !b) return false;

        return a->val == b->val && same(a->left, b->left) && same(a->right, b->right);
    }
};
```

```java filename:Java
class Solution {
    public boolean isSubtree(TreeNode root, TreeNode subRoot) {
        if (root == null) return false;

        if (same(root, subRoot)) return true;

        return isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);
    }

    private boolean same(TreeNode a, TreeNode b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;

        return a.val == b.val && same(a.left, b.left) && same(a.right, b.right);
    }
}
```

```javascript filename:JavaScript
var isSubtree = function(root, subRoot) {
    const same = (a, b) => {
        if (!a && !b) return true;
        if (!a || !b) return false;

        return a.val === b.val && same(a.left, b.left) && same(a.right, b.right);
    };

    if (!root) return false;

    if (same(root, subRoot)) return true;

    return isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);
};
```

<strong>Time: O(n × m) worst case · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isSubtree(self, root, subRoot):

        def serialize(node):
            if not node:
                return "#"

            return (
                "," + str(node.val) +
                serialize(node.left) +
                serialize(node.right)
            )

        text = serialize(root)
        pattern = serialize(subRoot)

        # KMP algorithm
        lps = [0] * len(pattern)

        j = 0
        for i in range(1, len(pattern)):
            while j > 0 and pattern[i] != pattern[j]:
                j = lps[j - 1]

            if pattern[i] == pattern[j]:
                j += 1

            lps[i] = j

        j = 0

        for i in range(len(text)):
            while j > 0 and text[i] != pattern[j]:
                j = lps[j - 1]

            if text[i] == pattern[j]:
                j += 1

            if j == len(pattern):
                return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isSubtree(TreeNode* root, TreeNode* subRoot) {
        string text, pattern;
        serialize(root, text);
        serialize(subRoot, pattern);

        // KMP algorithm
        int m = pattern.size();
        vector<int> lps(m, 0);

        int j = 0;
        for (int i = 1; i < m; i++) {
            while (j > 0 && pattern[i] != pattern[j]) j = lps[j - 1];

            if (pattern[i] == pattern[j]) j++;

            lps[i] = j;
        }

        j = 0;

        for (int i = 0; i < (int)text.size(); i++) {
            while (j > 0 && text[i] != pattern[j]) j = lps[j - 1];

            if (text[i] == pattern[j]) j++;

            if (j == m) return true;
        }

        return false;
    }

private:
    void serialize(TreeNode* node, string& out) {
        if (!node) {
            out += "#";
            return;
        }

        out += "," + to_string(node->val);
        serialize(node->left, out);
        serialize(node->right, out);
    }
};
```

```java filename:Java
class Solution {
    public boolean isSubtree(TreeNode root, TreeNode subRoot) {
        StringBuilder textBuilder = new StringBuilder();
        StringBuilder patternBuilder = new StringBuilder();
        serialize(root, textBuilder);
        serialize(subRoot, patternBuilder);
        String text = textBuilder.toString();
        String pattern = patternBuilder.toString();

        // KMP algorithm
        int m = pattern.length();
        int[] lps = new int[m];

        int j = 0;
        for (int i = 1; i < m; i++) {
            while (j > 0 && pattern.charAt(i) != pattern.charAt(j)) j = lps[j - 1];

            if (pattern.charAt(i) == pattern.charAt(j)) j++;

            lps[i] = j;
        }

        j = 0;

        for (int i = 0; i < text.length(); i++) {
            while (j > 0 && text.charAt(i) != pattern.charAt(j)) j = lps[j - 1];

            if (text.charAt(i) == pattern.charAt(j)) j++;

            if (j == m) return true;
        }

        return false;
    }

    private void serialize(TreeNode node, StringBuilder out) {
        if (node == null) {
            out.append('#');
            return;
        }

        out.append(',').append(node.val);
        serialize(node.left, out);
        serialize(node.right, out);
    }
}
```

```javascript filename:JavaScript
var isSubtree = function(root, subRoot) {
    const serialize = (node) => {
        if (!node) return "#";

        return "," + node.val + serialize(node.left) + serialize(node.right);
    };

    const text = serialize(root);
    const pattern = serialize(subRoot);

    // KMP algorithm
    const lps = new Array(pattern.length).fill(0);

    let j = 0;
    for (let i = 1; i < pattern.length; i++) {
        while (j > 0 && pattern[i] !== pattern[j]) j = lps[j - 1];

        if (pattern[i] === pattern[j]) j++;

        lps[i] = j;
    }

    j = 0;

    for (let i = 0; i < text.length; i++) {
        while (j > 0 && text[i] !== pattern[j]) j = lps[j - 1];

        if (text[i] === pattern[j]) j++;

        if (j === pattern.length) return true;
    }

    return false;
};
```

<strong>Time: O(n + m) · Aux Space: O(n + m)</strong>
