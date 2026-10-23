---
id: 0be98f05-478b-769a-a70a-7f822bb359e8
key: problem:sheet-150/lc-153
subject: sheet-150
topic: binary-search
title: Find Minimum in Rotated Sorted Array
slug: find-minimum-in-rotated-sorted-array
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 153](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/)

# Problem

Given sorted rotated array of unique elements `nums`, return the minimum element in $O(\\log n)$ time.

# Understanding the problem

The minimum element is the pivot point separating the two sorted halves.

# Intuition

Compare `nums[mid]` against the right boundary `nums[right]`. If `nums[mid] > nums[right]`, minimum lies in right half; else minimum lies in left half including `mid`.

# Approach

1. Set `left = 0`, `right = len(nums) - 1`.
2. Loop while `left < right`:
3. Compute `mid = left + (right - left) // 2`.
4. If `nums[mid] > nums[right]`: minimum must be in right half `left = mid + 1`.
5. Else: minimum could be `mid` or to the left `right = mid`.
6. Return `nums[left]`.

# Naive Solution — Brute Force

Linear scan keeping track of minimum value.

```python filename:Python
class Solution:
    def findMin(self, nums):
        answer = nums[0]

        for num in nums:
            answer = min(answer, num)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findMin(vector<int>& nums) {
        int answer = nums[0];

        for (int num : nums) {
            answer = min(answer, num);
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int findMin(int[] nums) {
        int answer = nums[0];

        for (int num : nums) {
            answer = Math.min(answer, num);
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var findMin = function(nums) {
    let answer = nums[0];

    for (const num of nums) {
        answer = Math.min(answer, num);
    }

    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def findMin(self, nums):

        left = 0
        right = len(nums) - 1

        while left < right:

            mid = left + (right - left) // 2

            if nums[mid] > nums[right]:
                left = mid + 1
            else:
                right = mid

        return nums[left]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findMin(vector<int>& nums) {
        int left = 0;
        int right = nums.size() - 1;

        while (left < right) {
            int mid = left + (right - left) / 2;

            if (nums[mid] > nums[right]) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }

        return nums[left];
    }
};
```

```java filename:Java
class Solution {
    public int findMin(int[] nums) {
        int left = 0;
        int right = nums.length - 1;

        while (left < right) {
            int mid = left + (right - left) / 2;

            if (nums[mid] > nums[right]) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }

        return nums[left];
    }
}
```

```javascript filename:JavaScript
var findMin = function(nums) {
    let left = 0;
    let right = nums.length - 1;

    while (left < right) {
        const mid = left + Math.floor((right - left) / 2);

        if (nums[mid] > nums[right]) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    return nums[left];
};
```

<strong>Time: O(log n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Rotated sorted array → Compare mid with right boundary
