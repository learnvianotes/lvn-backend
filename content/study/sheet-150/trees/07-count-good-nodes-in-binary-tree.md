---
id: 88c56e1b-6935-79d9-ac56-c98817a16f8c
key: problem:sheet-150/lc-1448
subject: sheet-150
topic: trees
title: Count Good Nodes in Binary Tree
slug: count-good-nodes-in-binary-tree
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 1448](https://leetcode.com/problems/count-good-nodes-in-binary-tree/)

# Problem

A node is good if its value is greater than or equal to every value on the path from root.

# Understanding the problem

Carry state from root → current node to know the maximum value seen so far on the current path.

# Intuition

Carry only the single scalar `max_so_far` value down the branch during DFS.

# Approach

1. Define `dfs(node, max_so_far)`.
2. If node is None return 0.
3. Check if `node.val >= max_so_far`.
4. Update `max_so_far = max(max_so_far, node.val)`.
5. Recurse left and right subtrees and return total count.

# Naive Solution

Pass complete path array and check `node.val == max(path)`.

```python filename:Python
class Solution:
    def goodNodes(self, root):

        def dfs(node, path):
            if not node:
                return 0

            path.append(node.val)

            count = 0
            if node.val == max(path):
                count += 1

            count += dfs(node.left, path)
            count += dfs(node.right, path)

            path.pop()
            return count

        return dfs(root, [])
```

```cpp filename:C%2B%2B
class Solution {
public:
    int goodNodes(TreeNode* root) {
        vector<int> path;
        return dfs(root, path);
    }

private:
    int dfs(TreeNode* node, vector<int>& path) {
        if (!node) return 0;

        path.push_back(node->val);

        int count = 0;
        if (node->val == *max_element(path.begin(), path.end())) count++;

        count += dfs(node->left, path);
        count += dfs(node->right, path);

        path.pop_back();
        return count;
    }
};
```

```java filename:Java
class Solution {
    public int goodNodes(TreeNode root) {
        return dfs(root, new ArrayList<>());
    }

    private int dfs(TreeNode node, List<Integer> path) {
        if (node == null) return 0;

        path.add(node.val);

        int count = 0;
        if (node.val == Collections.max(path)) count++;

        count += dfs(node.left, path);
        count += dfs(node.right, path);

        path.remove(path.size() - 1);
        return count;
    }
}
```

```javascript filename:JavaScript
var goodNodes = function(root) {
    const dfs = (node, path) => {
        if (!node) return 0;

        path.push(node.val);

        let count = 0;
        if (node.val === path.reduce((a, b) => Math.max(a, b))) count++;

        count += dfs(node.left, path);
        count += dfs(node.right, path);

        path.pop();
        return count;
    };

    return dfs(root, []);
};
```

<strong>Time: O(n^2) worst case · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def goodNodes(self, root):

        def dfs(node, max_so_far):
            if not node:
                return 0

            good = node.val >= max_so_far

            max_so_far = max(max_so_far, node.val)

            return (
                good
                + dfs(node.left, max_so_far)
                + dfs(node.right, max_so_far)
            )

        return dfs(root, root.val)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int goodNodes(TreeNode* root) {
        return dfs(root, root->val);
    }

private:
    int dfs(TreeNode* node, int maxSoFar) {
        if (!node) return 0;

        int good = node->val >= maxSoFar ? 1 : 0;

        maxSoFar = max(maxSoFar, node->val);

        return good + dfs(node->left, maxSoFar) + dfs(node->right, maxSoFar);
    }
};
```

```java filename:Java
class Solution {
    public int goodNodes(TreeNode root) {
        return dfs(root, root.val);
    }

    private int dfs(TreeNode node, int maxSoFar) {
        if (node == null) return 0;

        int good = node.val >= maxSoFar ? 1 : 0;

        maxSoFar = Math.max(maxSoFar, node.val);

        return good + dfs(node.left, maxSoFar) + dfs(node.right, maxSoFar);
    }
}
```

```javascript filename:JavaScript
var goodNodes = function(root) {
    const dfs = (node, maxSoFar) => {
        if (!node) return 0;

        const good = node.val >= maxSoFar ? 1 : 0;

        maxSoFar = Math.max(maxSoFar, node.val);

        return good + dfs(node.left, maxSoFar) + dfs(node.right, maxSoFar);
    };

    return dfs(root, root.val);
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>

# Takeaway

<strong>Pattern:</strong> Carry state from root → current node.
