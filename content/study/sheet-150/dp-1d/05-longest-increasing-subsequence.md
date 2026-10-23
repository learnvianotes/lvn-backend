---
id: 2bc84358-a3a8-7d1d-a3f8-bcfad63a4d23
key: problem:sheet-150/lc-300
subject: sheet-150
topic: dp-1d
title: Longest Increasing Subsequence
slug: longest-increasing-subsequence
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 300](https://leetcode.com/problems/longest-increasing-subsequence/)

# Problem

Given an integer array `nums`, return length of longest strictly increasing subsequence.

# Understanding the problem

At each element, we can take it (if larger than previous taken element) or skip it. Standard DP is O(n²), patience sort / binary search optimizes to O(n log n).

# Intuition

O(n²) DP: `dp[i]` represents length of LIS ending at index `i`. Binary Search: `tails` array tracks smallest tail of all increasing subsequences.

# Approach

1. Initialize empty list `tails`.
2. For each `num` in `nums`: binary search target index in `tails` using `bisect_left`.
3. If index equals `len(tails)`, append `num`. Else overwrite `tails[index] = num`.
4. Return `len(tails)`.

# Naive Solution — Recursion

Try taking or skipping every element recursively.

```python filename:Python
class Solution:
    def lengthOfLIS(self, nums):

        def dfs(index, previous):
            if index == len(nums):
                return 0

            skip = dfs(index + 1, previous)

            take = 0

            if previous == -1 or nums[index] > nums[previous]:
                take = 1 + dfs(index + 1, index)

            return max(take, skip)

        return dfs(0, -1)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int lengthOfLIS(vector<int>& nums) {
        return dfs(nums, 0, -1);
    }

private:
    int dfs(vector<int>& nums, int index, int previous) {
        if (index == (int)nums.size()) return 0;

        int skip = dfs(nums, index + 1, previous);

        int take = 0;
        if (previous == -1 || nums[index] > nums[previous]) {
            take = 1 + dfs(nums, index + 1, index);
        }

        return max(take, skip);
    }
};
```

```java filename:Java
class Solution {
    public int lengthOfLIS(int[] nums) {
        return dfs(nums, 0, -1);
    }

    private int dfs(int[] nums, int index, int previous) {
        if (index == nums.length) return 0;

        int skip = dfs(nums, index + 1, previous);

        int take = 0;
        if (previous == -1 || nums[index] > nums[previous]) {
            take = 1 + dfs(nums, index + 1, index);
        }

        return Math.max(take, skip);
    }
}
```

```javascript filename:JavaScript
var lengthOfLIS = function(nums) {
    const dfs = (index, previous) => {
        if (index === nums.length) return 0;

        const skip = dfs(index + 1, previous);

        let take = 0;
        if (previous === -1 || nums[index] > nums[previous]) {
            take = 1 + dfs(index + 1, index);
        }

        return Math.max(take, skip);
    };

    return dfs(0, -1);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def lengthOfLIS(self, nums):

        n = len(nums)
        dp = [1] * n

        answer = 1

        for i in range(n):
            for j in range(i):

                if nums[j] < nums[i]:
                    dp[i] = max(
                        dp[i],
                        dp[j] + 1
                    )

            answer = max(answer, dp[i])

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int lengthOfLIS(vector<int>& nums) {
        int n = nums.size();
        vector<int> dp(n, 1);

        int answer = 1;

        for (int i = 0; i < n; i++) {
            for (int j = 0; j < i; j++) {
                if (nums[j] < nums[i]) {
                    dp[i] = max(dp[i], dp[j] + 1);
                }
            }

            answer = max(answer, dp[i]);
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int lengthOfLIS(int[] nums) {
        int n = nums.length;
        int[] dp = new int[n];
        Arrays.fill(dp, 1);

        int answer = 1;

        for (int i = 0; i < n; i++) {
            for (int j = 0; j < i; j++) {
                if (nums[j] < nums[i]) {
                    dp[i] = Math.max(dp[i], dp[j] + 1);
                }
            }

            answer = Math.max(answer, dp[i]);
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var lengthOfLIS = function(nums) {
    const n = nums.length;
    const dp = new Array(n).fill(1);

    let answer = 1;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            if (nums[j] < nums[i]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }

        answer = Math.max(answer, dp[i]);
    }

    return answer;
};
```

<strong>Time: O(n log n) (Binary Search) / O(n²) (Standard DP) · Space: O(n)</strong>

# Takeaway

<strong>LIS → DP first, then recognize the patience-sorting/binary-search optimization.</strong>
