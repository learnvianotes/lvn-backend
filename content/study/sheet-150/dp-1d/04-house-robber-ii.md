---
id: 673224e0-bcfd-76ec-9572-247e774482df
key: problem:sheet-150/lc-213
subject: sheet-150
topic: dp-1d
title: House Robber II
slug: house-robber-ii
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 213](https://leetcode.com/problems/house-robber-ii/)

# Problem

Houses form a circle, so the first and last houses are neighbors and cannot both be robbed. Return maximum money you can rob.

# Understanding the problem

Circular constraint means we split into two linear subproblems: Case 1 (houses `0 ... n-2`) and Case 2 (houses `1 ... n-1`). Return max of both.

# Intuition

Circular DP reduces to running House Robber I helper on two slices: `nums[:-1]` and `nums[1:]`.

# Approach

1. If `len(nums) == 1`, return `nums[0]`.
2. Define linear rob helper function `rob_linear(arr)` using space-optimized House Robber I logic.
3. Return `max(rob_linear(nums[:-1]), rob_linear(nums[1:]))`.

# Naive Solution — Recursion

Try all subsets while tracking whether the first house was robbed and previous house was robbed.

```python filename:Python
class Solution:
    def rob(self, nums):

        def dfs(i, first_robbed, previous_robbed):
            if i == len(nums):
                return 0

            skip = dfs(
                i + 1,
                first_robbed,
                False
            )

            take = 0

            if not previous_robbed:
                if i != len(nums) - 1 or not first_robbed:
                    take = nums[i] + dfs(
                        i + 1,
                        first_robbed or i == 0,
                        True
                    )

            return max(skip, take)

        return dfs(0, False, False)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int rob(vector<int>& nums) {
        return dfs(nums, 0, false, false);
    }

private:
    int dfs(vector<int>& nums, int i, bool firstRobbed, bool previousRobbed) {
        int n = nums.size();
        if (i == n) return 0;

        int skip = dfs(nums, i + 1, firstRobbed, false);

        int take = 0;
        if (!previousRobbed) {
            if (i != n - 1 || !firstRobbed) {
                take = nums[i] + dfs(nums, i + 1, firstRobbed || i == 0, true);
            }
        }

        return max(skip, take);
    }
};
```

```java filename:Java
class Solution {
    public int rob(int[] nums) {
        return dfs(nums, 0, false, false);
    }

    private int dfs(int[] nums, int i, boolean firstRobbed, boolean previousRobbed) {
        int n = nums.length;
        if (i == n) return 0;

        int skip = dfs(nums, i + 1, firstRobbed, false);

        int take = 0;
        if (!previousRobbed) {
            if (i != n - 1 || !firstRobbed) {
                take = nums[i] + dfs(nums, i + 1, firstRobbed || i == 0, true);
            }
        }

        return Math.max(skip, take);
    }
}
```

```javascript filename:JavaScript
var rob = function(nums) {
    const n = nums.length;

    const dfs = (i, firstRobbed, previousRobbed) => {
        if (i === n) return 0;

        const skip = dfs(i + 1, firstRobbed, false);

        let take = 0;
        if (!previousRobbed) {
            if (i !== n - 1 || !firstRobbed) {
                take = nums[i] + dfs(i + 1, firstRobbed || i === 0, true);
            }
        }

        return Math.max(skip, take);
    };

    return dfs(0, false, false);
};
```

<strong>Time: O(2^n) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def rob(self, nums):

        if len(nums) == 1:
            return nums[0]

        def rob_linear(arr):
            prev2 = 0
            prev1 = 0

            for money in arr:
                current = max(
                    prev1,
                    money + prev2
                )

                prev2 = prev1
                prev1 = current

            return prev1

        return max(
            rob_linear(nums[:-1]),
            rob_linear(nums[1:])
        )
```

```cpp filename:C%2B%2B
class Solution {
public:
    int rob(vector<int>& nums) {
        int n = nums.size();
        if (n == 1) return nums[0];

        return max(robLinear(nums, 0, n - 2), robLinear(nums, 1, n - 1));
    }

private:
    // Rob houses nums[lo..hi] laid out in a line
    int robLinear(vector<int>& nums, int lo, int hi) {
        int prev2 = 0, prev1 = 0;

        for (int i = lo; i <= hi; i++) {
            int current = max(prev1, nums[i] + prev2);
            prev2 = prev1;
            prev1 = current;
        }

        return prev1;
    }
};
```

```java filename:Java
class Solution {
    public int rob(int[] nums) {
        int n = nums.length;
        if (n == 1) return nums[0];

        return Math.max(robLinear(nums, 0, n - 2), robLinear(nums, 1, n - 1));
    }

    // Rob houses nums[lo..hi] laid out in a line
    private int robLinear(int[] nums, int lo, int hi) {
        int prev2 = 0, prev1 = 0;

        for (int i = lo; i <= hi; i++) {
            int current = Math.max(prev1, nums[i] + prev2);
            prev2 = prev1;
            prev1 = current;
        }

        return prev1;
    }
}
```

```javascript filename:JavaScript
var rob = function(nums) {
    if (nums.length === 1) return nums[0];

    const robLinear = (arr) => {
        let prev2 = 0, prev1 = 0;

        for (const money of arr) {
            const current = Math.max(prev1, money + prev2);
            prev2 = prev1;
            prev1 = current;
        }

        return prev1;
    };

    return Math.max(robLinear(nums.slice(0, -1)), robLinear(nums.slice(1)));
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Circular DP → split into two linear DP problems.</strong>
