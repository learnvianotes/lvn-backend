---
id: b1c41a69-47f2-796c-aaea-23fa03a12939
key: problem:sheet-150/lc-198
subject: sheet-150
topic: dp-1d
title: House Robber
slug: house-robber
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 198](https://leetcode.com/problems/house-robber/)

# Problem

You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed. Adjacent houses have security systems connected, so you cannot rob two adjacent houses. Return maximum money you can rob.

# Understanding the problem

At every house: Rob it (gain `nums[i]` + profit from house `i-2`) OR skip it (keep profit from house `i-1`).

# Intuition

State equation: `dp[i] = max(dp[i-1], nums[i] + dp[i-2])`. We can optimize space by keeping only `prev1` and `prev2`.

# Approach

1. Initialize `prev2 = 0` and `prev1 = 0`.
2. Iterate through `money` in `nums`.
3. Compute `current = max(prev1, money + prev2)`.
4. Update `prev2 = prev1` and `prev1 = current`. Return `prev1`.

# Naive Solution — Recursion

Explore all choices at each house recursively.

```python filename:Python
class Solution:
    def rob(self, nums):

        def dfs(i):
            if i >= len(nums):
                return 0

            rob = nums[i] + dfs(i + 2)
            skip = dfs(i + 1)

            return max(rob, skip)

        return dfs(0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int rob(vector<int>& nums) {
        return dfs(nums, 0);
    }

private:
    int dfs(vector<int>& nums, int i) {
        if (i >= (int)nums.size()) return 0;

        int robIt = nums[i] + dfs(nums, i + 2);
        int skip = dfs(nums, i + 1);

        return max(robIt, skip);
    }
};
```

```java filename:Java
class Solution {
    public int rob(int[] nums) {
        return dfs(nums, 0);
    }

    private int dfs(int[] nums, int i) {
        if (i >= nums.length) return 0;

        int rob = nums[i] + dfs(nums, i + 2);
        int skip = dfs(nums, i + 1);

        return Math.max(rob, skip);
    }
}
```

```javascript filename:JavaScript
var rob = function(nums) {
    const dfs = (i) => {
        if (i >= nums.length) return 0;

        const robIt = nums[i] + dfs(i + 2);
        const skip = dfs(i + 1);

        return Math.max(robIt, skip);
    };

    return dfs(0);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def rob(self, nums):
        n = len(nums)

        if n == 0:
            return 0

        if n == 1:
            return nums[0]

        dp = [0] * n

        dp[0] = nums[0]
        dp[1] = max(nums[0], nums[1])

        for i in range(2, n):
            dp[i] = max(
                dp[i - 1],
                nums[i] + dp[i - 2]
            )

        return dp[-1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int rob(vector<int>& nums) {
        int n = nums.size();

        if (n == 0) return 0;
        if (n == 1) return nums[0];

        vector<int> dp(n, 0);
        dp[0] = nums[0];
        dp[1] = max(nums[0], nums[1]);

        for (int i = 2; i < n; i++) {
            dp[i] = max(dp[i - 1], nums[i] + dp[i - 2]);
        }

        return dp[n - 1];
    }
};
```

```java filename:Java
class Solution {
    public int rob(int[] nums) {
        int n = nums.length;

        if (n == 0) return 0;
        if (n == 1) return nums[0];

        int[] dp = new int[n];
        dp[0] = nums[0];
        dp[1] = Math.max(nums[0], nums[1]);

        for (int i = 2; i < n; i++) {
            dp[i] = Math.max(dp[i - 1], nums[i] + dp[i - 2]);
        }

        return dp[n - 1];
    }
}
```

```javascript filename:JavaScript
var rob = function(nums) {
    const n = nums.length;

    if (n === 0) return 0;
    if (n === 1) return nums[0];

    const dp = new Array(n).fill(0);
    dp[0] = nums[0];
    dp[1] = Math.max(nums[0], nums[1]);

    for (let i = 2; i < n; i++) {
        dp[i] = Math.max(dp[i - 1], nums[i] + dp[i - 2]);
    }

    return dp[n - 1];
};
```

<strong>Time: O(n) · Space: O(1) (Space Optimized) / O(n) (DP Array)</strong>

# Takeaway

<strong>Take / Skip DP</strong> — Classic binary choice pattern at each element.
