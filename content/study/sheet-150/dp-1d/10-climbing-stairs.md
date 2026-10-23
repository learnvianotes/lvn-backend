---
id: 6c72acf0-3bc6-7553-b754-1edec64f4bd9
key: problem:sheet-150/lc-70
subject: sheet-150
topic: dp-1d
title: Climbing Stairs
slug: climbing-stairs
order: 10
---

Difficulty: <strong>Easy</strong> · [LeetCode 70](https://leetcode.com/problems/climbing-stairs/)

# Problem

You are climbing a staircase with `n` steps. Each time you can climb `1` or `2` steps. How many distinct ways can you climb to the top?

# Understanding the problem

At every step, you can climb either 1 or 2 stairs. To reach step `n`, you come from `n-1` or `n-2`.

# Intuition

Subproblem overlap means `dp[i] = dp[i-1] + dp[i-2]`. We can build bottom-up or optimize space to only 2 variables.

# Approach

1. Check base cases: if `n <= 2`, return `n`.
2. Maintain `prev2 = 1` and `prev1 = 2`.
3. Loop from 3 to `n` updating `current = prev1 + prev2`, shifting `prev2 = prev1` and `prev1 = current`.
4. Return `prev1`.

# Naive Solution — Recursion

Generate every climb step combination by recursively deciding whether to take 1 or 2 steps.

```python filename:Python
class Solution:
    def climbStairs(self, n):
        def dfs(step):
            if step == n:
                return 1

            if step > n:
                return 0

            return dfs(step + 1) + dfs(step + 2)

        return dfs(0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int climbStairs(int n) {
        return dfs(0, n);
    }

private:
    int dfs(int step, int n) {
        if (step == n) return 1;
        if (step > n) return 0;
        return dfs(step + 1, n) + dfs(step + 2, n);
    }
};
```

```java filename:Java
class Solution {
    public int climbStairs(int n) {
        return dfs(0, n);
    }

    private int dfs(int step, int n) {
        if (step == n) return 1;
        if (step > n) return 0;
        return dfs(step + 1, n) + dfs(step + 2, n);
    }
}
```

```javascript filename:JavaScript
var climbStairs = function(n) {
    const dfs = (step) => {
        if (step === n) return 1;
        if (step > n) return 0;
        return dfs(step + 1) + dfs(step + 2);
    };

    return dfs(0);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def climbStairs(self, n):
        if n <= 2:
            return n

        dp = [0] * (n + 1)
        dp[1] = 1
        dp[2] = 2

        for i in range(3, n + 1):
            dp[i] = dp[i - 1] + dp[i - 2]

        return dp[n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int climbStairs(int n) {
        if (n <= 2) return n;

        vector<int> dp(n + 1, 0);
        dp[1] = 1;
        dp[2] = 2;

        for (int i = 3; i <= n; i++) {
            dp[i] = dp[i - 1] + dp[i - 2];
        }

        return dp[n];
    }
};
```

```java filename:Java
class Solution {
    public int climbStairs(int n) {
        if (n <= 2) return n;

        int[] dp = new int[n + 1];
        dp[1] = 1;
        dp[2] = 2;

        for (int i = 3; i <= n; i++) {
            dp[i] = dp[i - 1] + dp[i - 2];
        }

        return dp[n];
    }
}
```

```javascript filename:JavaScript
var climbStairs = function(n) {
    if (n <= 2) return n;

    const dp = new Array(n + 1).fill(0);
    dp[1] = 1;
    dp[2] = 2;

    for (let i = 3; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }

    return dp[n];
};
```

<strong>Time: O(n) · Space: O(1) (Space Optimized) / O(n) (DP Array)</strong>

# Takeaway

<strong>Previous 2 states DP</strong> — Each state only depends on the immediate two previous states.
