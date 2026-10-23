---
id: 9f6e81e0-dc43-7361-a2f7-ffecbc2fcd3b
key: problem:sheet-150/lc-322
subject: sheet-150
topic: dp-1d
title: Coin Change
slug: coin-change
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 322](https://leetcode.com/problems/coin-change/)

# Problem

Given coin denominations and `amount`, return fewest coins needed to make up amount. If impossible return -1.

# Understanding the problem

Unbounded choice + minimum coins → 1-D DP array where `dp[i] = min(dp[i], 1 + dp[i - coin])`.

# Intuition

Initialize `dp` array of size `amount + 1` with infinity (or `amount + 1`) and `dp[0] = 0`. Fill from 1 to `amount`.

# Approach

1. Create `dp = [amount + 1] * (amount + 1)`, set `dp[0] = 0`.
2. For `current` from 1 to `amount`: for each `coin` in `coins`: if `coin <= current`, update `dp[current] = min(dp[current], dp[current - coin] + 1)`.
3. Return `dp[amount]` if `dp[amount] <= amount` else -1.

# Naive Solution — Recursion

Try every coin denomination recursively at each remaining target amount.

```python filename:Python
class Solution:
    def coinChange(self, coins, amount):

        def dfs(remaining):
            if remaining == 0:
                return 0

            if remaining < 0:
                return float("inf")

            answer = float("inf")

            for coin in coins:
                answer = min(
                    answer,
                    1 + dfs(remaining - coin)
                )

            return answer

        result = dfs(amount)

        return -1 if result == float("inf") else result
```

```cpp filename:C%2B%2B
class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        int result = dfs(coins, amount);
        return result == INT_MAX ? -1 : result;
    }

private:
    int dfs(vector<int>& coins, int remaining) {
        if (remaining == 0) return 0;
        if (remaining < 0) return INT_MAX;

        int answer = INT_MAX;

        for (int coin : coins) {
            int sub = dfs(coins, remaining - coin);
            if (sub != INT_MAX) {
                answer = min(answer, 1 + sub);
            }
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int coinChange(int[] coins, int amount) {
        int result = dfs(coins, amount);
        return result == Integer.MAX_VALUE ? -1 : result;
    }

    private int dfs(int[] coins, int remaining) {
        if (remaining == 0) return 0;
        if (remaining < 0) return Integer.MAX_VALUE;

        int answer = Integer.MAX_VALUE;

        for (int coin : coins) {
            int sub = dfs(coins, remaining - coin);
            if (sub != Integer.MAX_VALUE) {
                answer = Math.min(answer, 1 + sub);
            }
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var coinChange = function(coins, amount) {
    const dfs = (remaining) => {
        if (remaining === 0) return 0;
        if (remaining < 0) return Infinity;

        let answer = Infinity;

        for (const coin of coins) {
            answer = Math.min(answer, 1 + dfs(remaining - coin));
        }

        return answer;
    };

    const result = dfs(amount);

    return result === Infinity ? -1 : result;
};
```

<strong>Time: O(n^amount) · Aux Space: O(amount)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def coinChange(self, coins, amount):

        dp = [amount + 1] * (amount + 1)
        dp[0] = 0

        for current in range(1, amount + 1):
            for coin in coins:

                if coin <= current:
                    dp[current] = min(
                        dp[current],
                        dp[current - coin] + 1
                    )

        return -1 if dp[amount] > amount else dp[amount]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        vector<int> dp(amount + 1, amount + 1);
        dp[0] = 0;

        for (int current = 1; current <= amount; current++) {
            for (int coin : coins) {
                if (coin <= current) {
                    dp[current] = min(dp[current], dp[current - coin] + 1);
                }
            }
        }

        return dp[amount] > amount ? -1 : dp[amount];
    }
};
```

```java filename:Java
class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;

        for (int current = 1; current <= amount; current++) {
            for (int coin : coins) {
                if (coin <= current) {
                    dp[current] = Math.min(dp[current], dp[current - coin] + 1);
                }
            }
        }

        return dp[amount] > amount ? -1 : dp[amount];
    }
}
```

```javascript filename:JavaScript
var coinChange = function(coins, amount) {
    const dp = new Array(amount + 1).fill(amount + 1);
    dp[0] = 0;

    for (let current = 1; current <= amount; current++) {
        for (const coin of coins) {
            if (coin <= current) {
                dp[current] = Math.min(dp[current], dp[current - coin] + 1);
            }
        }
    }

    return dp[amount] > amount ? -1 : dp[amount];
};
```

<strong>Time: O(amount × n) · Space: O(amount)</strong>

# Takeaway

<strong>Unbounded choice + minimum → 1-D DP.</strong>
