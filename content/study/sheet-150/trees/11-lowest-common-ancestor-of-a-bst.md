---
id: e8a31d80-b6c1-7722-8582-08546328b128
key: problem:sheet-150/lc-235
subject: sheet-150
topic: trees
title: Lowest Common Ancestor of a BST
slug: lowest-common-ancestor-of-a-bst
order: 11
---

Difficulty: <strong>Medium</strong> · [LeetCode 235](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/)

# Problem

Given a BST and two nodes `p` and `q`, find their Lowest Common Ancestor (LCA).

# Understanding the problem

In a BST, if both `p` and `q` are smaller than `root.val`, LCA is in left subtree. If both are larger, LCA is in right subtree. Otherwise, `root` is the split point (LCA).

# Intuition

Use the BST property directly to traverse without storing path arrays.

# Approach

1. While `root` exists:
2. If both `p.val` and `q.val` &lt; `root.val`, go left.
3. If both `p.val` and `q.val` &gt; `root.val`, go right.
4. Else return `root` (split point).

# Naive Solution

Build paths from root to both nodes.

```python filename:Python
class Solution:
    def lowestCommonAncestor(self, root, p, q):

        def path_to(node, target):
            path = []

            while node:
                path.append(node)

                if target.val < node.val:
                    node = node.left
                elif target.val > node.val:
                    node = node.right
                else:
                    break

            return path

        p_path = path_to(root, p)
        q_path = path_to(root, q)

        answer = root

        for a, b in zip(p_path, q_path):
            if a != b:
                break
            answer = a

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
        vector<TreeNode*> pPath = pathTo(root, p);
        vector<TreeNode*> qPath = pathTo(root, q);

        TreeNode* answer = root;

        for (int i = 0; i < (int)min(pPath.size(), qPath.size()); i++) {
            if (pPath[i] != qPath[i]) break;
            answer = pPath[i];
        }

        return answer;
    }

private:
    vector<TreeNode*> pathTo(TreeNode* node, TreeNode* target) {
        vector<TreeNode*> path;

        while (node) {
            path.push_back(node);

            if (target->val < node->val) node = node->left;
            else if (target->val > node->val) node = node->right;
            else break;
        }

        return path;
    }
};
```

```java filename:Java
class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        List<TreeNode> pPath = pathTo(root, p);
        List<TreeNode> qPath = pathTo(root, q);

        TreeNode answer = root;

        for (int i = 0; i < Math.min(pPath.size(), qPath.size()); i++) {
            if (pPath.get(i) != qPath.get(i)) break;
            answer = pPath.get(i);
        }

        return answer;
    }

    private List<TreeNode> pathTo(TreeNode node, TreeNode target) {
        List<TreeNode> path = new ArrayList<>();

        while (node != null) {
            path.add(node);

            if (target.val < node.val) node = node.left;
            else if (target.val > node.val) node = node.right;
            else break;
        }

        return path;
    }
}
```

```javascript filename:JavaScript
var lowestCommonAncestor = function(root, p, q) {
    const pathTo = (node, target) => {
        const path = [];

        while (node) {
            path.push(node);

            if (target.val < node.val) node = node.left;
            else if (target.val > node.val) node = node.right;
            else break;
        }

        return path;
    };

    const pPath = pathTo(root, p);
    const qPath = pathTo(root, q);

    let answer = root;

    for (let i = 0; i < Math.min(pPath.length, qPath.length); i++) {
        if (pPath[i] !== qPath[i]) break;
        answer = pPath[i];
    }

    return answer;
};
```

<strong>Time: O(h) · Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def lowestCommonAncestor(self, root, p, q):

        while root:
            if p.val < root.val and q.val < root.val:
                root = root.left

            elif p.val > root.val and q.val > root.val:
                root = root.right

            else:
                return root
```

```cpp filename:C%2B%2B
class Solution {
public:
    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
        while (root) {
            if (p->val < root->val && q->val < root->val) {
                root = root->left;
            } else if (p->val > root->val && q->val > root->val) {
                root = root->right;
            } else {
                return root;
            }
        }

        return nullptr;
    }
};
```

```java filename:Java
class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        while (root != null) {
            if (p.val < root.val && q.val < root.val) {
                root = root.left;
            } else if (p.val > root.val && q.val > root.val) {
                root = root.right;
            } else {
                return root;
            }
        }

        return null;
    }
}
```

```javascript filename:JavaScript
var lowestCommonAncestor = function(root, p, q) {
    while (root) {
        if (p.val < root.val && q.val < root.val) {
            root = root.left;
        } else if (p.val > root.val && q.val > root.val) {
            root = root.right;
        } else {
            return root;
        }
    }

    return null;
};
```

<strong>Time: O(h) · Aux Space: O(1)</strong>
