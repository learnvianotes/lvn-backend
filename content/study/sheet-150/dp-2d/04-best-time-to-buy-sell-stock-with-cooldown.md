---
id: 19b091e3-9fb0-7830-9f52-97424cdaaae2
key: problem:sheet-150/lc-309
subject: sheet-150
topic: dp-2d
title: Best Time to Buy & Sell Stock with Cooldown
slug: best-time-to-buy-sell-stock-with-cooldown
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 309](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/)

# Problem

Find max profit trading stock. After selling a stock, you cannot buy stock on the next day (cooldown 1 day).

# Understanding the problem

States: BUY (can buy or skip), SELL (can sell -&gt; forces day i+2 cooldown), COOLDOWN.

# Intuition

Track 3 state variables across days: `hold`, `sold`, and `cooldown`.

# Approach

1. Initialize `hold = -prices[0]`, `sold = 0`, `cooldown = 0`.
2. For `price` in `prices[1:]`: update state variables according to transitions.
3. Return `max(sold, cooldown)`.

# Naive Solution — Recursion

Branch recursively between buy, sell, and cooldown choices.

```python filename:Python
class Solution:
    def maxProfit(self, prices):

        def dfs(i, buying):
            if i >= len(prices):
                return 0

            if buying:
                buy = -prices[i] + dfs(i + 1, False)
                skip = dfs(i + 1, True)

                return max(buy, skip)

            sell = prices[i] + dfs(i + 2, True)
            hold = dfs(i + 1, False)

            return max(sell, hold)

        return dfs(0, True)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        return dfs(prices, 0, true);
    }

private:
    int dfs(vector<int>& prices, int i, bool buying) {
        if (i >= (int)prices.size()) return 0;

        if (buying) {
            int buy = -prices[i] + dfs(prices, i + 1, false);
            int skip = dfs(prices, i + 1, true);
            return max(buy, skip);
        }

        int sell = prices[i] + dfs(prices, i + 2, true);
        int hold = dfs(prices, i + 1, false);
        return max(sell, hold);
    }
};
```

```java filename:Java
class Solution {
    public int maxProfit(int[] prices) {
        return dfs(prices, 0, true);
    }

    private int dfs(int[] prices, int i, boolean buying) {
        if (i >= prices.length) return 0;

        if (buying) {
            int buy = -prices[i] + dfs(prices, i + 1, false);
            int skip = dfs(prices, i + 1, true);
            return Math.max(buy, skip);
        }

        int sell = prices[i] + dfs(prices, i + 2, true);
        int hold = dfs(prices, i + 1, false);
        return Math.max(sell, hold);
    }
}
```

```javascript filename:JavaScript
var maxProfit = function(prices) {
    const dfs = (i, buying) => {
        if (i >= prices.length) return 0;

        if (buying) {
            const buy = -prices[i] + dfs(i + 1, false);
            const skip = dfs(i + 1, true);
            return Math.max(buy, skip);
        }

        const sell = prices[i] + dfs(i + 2, true);
        const hold = dfs(i + 1, false);
        return Math.max(sell, hold);
    };

    return dfs(0, true);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxProfit(self, prices):

        memo = {}

        def dfs(i, buying):
            if i >= len(prices):
                return 0

            key = (i, buying)

            if key in memo:
                return memo[key]

            if buying:
                buy = -prices[i] + dfs(i + 1, False)
                skip = dfs(i + 1, True)

                memo[key] = max(buy, skip)

            else:
                sell = prices[i] + dfs(i + 2, True)
                hold = dfs(i + 1, False)

                memo[key] = max(sell, hold)

            return memo[key]

        return dfs(0, True)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        // memo[i][buying], -1 = not computed yet
        memo.assign(prices.size(), vector<int>(2, -1));
        return dfs(prices, 0, true);
    }

private:
    vector<vector<int>> memo;

    int dfs(vector<int>& prices, int i, bool buying) {
        if (i >= (int)prices.size()) return 0;

        int& cached = memo[i][buying];
        if (cached != -1) return cached;

        if (buying) {
            int buy = -prices[i] + dfs(prices, i + 1, false);
            int skip = dfs(prices, i + 1, true);
            cached = max(buy, skip);
        } else {
            int sell = prices[i] + dfs(prices, i + 2, true);
            int hold = dfs(prices, i + 1, false);
            cached = max(sell, hold);
        }

        return cached;
    }
};
```

```java filename:Java
class Solution {
    // memo[i][buying ? 1 : 0], null = not computed yet
    private Integer[][] memo;

    public int maxProfit(int[] prices) {
        memo = new Integer[prices.length][2];
        return dfs(prices, 0, true);
    }

    private int dfs(int[] prices, int i, boolean buying) {
        if (i >= prices.length) return 0;

        int b = buying ? 1 : 0;
        if (memo[i][b] != null) return memo[i][b];

        if (buying) {
            int buy = -prices[i] + dfs(prices, i + 1, false);
            int skip = dfs(prices, i + 1, true);
            memo[i][b] = Math.max(buy, skip);
        } else {
            int sell = prices[i] + dfs(prices, i + 2, true);
            int hold = dfs(prices, i + 1, false);
            memo[i][b] = Math.max(sell, hold);
        }

        return memo[i][b];
    }
}
```

```javascript filename:JavaScript
var maxProfit = function(prices) {
    const memo = new Map();

    const dfs = (i, buying) => {
        if (i >= prices.length) return 0;

        const key = `${i},${buying}`;
        if (memo.has(key)) return memo.get(key);

        let result;

        if (buying) {
            const buy = -prices[i] + dfs(i + 1, false);
            const skip = dfs(i + 1, true);
            result = Math.max(buy, skip);
        } else {
            const sell = prices[i] + dfs(i + 2, true);
            const hold = dfs(i + 1, false);
            result = Math.max(sell, hold);
        }

        memo.set(key, result);
        return result;
    };

    return dfs(0, true);
};
```

<strong>Time: O(n) · Space: O(1) (State Machine) / O(n) (Memoization)</strong>

# Takeaway

<strong>State Machine DP</strong> — Model transitions between BUY, SELL, and COOLDOWN explicitly.
