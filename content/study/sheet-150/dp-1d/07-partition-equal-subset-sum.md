---
id: e7f56273-1a37-76aa-8076-0494beea1aa7
key: problem:sheet-150/lc-416
subject: sheet-150
topic: dp-1d
title: Partition Equal Subset Sum
slug: partition-equal-subset-sum
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 416](https://leetcode.com/problems/partition-equal-subset-sum/)

# Problem

Given integer array `nums`, return true if array can be partitioned into two subsets with equal sum.

# Understanding the problem

If `sum(nums)` is odd, partition is impossible. Target sum is `total // 2`. This is a classic 0/1 Knapsack problem.

# Intuition

Boolean array `dp[c]` stores whether target sum `c` is reachable. Loop backwards to use each number at most once!

# Approach

1. Compute `total = sum(nums)`. If `total % 2`, return False. `target = total // 2`.
2. Initialize `dp = [False] * (target + 1)` with `dp[0] = True`.
3. For `num` in `nums`: loop `current` backward from `target` down to `num`: `dp[current] = dp[current] or dp[current - num]`.
4. Return `dp[target]`.

# Naive Solution — Recursion

Try putting every number into either subset recursively.

```python filename:Python
class Solution:
    def canPartition(self, nums):

        total = sum(nums)

        if total % 2:
            return False

        target = total // 2

        def dfs(index, remaining):
            if remaining == 0:
                return True

            if index == len(nums) or remaining < 0:
                return False

            return (
                dfs(index + 1, remaining - nums[index])
                or
                dfs(index + 1, remaining)
            )

        return dfs(0, target)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canPartition(vector<int>& nums) {
        int total = accumulate(nums.begin(), nums.end(), 0);
        if (total % 2) return false;

        return dfs(nums, 0, total / 2);
    }

private:
    bool dfs(vector<int>& nums, int index, int remaining) {
        if (remaining == 0) return true;
        if (index == (int)nums.size() || remaining < 0) return false;

        return dfs(nums, index + 1, remaining - nums[index])
            || dfs(nums, index + 1, remaining);
    }
};
```

```java filename:Java
class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;
        for (int num : nums) total += num;

        if (total % 2 != 0) return false;

        return dfs(nums, 0, total / 2);
    }

    private boolean dfs(int[] nums, int index, int remaining) {
        if (remaining == 0) return true;
        if (index == nums.length || remaining < 0) return false;

        return dfs(nums, index + 1, remaining - nums[index])
            || dfs(nums, index + 1, remaining);
    }
}
```

```javascript filename:JavaScript
var canPartition = function(nums) {
    const total = nums.reduce((a, b) => a + b, 0);
    if (total % 2) return false;

    const target = total / 2;

    const dfs = (index, remaining) => {
        if (remaining === 0) return true;
        if (index === nums.length || remaining < 0) return false;

        return dfs(index + 1, remaining - nums[index])
            || dfs(index + 1, remaining);
    };

    return dfs(0, target);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def canPartition(self, nums):

        total = sum(nums)

        if total % 2:
            return False

        target = total // 2

        dp = [False] * (target + 1)
        dp[0] = True

        for num in nums:
            for current in range(target, num - 1, -1):
                dp[current] = (
                    dp[current]
                    or
                    dp[current - num]
                )

        return dp[target]
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canPartition(vector<int>& nums) {
        int total = accumulate(nums.begin(), nums.end(), 0);
        if (total % 2) return false;

        int target = total / 2;

        vector<bool> dp(target + 1, false);
        dp[0] = true;

        for (int num : nums) {
            for (int current = target; current >= num; current--) {
                dp[current] = dp[current] || dp[current - num];
            }
        }

        return dp[target];
    }
};
```

```java filename:Java
class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;
        for (int num : nums) total += num;

        if (total % 2 != 0) return false;

        int target = total / 2;

        boolean[] dp = new boolean[target + 1];
        dp[0] = true;

        for (int num : nums) {
            for (int current = target; current >= num; current--) {
                dp[current] = dp[current] || dp[current - num];
            }
        }

        return dp[target];
    }
}
```

```javascript filename:JavaScript
var canPartition = function(nums) {
    const total = nums.reduce((a, b) => a + b, 0);
    if (total % 2) return false;

    const target = total / 2;

    const dp = new Array(target + 1).fill(false);
    dp[0] = true;

    for (const num of nums) {
        for (let current = target; current >= num; current--) {
            dp[current] = dp[current] || dp[current - num];
        }
    }

    return dp[target];
};
```

<strong>Time: O(n × target) · Space: O(target)</strong>

# Takeaway

<strong>0/1 Knapsack Backward Loop</strong> — Loop backward (`range(target, num - 1, -1)`) so each number is used only once.
