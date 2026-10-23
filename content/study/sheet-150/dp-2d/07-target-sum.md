---
id: 5ac6d9f6-c870-7ed3-b613-461f446c6041
key: problem:sheet-150/lc-494
subject: sheet-150
topic: dp-2d
title: Target Sum
slug: target-sum
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 494](https://leetcode.com/problems/target-sum/)

# Problem

Assign `+` or `-` to every number in `nums` to reach `target`. Return total ways.

# Understanding the problem

Can be converted to a subset sum problem: `P - N = target` and `P + N = total` ⇒ `P = (total + target) // 2`.

# Intuition

Reduce problem to finding subset sum equal to `(total + target) // 2` using 0/1 Knapsack 1D DP.

# Approach

1. Compute `total = sum(nums)`. If `abs(target) > total` or `(total + target) % 2`, return 0.
2. `subset = (total + target) // 2`.
3. Initialize `dp = [0] * (subset + 1)` with `dp[0] = 1`.
4. For `num` in `nums`: loop `current` backward from `subset` down to `num`: `dp[current] += dp[current - num]`. Return `dp[subset]`.

# Naive Solution — Recursion

Try adding and subtracting each number recursively.

```python filename:Python
class Solution:
    def findTargetSumWays(self, nums, target):

        def dfs(index, total):
            if index == len(nums):
                return total == target

            return (
                dfs(index + 1, total + nums[index])
                +
                dfs(index + 1, total - nums[index])
            )

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findTargetSumWays(vector<int>& nums, int target) {
        return dfs(nums, target, 0, 0);
    }

private:
    int dfs(vector<int>& nums, int target, int index, int total) {
        if (index == (int)nums.size()) return total == target ? 1 : 0;

        return dfs(nums, target, index + 1, total + nums[index])
             + dfs(nums, target, index + 1, total - nums[index]);
    }
};
```

```java filename:Java
class Solution {
    public int findTargetSumWays(int[] nums, int target) {
        return dfs(nums, target, 0, 0);
    }

    private int dfs(int[] nums, int target, int index, int total) {
        if (index == nums.length) return total == target ? 1 : 0;

        return dfs(nums, target, index + 1, total + nums[index])
             + dfs(nums, target, index + 1, total - nums[index]);
    }
}
```

```javascript filename:JavaScript
var findTargetSumWays = function(nums, target) {
    const dfs = (index, total) => {
        if (index === nums.length) return total === target ? 1 : 0;

        return dfs(index + 1, total + nums[index])
             + dfs(index + 1, total - nums[index]);
    };

    return dfs(0, 0);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def findTargetSumWays(self, nums, target):

        memo = {}

        def dfs(index, total):
            if index == len(nums):
                return 1 if total == target else 0

            key = (index, total)

            if key in memo:
                return memo[key]

            memo[key] = (
                dfs(index + 1, total + nums[index])
                +
                dfs(index + 1, total - nums[index])
            )

            return memo[key]

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findTargetSumWays(vector<int>& nums, int target) {
        memo.clear();
        return dfs(nums, target, 0, 0);
    }

private:
    map<pair<int, int>, int> memo;

    int dfs(vector<int>& nums, int target, int index, int total) {
        if (index == (int)nums.size()) return total == target ? 1 : 0;

        auto key = make_pair(index, total);
        auto it = memo.find(key);
        if (it != memo.end()) return it->second;

        int ways = dfs(nums, target, index + 1, total + nums[index])
                 + dfs(nums, target, index + 1, total - nums[index]);

        memo[key] = ways;
        return ways;
    }
};
```

```java filename:Java
class Solution {
    private Map<String, Integer> memo;

    public int findTargetSumWays(int[] nums, int target) {
        memo = new HashMap<>();
        return dfs(nums, target, 0, 0);
    }

    private int dfs(int[] nums, int target, int index, int total) {
        if (index == nums.length) return total == target ? 1 : 0;

        String key = index + "," + total;
        if (memo.containsKey(key)) return memo.get(key);

        int ways = dfs(nums, target, index + 1, total + nums[index])
                 + dfs(nums, target, index + 1, total - nums[index]);

        memo.put(key, ways);
        return ways;
    }
}
```

```javascript filename:JavaScript
var findTargetSumWays = function(nums, target) {
    const memo = new Map();

    const dfs = (index, total) => {
        if (index === nums.length) return total === target ? 1 : 0;

        const key = `${index},${total}`;
        if (memo.has(key)) return memo.get(key);

        const ways = dfs(index + 1, total + nums[index])
                   + dfs(index + 1, total - nums[index]);

        memo.set(key, ways);
        return ways;
    };

    return dfs(0, 0);
};
```

<strong>Time: O(n × subset) · Space: O(subset)</strong>

# Takeaway

<strong>Subset Sum Reduction</strong> — Transform +/- Target Sum into 0/1 Knapsack subset counting.
