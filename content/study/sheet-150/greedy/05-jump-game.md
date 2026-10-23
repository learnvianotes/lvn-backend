---
id: 8c72506b-3290-7202-a465-2a1ab36ce927
key: problem:sheet-150/lc-55
subject: sheet-150
topic: greedy
title: Jump Game
slug: jump-game
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 55](https://leetcode.com/problems/jump-game/)

# Problem

Given array `nums` where `nums[i]` is the maximum jump length from index `i`, return `True` if you can reach the last index.

# Understanding the problem

All we need is whether the end is reachable — not how. At each index track the furthest position currently reachable. If we reach an index that exceeds our current reach, it's impossible.

# Intuition

Scan left-to-right maintaining `farthest` — the furthest index reachable so far. If `i > farthest` at any point, we are stranded.

# Approach

1. Initialize `farthest = 0`.
2. Iterate `i` from 0 to end.
3. If `i > farthest`: return `False` (gap in reachability).
4. Update `farthest = max(farthest, i + nums[i])`.
5. After the loop, return `True`.

# Naive Solution — Brute Force

DFS from index 0: try every valid jump length recursively.

```python filename:Python
class Solution:
    def canJump(self, nums):
        n = len(nums)

        def dfs(index):
            if index >= n - 1:
                return True

            max_jump = nums[index]

            for jump in range(1, max_jump + 1):
                if dfs(index + jump):
                    return True

            return False

        return dfs(0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canJump(vector<int>& nums) {
        return dfs(nums, 0);
    }

private:
    bool dfs(vector<int>& nums, int index) {
        int n = nums.size();
        if (index >= n - 1) {
            return true;
        }

        int maxJump = nums[index];

        for (int jump = 1; jump <= maxJump; jump++) {
            if (dfs(nums, index + jump)) {
                return true;
            }
        }

        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean canJump(int[] nums) {
        return dfs(nums, 0);
    }

    private boolean dfs(int[] nums, int index) {
        int n = nums.length;
        if (index >= n - 1) {
            return true;
        }

        int maxJump = nums[index];

        for (int jump = 1; jump <= maxJump; jump++) {
            if (dfs(nums, index + jump)) {
                return true;
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var canJump = function(nums) {
    const n = nums.length;

    const dfs = (index) => {
        if (index >= n - 1) {
            return true;
        }

        const maxJump = nums[index];

        for (let jump = 1; jump <= maxJump; jump++) {
            if (dfs(index + jump)) {
                return true;
            }
        }

        return false;
    };

    return dfs(0);
};
```

<strong>Time: O(2ⁿ) worst case · Space: O(n) recursion</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def canJump(self, nums):
        farthest = 0

        for i in range(len(nums)):
            if i > farthest:
                return False

            farthest = max(
                farthest,
                i + nums[i]
            )

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canJump(vector<int>& nums) {
        int farthest = 0;

        for (int i = 0; i < (int)nums.size(); i++) {
            if (i > farthest) {
                return false;
            }

            farthest = max(farthest, i + nums[i]);
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean canJump(int[] nums) {
        int farthest = 0;

        for (int i = 0; i < nums.length; i++) {
            if (i > farthest) {
                return false;
            }

            farthest = Math.max(farthest, i + nums[i]);
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var canJump = function(nums) {
    let farthest = 0;

    for (let i = 0; i < nums.length; i++) {
        if (i > farthest) {
            return false;
        }

        farthest = Math.max(farthest, i + nums[i]);
    }

    return true;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Furthest Reachable — greedily extend the reachable frontier
