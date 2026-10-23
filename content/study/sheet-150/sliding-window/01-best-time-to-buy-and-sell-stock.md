---
id: 20e2f86d-06de-7e05-a2be-82d2a3fa73c0
key: problem:sheet-150/lc-121
subject: sheet-150
topic: sliding-window
title: Best Time to Buy and Sell Stock
slug: best-time-to-buy-and-sell-stock
order: 1
---

Difficulty: <strong>Easy</strong> · [LeetCode 121](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/)

# Problem

Find maximum profit from buying on one day and selling on a future day.

# Understanding the problem

Profit = `price[sell] - price[buy]` where `sell > buy`.

# Intuition

Track the minimum price seen so far while scanning rightward.

# Approach

1. Track `min_price = infinity` and `max_profit = 0`.
2. For each price, update `min_price = min(min_price, price)`.
3. Update `answer = max(answer, price - min_price)`.

# Naive Solution — Brute Force

Try all possible buy/sell day pairs.

```python filename:Python
class Solution:
    def maxProfit(self, prices):
        answer = 0

        for i in range(len(prices)):
            for j in range(i + 1, len(prices)):
                answer = max(
                    answer,
                    prices[j] - prices[i]
                )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        int answer = 0;
        for (int i = 0; i < prices.size(); i++)
            for (int j = i + 1; j < prices.size(); j++)
                answer = max(answer, prices[j] - prices[i]);
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxProfit(int[] prices) {
        int answer = 0;
        for (int i = 0; i < prices.length; i++)
            for (int j = i + 1; j < prices.length; j++)
                answer = Math.max(answer, prices[j] - prices[i]);
        return answer;
    }
}
```

```javascript filename:JavaScript
var maxProfit = function(prices) {
    let answer = 0;
    for (let i = 0; i < prices.length; i++)
        for (let j = i + 1; j < prices.length; j++)
            answer = Math.max(answer, prices[j] - prices[i]);
    return answer;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxProfit(self, prices):
        min_price = float("inf")
        answer = 0

        for price in prices:
            min_price = min(
                min_price,
                price
            )

            answer = max(
                answer,
                price - min_price
            )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        int minPrice = INT_MAX;
        int answer = 0;
        for (int price : prices) {
            minPrice = min(minPrice, price);
            answer = max(answer, price - minPrice);
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE;
        int answer = 0;
        for (int price : prices) {
            minPrice = Math.min(minPrice, price);
            answer = Math.max(answer, price - minPrice);
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var maxProfit = function(prices) {
    let minPrice = Infinity;
    let answer = 0;
    for (const price of prices) {
        minPrice = Math.min(minPrice, price);
        answer = Math.max(answer, price - minPrice);
    }
    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Maintain minimum left value while scanning once
