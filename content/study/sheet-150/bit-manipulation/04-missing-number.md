---
id: 74583a21-6c57-7594-b996-0e8fa55331e4
key: problem:sheet-150/lc-268
subject: sheet-150
topic: bit-manipulation
title: Missing Number
slug: missing-number
order: 4
---

Difficulty: <strong>Easy</strong> · [LeetCode 268](https://leetcode.com/problems/missing-number/)

# Problem

Given an array containing `n` distinct numbers from `[0, n]`, return the one missing number.

# Understanding the problem

XOR the complete range `0..n` with every element of the array. Present numbers cancel in pairs; only the missing number has no partner to cancel with.

# Intuition

Start with `answer = n`. For each index `i`, XOR in both `i` and `nums[i]`. Every index 0..n-1 is covered, and each present number cancels. The missing number survives.

# Approach

1. Initialize `answer = n`.
2. For `i, num` in `enumerate(nums)`: `answer ^= i`, `answer ^= num`.
3. Return `answer`.

# Naive Solution — Brute Force

Put all numbers in a set; scan 0..n for the missing one.

```python filename:Python
class Solution:
    def missingNumber(self, nums):
        n = len(nums)
        values = set(nums)

        for num in range(n + 1):
            if num not in values:
                return num

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int missingNumber(vector<int>& nums) {
        int n = nums.size();
        unordered_set<int> values(nums.begin(), nums.end());

        for (int num = 0; num <= n; num++) {
            if (!values.count(num)) {
                return num;
            }
        }

        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int missingNumber(int[] nums) {
        int n = nums.length;
        Set<Integer> values = new HashSet<>();
        for (int num : nums) {
            values.add(num);
        }

        for (int num = 0; num <= n; num++) {
            if (!values.contains(num)) {
                return num;
            }
        }

        return -1;
    }
}
```

```javascript filename:JavaScript
var missingNumber = function(nums) {
    const n = nums.length;
    const values = new Set(nums);

    for (let num = 0; num <= n; num++) {
        if (!values.has(num)) {
            return num;
        }
    }

    return -1;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def missingNumber(self, nums):
        n = len(nums)
        answer = n

        for i, num in enumerate(nums):
            answer ^= i
            answer ^= num

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int missingNumber(vector<int>& nums) {
        int n = nums.size();
        int answer = n;

        for (int i = 0; i < n; i++) {
            answer ^= i;
            answer ^= nums[i];
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int missingNumber(int[] nums) {
        int n = nums.length;
        int answer = n;

        for (int i = 0; i < n; i++) {
            answer ^= i;
            answer ^= nums[i];
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var missingNumber = function(nums) {
    const n = nums.length;
    let answer = n;

    for (let i = 0; i < n; i++) {
        answer ^= i;
        answer ^= nums[i];
    }

    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Missing value in known range → XOR complete range with array (also solvable as sum(0..n) - sum(nums))
