---
id: 1ffbdc18-dbba-7852-97c8-a7c80a5f7ce3
key: problem:sheet-150/lc-53
subject: sheet-150
topic: greedy
title: Maximum Subarray
slug: maximum-subarray
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 53](https://leetcode.com/problems/maximum-subarray/)

# Problem

Given an integer array `nums`, find the contiguous subarray with the largest sum and return its sum.

# Understanding the problem

The key question at each position: is it better to extend the current running sum, or start fresh? Discarding negative prefixes is the locally-optimal choice that gives the globally optimal answer.

# Intuition

At each index, either extend the previous subarray or start a new one. If `current + nums[i] < nums[i]` the prefix actively hurts us — discard it. This is Kadane's Algorithm (also a 1-D DP recurrence).

# Approach

1. Initialize `current = answer = nums[0]`.
2. Iterate `i` from index 1 to end.
3. At each step: `current = max(nums[i], current + nums[i])`.
4. Update `answer = max(answer, current)`.
5. Return `answer`.

# Naive Solution — Brute Force

Try every possible subarray. For each starting index, scan right and track the running sum.

```python filename:Python
class Solution:
    def maxSubArray(self, nums):
        answer = float("-inf")

        for i in range(len(nums)):
            total = 0

            for j in range(i, len(nums)):
                total += nums[j]
                answer = max(answer, total)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        int answer = INT_MIN;

        for (int i = 0; i < (int)nums.size(); i++) {
            int total = 0;

            for (int j = i; j < (int)nums.size(); j++) {
                total += nums[j];
                answer = max(answer, total);
            }
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxSubArray(int[] nums) {
        int answer = Integer.MIN_VALUE;

        for (int i = 0; i < nums.length; i++) {
            int total = 0;

            for (int j = i; j < nums.length; j++) {
                total += nums[j];
                answer = Math.max(answer, total);
            }
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var maxSubArray = function(nums) {
    let answer = -Infinity;

    for (let i = 0; i < nums.length; i++) {
        let total = 0;

        for (let j = i; j < nums.length; j++) {
            total += nums[j];
            answer = Math.max(answer, total);
        }
    }

    return answer;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxSubArray(self, nums):
        current = nums[0]
        answer = nums[0]

        for i in range(1, len(nums)):
            current = max(
                nums[i],
                current + nums[i]
            )

            answer = max(answer, current)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        int current = nums[0];
        int answer = nums[0];

        for (int i = 1; i < (int)nums.size(); i++) {
            current = max(nums[i], current + nums[i]);
            answer = max(answer, current);
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxSubArray(int[] nums) {
        int current = nums[0];
        int answer = nums[0];

        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            answer = Math.max(answer, current);
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var maxSubArray = function(nums) {
    let current = nums[0];
    let answer = nums[0];

    for (let i = 1; i < nums.length; i++) {
        current = Math.max(nums[i], current + nums[i]);
        answer = Math.max(answer, current);
    }

    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Kadane's Algorithm — Start fresh when the prefix becomes a liability
