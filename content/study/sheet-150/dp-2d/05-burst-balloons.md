---
id: dcdd1103-aac1-714e-ad48-b39050acc7ac
key: problem:sheet-150/lc-312
subject: sheet-150
topic: dp-2d
title: Burst Balloons
slug: burst-balloons
order: 5
---

Difficulty: <strong>Hard</strong> · [LeetCode 312](https://leetcode.com/problems/burst-balloons/)

# Problem

Burst balloon `i` to gain `nums[i-1] * nums[i] * nums[i+1]` coins. Return max total coins.

# Understanding the problem

Instead of choosing the first balloon to burst, choose the LAST balloon to burst in an interval `(left, right)`!

# Intuition

Pad array with 1 at both ends: `nums = [1] + nums + [1]`. Evaluate interval lengths from 2 to `n`. Choose balloon `k` burst last in `(left, right)`.

# Approach

1. Pad array with boundary 1s: `nums = [1] + nums + [1]`.
2. Create 2D DP matrix `dp` of size `n x n`.
3. Outer loop `length` from 2 to `n-1`; inner loop `left` from 0 to `n - length`; `right = left + length`.
4. Loop `k` from `left + 1` to `right - 1`: `coins = nums[left] * nums[k] * nums[right]`. Update `dp[left][right] = max(dp[left][right], dp[left][k] + coins + dp[k][right])`.
5. Return `dp[0][n - 1]`.

# Naive Solution — Recursion

Try every balloon as the first balloon to burst recursively.

```python filename:Python
class Solution:
    def maxCoins(self, nums):

        def dfs(nums):
            if not nums:
                return 0

            answer = 0

            for i in range(len(nums)):
                left = nums[i - 1] if i > 0 else 1
                right = nums[i + 1] if i + 1 < len(nums) else 1

                coins = (
                    left *
                    nums[i] *
                    right
                )

                remaining = nums[:i] + nums[i + 1:]

                answer = max(
                    answer,
                    coins + dfs(remaining)
                )

            return answer

        return dfs(nums)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxCoins(vector<int>& nums) {
        return dfs(nums);
    }

private:
    int dfs(vector<int> nums) {
        if (nums.empty()) return 0;

        int n = nums.size();
        int answer = 0;

        for (int i = 0; i < n; i++) {
            int left = i > 0 ? nums[i - 1] : 1;
            int right = i + 1 < n ? nums[i + 1] : 1;

            int coins = left * nums[i] * right;

            vector<int> remaining(nums.begin(), nums.begin() + i);
            remaining.insert(remaining.end(), nums.begin() + i + 1, nums.end());

            answer = max(answer, coins + dfs(remaining));
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxCoins(int[] nums) {
        List<Integer> list = new ArrayList<>();
        for (int num : nums) list.add(num);
        return dfs(list);
    }

    private int dfs(List<Integer> nums) {
        if (nums.isEmpty()) return 0;

        int n = nums.size();
        int answer = 0;

        for (int i = 0; i < n; i++) {
            int left = i > 0 ? nums.get(i - 1) : 1;
            int right = i + 1 < n ? nums.get(i + 1) : 1;

            int coins = left * nums.get(i) * right;

            List<Integer> remaining = new ArrayList<>(nums.subList(0, i));
            remaining.addAll(nums.subList(i + 1, n));

            answer = Math.max(answer, coins + dfs(remaining));
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var maxCoins = function(nums) {
    const dfs = (nums) => {
        if (nums.length === 0) return 0;

        let answer = 0;

        for (let i = 0; i < nums.length; i++) {
            const left = i > 0 ? nums[i - 1] : 1;
            const right = i + 1 < nums.length ? nums[i + 1] : 1;

            const coins = left * nums[i] * right;

            const remaining = [...nums.slice(0, i), ...nums.slice(i + 1)];

            answer = Math.max(answer, coins + dfs(remaining));
        }

        return answer;
    };

    return dfs(nums);
};
```

<strong>Time: Approximately O(n!) · Aux Space: O(n²)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxCoins(self, nums):

        nums = [1] + nums + [1]
        n = len(nums)

        dp = [
            [0] * n
            for _ in range(n)
        ]

        for length in range(2, n):

            for left in range(
                0,
                n - length
            ):
                right = left + length

                for k in range(
                    left + 1,
                    right
                ):
                    coins = (
                        nums[left]
                        * nums[k]
                        * nums[right]
                    )

                    dp[left][right] = max(
                        dp[left][right],
                        dp[left][k]
                        + coins
                        + dp[k][right]
                    )

        return dp[0][n - 1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxCoins(vector<int>& input) {
        vector<int> nums = {1};
        nums.insert(nums.end(), input.begin(), input.end());
        nums.push_back(1);

        int n = nums.size();
        vector<vector<int>> dp(n, vector<int>(n, 0));

        for (int length = 2; length < n; length++) {
            for (int left = 0; left < n - length; left++) {
                int right = left + length;

                for (int k = left + 1; k < right; k++) {
                    int coins = nums[left] * nums[k] * nums[right];

                    dp[left][right] = max(dp[left][right],
                                          dp[left][k] + coins + dp[k][right]);
                }
            }
        }

        return dp[0][n - 1];
    }
};
```

```java filename:Java
class Solution {
    public int maxCoins(int[] input) {
        int n = input.length + 2;
        int[] nums = new int[n];
        nums[0] = 1;
        nums[n - 1] = 1;
        for (int i = 0; i < input.length; i++) nums[i + 1] = input[i];

        int[][] dp = new int[n][n];

        for (int length = 2; length < n; length++) {
            for (int left = 0; left < n - length; left++) {
                int right = left + length;

                for (int k = left + 1; k < right; k++) {
                    int coins = nums[left] * nums[k] * nums[right];

                    dp[left][right] = Math.max(dp[left][right],
                                               dp[left][k] + coins + dp[k][right]);
                }
            }
        }

        return dp[0][n - 1];
    }
}
```

```javascript filename:JavaScript
var maxCoins = function(nums) {
    nums = [1, ...nums, 1];
    const n = nums.length;

    const dp = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let length = 2; length < n; length++) {
        for (let left = 0; left < n - length; left++) {
            const right = left + length;

            for (let k = left + 1; k < right; k++) {
                const coins = nums[left] * nums[k] * nums[right];

                dp[left][right] = Math.max(
                    dp[left][right],
                    dp[left][k] + coins + dp[k][right]
                );
            }
        }
    }

    return dp[0][n - 1];
};
```

<strong>Time: O(n³) · Space: O(n²)</strong>

# Takeaway

<strong>Interval DP → choose the last operation inside an interval.</strong> This is one of the most important advanced DP patterns.
