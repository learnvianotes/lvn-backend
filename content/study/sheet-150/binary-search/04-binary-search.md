---
id: 762a3f8a-1b32-790b-bc27-f6dbdf13c3e5
key: problem:sheet-150/lc-704
subject: sheet-150
topic: binary-search
title: Binary Search
slug: binary-search
order: 4
---

Difficulty: <strong>Easy</strong> · [LeetCode 704](https://leetcode.com/problems/binary-search/)

# Problem

Given an array of integers `nums` sorted in ascending order and a target integer `target`, write a function to search target in `nums`. Return index if present else -1.

# Understanding the problem

Eliminate half of the remaining search space on each step in a sorted array.

# Intuition

Use two pointers `left` and `right`. Calculate `mid = left + (right - left) // 2`. If `nums[mid] == target` return `mid`, else adjust boundaries.

# Approach

1. Initialize `left = 0`, `right = len(nums) - 1`.
2. Loop while `left <= right`:
3. Compute `mid = left + (right - left) // 2`.
4. If `nums[mid] == target`, return `mid`.
5. If `nums[mid] < target`, set `left = mid + 1`.
6. Else, set `right = mid - 1`.
7. Return `-1` if target not found.

# Naive Solution — Brute Force

Scan every element linearly from index 0 to n-1.

```python filename:Python
class Solution:
    def search(self, nums, target):
        for i, num in enumerate(nums):
            if num == target:
                return i

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int search(vector<int>& nums, int target) {
        for (int i = 0; i < nums.size(); i++) {
            if (nums[i] == target) {
                return i;
            }
        }

        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int search(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] == target) {
                return i;
            }
        }

        return -1;
    }
}
```

```javascript filename:JavaScript
var search = function(nums, target) {
    for (let i = 0; i < nums.length; i++) {
        if (nums[i] === target) {
            return i;
        }
    }

    return -1;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def search(self, nums, target):
        left = 0
        right = len(nums) - 1

        while left <= right:
            mid = left + (right - left) // 2

            if nums[mid] == target:
                return mid

            if nums[mid] < target:
                left = mid + 1
            else:
                right = mid - 1

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int search(vector<int>& nums, int target) {
        int left = 0;
        int right = nums.size() - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;

            if (nums[mid] == target) {
                return mid;
            }

            if (nums[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int search(int[] nums, int target) {
        int left = 0;
        int right = nums.length - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;

            if (nums[mid] == target) {
                return mid;
            }

            if (nums[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return -1;
    }
}
```

```javascript filename:JavaScript
var search = function(nums, target) {
    let left = 0;
    let right = nums.length - 1;

    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);

        if (nums[mid] === target) {
            return mid;
        }

        if (nums[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return -1;
};
```

<strong>Time: O(log n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Sorted array → Eliminate half → Standard Binary Search
