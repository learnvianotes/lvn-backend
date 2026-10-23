---
id: 4b788391-3e70-7e76-8814-da8d7b922441
key: problem:sheet-150/lc-875
subject: sheet-150
topic: binary-search
title: Koko Eating Bananas
slug: koko-eating-bananas
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 875](https://leetcode.com/problems/koko-eating-bananas/)

# Problem

Koko can decide her eating speed `k` per hour. Return minimum integer `k` such that she can eat all bananas within `h` hours.

# Understanding the problem

The answer space of speeds $k \\in \[1, \\max(\\text{piles})\]$ is monotonic: if speed $k$ is valid, all speeds $&gt; k$ are also valid.

# Intuition

Binary search on the answer space range $\[1, \\max(\\text{piles})\]$. Find the first speed where total hours $\\le h$.

# Approach

1. Set `left = 1`, `right = max(piles)`.
2. Loop while `left <= right`:
3. Set `speed = left + (right - left) // 2`.
4. Compute `hours = sum((pile + speed - 1) // speed for pile in piles)`.
5. If `hours <= h`: speed is valid! Record `answer = speed` and try smaller speeds `right = speed - 1`.
6. Else: speed is too slow, try faster speeds `left = speed + 1`.

# Naive Solution — Brute Force

Linear search trying every speed $k = 1, 2, 3 \\dots \\max(\\text{piles})$ and checking total hours.

```python filename:Python
class Solution:
    def minEatingSpeed(self, piles, h):

        for speed in range(1, max(piles) + 1):

            hours = 0

            for pile in piles:
                hours += (
                    pile + speed - 1
                ) // speed

            if hours <= h:
                return speed

        return max(piles)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minEatingSpeed(vector<int>& piles, int h) {
        int maxPile = *max_element(piles.begin(), piles.end());

        for (int speed = 1; speed <= maxPile; speed++) {
            long long hours = 0;

            for (int pile : piles) {
                hours += ((long long) pile + speed - 1) / speed;
            }

            if (hours <= h) {
                return speed;
            }
        }

        return maxPile;
    }
};
```

```java filename:Java
class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int maxPile = 0;
        for (int pile : piles) {
            maxPile = Math.max(maxPile, pile);
        }

        for (int speed = 1; speed <= maxPile; speed++) {
            long hours = 0;

            for (int pile : piles) {
                hours += ((long) pile + speed - 1) / speed;
            }

            if (hours <= h) {
                return speed;
            }
        }

        return maxPile;
    }
}
```

```javascript filename:JavaScript
var minEatingSpeed = function(piles, h) {
    const maxPile = Math.max(...piles);

    for (let speed = 1; speed <= maxPile; speed++) {
        let hours = 0;

        for (const pile of piles) {
            hours += Math.floor((pile + speed - 1) / speed);
        }

        if (hours <= h) {
            return speed;
        }
    }

    return maxPile;
};
```

<strong>Time: O(n × max(piles)) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def minEatingSpeed(self, piles, h):

        left = 1
        right = max(piles)

        answer = right

        while left <= right:
            speed = left + (right - left) // 2

            hours = 0

            for pile in piles:
                hours += (
                    pile + speed - 1
                ) // speed

            if hours <= h:
                answer = speed
                right = speed - 1
            else:
                left = speed + 1

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minEatingSpeed(vector<int>& piles, int h) {
        int left = 1;
        int right = *max_element(piles.begin(), piles.end());

        int answer = right;

        while (left <= right) {
            int speed = left + (right - left) / 2;

            long long hours = 0;

            for (int pile : piles) {
                hours += ((long long) pile + speed - 1) / speed;
            }

            if (hours <= h) {
                answer = speed;
                right = speed - 1;
            } else {
                left = speed + 1;
            }
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int left = 1;
        int right = 0;
        for (int pile : piles) {
            right = Math.max(right, pile);
        }

        int answer = right;

        while (left <= right) {
            int speed = left + (right - left) / 2;

            long hours = 0;

            for (int pile : piles) {
                hours += ((long) pile + speed - 1) / speed;
            }

            if (hours <= h) {
                answer = speed;
                right = speed - 1;
            } else {
                left = speed + 1;
            }
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var minEatingSpeed = function(piles, h) {
    let left = 1;
    let right = Math.max(...piles);

    let answer = right;

    while (left <= right) {
        const speed = left + Math.floor((right - left) / 2);

        let hours = 0;

        for (const pile of piles) {
            hours += Math.floor((pile + speed - 1) / speed);
        }

        if (hours <= h) {
            answer = speed;
            right = speed - 1;
        } else {
            left = speed + 1;
        }
    }

    return answer;
};
```

<strong>Time: O(n log(max(piles))) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Monotonic feasibility condition → Binary Search on Answer
