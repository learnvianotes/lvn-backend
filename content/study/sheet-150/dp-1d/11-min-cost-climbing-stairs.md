---
id: 9a761c27-69cc-7f0c-b47e-3c45bfd32566
key: problem:sheet-150/lc-746
subject: sheet-150
topic: dp-1d
title: Min Cost Climbing Stairs
slug: min-cost-climbing-stairs
order: 11
---

Difficulty: <strong>Easy</strong> · [LeetCode 746](https://leetcode.com/problems/min-cost-climbing-stairs/)

# Problem

Given an integer array `cost` where `cost[i]` is the cost of `i`-th step on a staircase. Once you pay the cost, you can climb 1 or 2 steps. Return the minimum cost to reach the top of the floor.

# Understanding the problem

You can start from step 0 or step 1. At step `i`, cost incurred to jump is `cost[i] + min(cost_of_next_1, cost_of_next_2)`.

# Intuition

Building bottom-up: `dp[i] = min(dp[i-1] + cost[i-1], dp[i-2] + cost[i-2])`. Can be space-optimized to two variables.

# Approach

1. Initialize `prev2 = 0` and `prev1 = 0`.
2. Loop `i` from 2 to `len(cost)`.
3. `current = min(prev1 + cost[i-1], prev2 + cost[i-2])`.
4. Shift `prev2 = prev1`, `prev1 = current`. Return `prev1`.

# Naive Solution — Recursion

Recursively try starting from 0 and 1, taking min cost of jumping 1 or 2 steps at each index.

```python filename:Python
class Solution:
    def minCostClimbingStairs(self, cost):

        def dfs(i):
            if i >= len(cost):
                return 0

            return cost[i] + min(
                dfs(i + 1),
                dfs(i + 2)
            )

        return min(dfs(0), dfs(1))
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minCostClimbingStairs(vector<int>& cost) {
        return min(dfs(cost, 0), dfs(cost, 1));
    }

private:
    int dfs(vector<int>& cost, int i) {
        if (i >= (int)cost.size()) return 0;
        return cost[i] + min(dfs(cost, i + 1), dfs(cost, i + 2));
    }
};
```

```java filename:Java
class Solution {
    public int minCostClimbingStairs(int[] cost) {
        return Math.min(dfs(cost, 0), dfs(cost, 1));
    }

    private int dfs(int[] cost, int i) {
        if (i >= cost.length) return 0;
        return cost[i] + Math.min(dfs(cost, i + 1), dfs(cost, i + 2));
    }
}
```

```javascript filename:JavaScript
var minCostClimbingStairs = function(cost) {
    const dfs = (i) => {
        if (i >= cost.length) return 0;
        return cost[i] + Math.min(dfs(i + 1), dfs(i + 2));
    };

    return Math.min(dfs(0), dfs(1));
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def minCostClimbingStairs(self, cost):
        n = len(cost)

        dp = [0] * (n + 1)

        for i in range(2, n + 1):
            dp[i] = min(
                dp[i - 1] + cost[i - 1],
                dp[i - 2] + cost[i - 2]
            )

        return dp[n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minCostClimbingStairs(vector<int>& cost) {
        int n = cost.size();
        vector<int> dp(n + 1, 0);

        for (int i = 2; i <= n; i++) {
            dp[i] = min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]);
        }

        return dp[n];
    }
};
```

```java filename:Java
class Solution {
    public int minCostClimbingStairs(int[] cost) {
        int n = cost.length;
        int[] dp = new int[n + 1];

        for (int i = 2; i <= n; i++) {
            dp[i] = Math.min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]);
        }

        return dp[n];
    }
}
```

```javascript filename:JavaScript
var minCostClimbingStairs = function(cost) {
    const n = cost.length;
    const dp = new Array(n + 1).fill(0);

    for (let i = 2; i <= n; i++) {
        dp[i] = Math.min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]);
    }

    return dp[n];
};
```

<strong>Time: O(n) · Space: O(1) (Space Optimized) / O(n) (DP Array)</strong>

# Takeaway

<strong>Minimum previous states DP</strong> — Transition depends on minimum of previous subproblem choices.
