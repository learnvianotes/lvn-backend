---
id: 2786335c-37a7-755f-b652-0c890c8a695c
key: problem:sheet-150/lc-518
subject: sheet-150
topic: dp-2d
title: Coin Change II
slug: coin-change-ii
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 518](https://leetcode.com/problems/coin-change-ii/)

# Problem

Count the number of combinations to make an amount using given coin denominations (unlimited supply).

# Understanding the problem

Unbounded Knapsack combinations! Outer loop must iterate coins first to avoid counting permutations twice (e.g. 1+2 vs 2+1).

# Intuition

`dp[c] += dp[c - coin]`. Outer loop iterating coins ensures ordering is fixed and combinations are counted.

# Approach

1. Initialize `dp = [0] * (amount + 1)` and `dp[0] = 1`.
2. For `coin` in `coins`: for `current` from `coin` to `amount`: `dp[current] += dp[current - coin]`.
3. Return `dp[amount]`.

# Naive Solution — Recursion

Try taking or skipping each coin recursively.

```python filename:Python
class Solution:
    def change(self, amount, coins):

        def dfs(index, remaining):
            if remaining == 0:
                return 1

            if index == len(coins) or remaining < 0:
                return 0

            # Use current coin
            use = dfs(
                index,
                remaining - coins[index]
            )

            # Skip current coin
            skip = dfs(
                index + 1,
                remaining
            )

            return use + skip

        return dfs(0, amount)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int change(int amount, vector<int>& coins) {
        return dfs(coins, 0, amount);
    }

private:
    int dfs(vector<int>& coins, int index, int remaining) {
        if (remaining == 0) return 1;
        if (index == (int)coins.size() || remaining < 0) return 0;

        // Use current coin
        int use = dfs(coins, index, remaining - coins[index]);

        // Skip current coin
        int skip = dfs(coins, index + 1, remaining);

        return use + skip;
    }
};
```

```java filename:Java
class Solution {
    public int change(int amount, int[] coins) {
        return dfs(coins, 0, amount);
    }

    private int dfs(int[] coins, int index, int remaining) {
        if (remaining == 0) return 1;
        if (index == coins.length || remaining < 0) return 0;

        // Use current coin
        int use = dfs(coins, index, remaining - coins[index]);

        // Skip current coin
        int skip = dfs(coins, index + 1, remaining);

        return use + skip;
    }
}
```

```javascript filename:JavaScript
var change = function(amount, coins) {
    const dfs = (index, remaining) => {
        if (remaining === 0) return 1;
        if (index === coins.length || remaining < 0) return 0;

        // Use current coin
        const use = dfs(index, remaining - coins[index]);

        // Skip current coin
        const skip = dfs(index + 1, remaining);

        return use + skip;
    };

    return dfs(0, amount);
};
```

<strong>Time: Exponential · Aux Space: O(amount + n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def change(self, amount, coins):

        dp = [0] * (amount + 1)
        dp[0] = 1

        for coin in coins:
            for current in range(
                coin,
                amount + 1
            ):
                dp[current] += dp[current - coin]

        return dp[amount]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int change(int amount, vector<int>& coins) {
        // unsigned: unrelated cells may overflow, but dp[amount] always fits
        vector<unsigned long long> dp(amount + 1, 0);
        dp[0] = 1;

        for (int coin : coins) {
            for (int current = coin; current <= amount; current++) {
                dp[current] += dp[current - coin];
            }
        }

        return (int)dp[amount];
    }
};
```

```java filename:Java
class Solution {
    public int change(int amount, int[] coins) {
        long[] dp = new long[amount + 1];
        dp[0] = 1;

        for (int coin : coins) {
            for (int current = coin; current <= amount; current++) {
                dp[current] += dp[current - coin];
            }
        }

        return (int) dp[amount];
    }
}
```

```javascript filename:JavaScript
var change = function(amount, coins) {
    const dp = new Array(amount + 1).fill(0);
    dp[0] = 1;

    for (const coin of coins) {
        for (let current = coin; current <= amount; current++) {
            dp[current] += dp[current - coin];
        }
    }

    return dp[amount];
};
```

<strong>Time: O(amount × n) · Space: O(amount)</strong>

# Takeaway

<strong>Unbounded Knapsack Combinations</strong> — Outer loop over `coins`, inner loop increasing order over `amount`.
