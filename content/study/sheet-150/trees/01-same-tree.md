---
id: 3ccd4829-4376-7b9c-bc60-5a64fe9475c0
key: problem:sheet-150/lc-100
subject: sheet-150
topic: trees
title: Same Tree
slug: same-tree
order: 1
---

Difficulty: <strong>Easy</strong> · [LeetCode 100](https://leetcode.com/problems/same-tree/)

# Problem

Given roots of two binary trees `p` and `q`, check if they are structurally and value identical.

# Understanding the problem

Both trees must have identical node values and subtree structures at every position.

# Intuition

Iterative comparison using queue avoids call stack growth.

# Approach

1. Push `(p, q)` into queue.
2. While queue: pop `a, b`.
3. If both None continue. If one None or values differ return False.
4. Push `(a.left, b.left)` and `(a.right, b.right)`.

# Naive Solution

Recursive comparison.

```python filename:Python
class Solution:
    def isSameTree(self, p, q):
        if not p and not q:
            return True

        if not p or not q:
            return False

        if p.val != q.val:
            return False

        return (
            self.isSameTree(p.left, q.left)
            and
            self.isSameTree(p.right, q.right)
        )
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isSameTree(TreeNode* p, TreeNode* q) {
        if (!p && !q) return true;

        if (!p || !q) return false;

        if (p->val != q->val) return false;

        return isSameTree(p->left, q->left) && isSameTree(p->right, q->right);
    }
};
```

```java filename:Java
class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        if (p == null && q == null) return true;

        if (p == null || q == null) return false;

        if (p.val != q.val) return false;

        return isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
    }
}
```

```javascript filename:JavaScript
var isSameTree = function(p, q) {
    if (!p && !q) return true;

    if (!p || !q) return false;

    if (p.val !== q.val) return false;

    return isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
};
```

<strong>Time: O(n) · Aux Space: O(h)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def isSameTree(self, p, q):
        queue = deque([(p, q)])

        while queue:
            a, b = queue.popleft()

            if not a and not b:
                continue

            if not a or not b:
                return False

            if a.val != b.val:
                return False

            queue.append((a.left, b.left))
            queue.append((a.right, b.right))

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isSameTree(TreeNode* p, TreeNode* q) {
        queue<pair<TreeNode*, TreeNode*>> pairs;
        pairs.push({p, q});

        while (!pairs.empty()) {
            auto [a, b] = pairs.front();
            pairs.pop();

            if (!a && !b) continue;

            if (!a || !b) return false;

            if (a->val != b->val) return false;

            pairs.push({a->left, b->left});
            pairs.push({a->right, b->right});
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        Deque<TreeNode[]> queue = new ArrayDeque<>();
        queue.offer(new TreeNode[] { p, q });

        while (!queue.isEmpty()) {
            TreeNode[] pair = queue.poll();
            TreeNode a = pair[0], b = pair[1];

            if (a == null && b == null) continue;

            if (a == null || b == null) return false;

            if (a.val != b.val) return false;

            queue.offer(new TreeNode[] { a.left, b.left });
            queue.offer(new TreeNode[] { a.right, b.right });
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var isSameTree = function(p, q) {
    const queue = [[p, q]];
    let head = 0;

    while (head < queue.length) {
        const [a, b] = queue[head++];

        if (!a && !b) continue;

        if (!a || !b) return false;

        if (a.val !== b.val) return false;

        queue.push([a.left, b.left]);
        queue.push([a.right, b.right]);
    }

    return true;
};
```

<strong>Time: O(n) · Aux Space: O(w)</strong>
