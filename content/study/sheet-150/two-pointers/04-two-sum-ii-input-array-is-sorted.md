---
id: e8a2b4e0-68d6-7a5a-aab7-31e537524fb3
key: problem:sheet-150/lc-167
subject: sheet-150
topic: two-pointers
title: Two Sum II — Input Array Is Sorted
slug: two-sum-ii-input-array-is-sorted
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 167](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/)

# Problem

Given a 1-indexed sorted array of integers `numbers`, find two numbers that add up to `target`.

# Understanding the problem

Array is already sorted in non-decreasing order.

# Intuition

Leverage sorted property: two pointers at ends. If sum &lt; target, increment left; if sum &gt; target, decrement right.

# Approach

1. Set `left = 0`, `right = len(numbers) - 1`.
2. Compute `total = numbers[left] + numbers[right]`.
3. If `total == target`, return 1-based indices `[left + 1, right + 1]`.
4. If `total < target`, move `left += 1`. Else move `right -= 1`.

# Naive Solution — Brute Force

Try every pair with two nested loops.

```python filename:Python
class Solution:
    def twoSum(self, numbers, target):
        for i in range(len(numbers)):
            for j in range(i + 1, len(numbers)):
                if numbers[i] + numbers[j] == target:
                    return [i + 1, j + 1]

        return []
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> twoSum(vector<int>& numbers, int target) {
        for (int i = 0; i < numbers.size(); i++)
            for (int j = i + 1; j < numbers.size(); j++)
                if (numbers[i] + numbers[j] == target)
                    return {i + 1, j + 1};
        return {};
    }
};
```

```java filename:Java
class Solution {
    public int[] twoSum(int[] numbers, int target) {
        for (int i = 0; i < numbers.length; i++)
            for (int j = i + 1; j < numbers.length; j++)
                if (numbers[i] + numbers[j] == target)
                    return new int[]{i + 1, j + 1};
        return new int[]{};
    }
}
```

```javascript filename:JavaScript
var twoSum = function(numbers, target) {
    for (let i = 0; i < numbers.length; i++)
        for (let j = i + 1; j < numbers.length; j++)
            if (numbers[i] + numbers[j] === target)
                return [i + 1, j + 1];
    return [];
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def twoSum(self, numbers, target):
        left = 0
        right = len(numbers) - 1

        while left < right:
            total = numbers[left] + numbers[right]

            if total == target:
                return [left + 1, right + 1]

            if total < target:
                left += 1
            else:
                right -= 1

        return []
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> twoSum(vector<int>& numbers, int target) {
        int left = 0, right = numbers.size() - 1;
        while (left < right) {
            int total = numbers[left] + numbers[right];
            if (total == target) return {left + 1, right + 1};
            if (total < target) left++;
            else right--;
        }
        return {};
    }
};
```

```java filename:Java
class Solution {
    public int[] twoSum(int[] numbers, int target) {
        int left = 0, right = numbers.length - 1;
        while (left < right) {
            int total = numbers[left] + numbers[right];
            if (total == target) return new int[]{left + 1, right + 1};
            if (total < target) left++;
            else right--;
        }
        return new int[]{};
    }
}
```

```javascript filename:JavaScript
var twoSum = function(numbers, target) {
    let left = 0, right = numbers.length - 1;
    while (left < right) {
        const total = numbers[left] + numbers[right];
        if (total === target) return [left + 1, right + 1];
        if (total < target) left++;
        else right--;
    }
    return [];
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Sorted array + Target Sum → Two Pointers
