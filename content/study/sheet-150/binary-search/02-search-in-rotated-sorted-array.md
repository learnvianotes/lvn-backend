---
id: 8d525eea-4922-7706-9628-69fec692e62c
key: problem:sheet-150/lc-33
subject: sheet-150
topic: binary-search
title: Search in Rotated Sorted Array
slug: search-in-rotated-sorted-array
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 33](https://leetcode.com/problems/search-in-rotated-sorted-array/)

# Problem

Given array `nums` rotated at an unknown pivot and integer `target`, return index of `target` or -1 in $O(\\log n)$ time.

# Understanding the problem

At least one half of the array (left or right) is guaranteed to be strictly sorted at any step.

# Intuition

Check if `nums[left] <= nums[mid]`. If True, left half is sorted: check if target is inside `[nums[left], nums[mid])`. Else right half is sorted: check if target is inside `(nums[mid], nums[right]]`.

# Approach

1. Set `left = 0`, `right = len(nums) - 1`.
2. Loop while `left <= right`:
3. If `nums[mid] == target`, return `mid`.
4. If `nums[left] <= nums[mid]` (Left half sorted):
5. If `nums[left] <= target < nums[mid]`, move `right = mid - 1`; else `left = mid + 1`.
6. Else (Right half sorted):
7. If `nums[mid] < target <= nums[right]`, move `left = mid + 1`; else `right = mid - 1`.

# Naive Solution — Brute Force

Linear scan checking each element.

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

            # Left half is sorted
            if nums[left] <= nums[mid]:

                if nums[left] <= target < nums[mid]:
                    right = mid - 1
                else:
                    left = mid + 1

            # Right half is sorted
            else:

                if nums[mid] < target <= nums[right]:
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

            // Left half is sorted
            if (nums[left] <= nums[mid]) {
                if (nums[left] <= target && target < nums[mid]) {
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            }
            // Right half is sorted
            else {
                if (nums[mid] < target && target <= nums[right]) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
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

            // Left half is sorted
            if (nums[left] <= nums[mid]) {
                if (nums[left] <= target && target < nums[mid]) {
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            }
            // Right half is sorted
            else {
                if (nums[mid] < target && target <= nums[right]) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
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

        // Left half is sorted
        if (nums[left] <= nums[mid]) {
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        // Right half is sorted
        else {
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
    }

    return -1;
};
```

<strong>Time: O(log n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Rotated array → Identify sorted half → Binary search boundary
