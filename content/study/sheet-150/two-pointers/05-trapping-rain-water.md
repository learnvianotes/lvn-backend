---
id: 0fba9849-2a57-7924-a35d-8c7983ceb416
key: problem:sheet-150/lc-42
subject: sheet-150
topic: two-pointers
title: Trapping Rain Water
slug: trapping-rain-water
order: 5
---

Difficulty: <strong>Hard</strong> · [LeetCode 42](https://leetcode.com/problems/trapping-rain-water/)

# Problem

Given `n` non-negative integers representing an elevation map where width of each bar is 1, compute how much water it can trap after raining.

# Understanding the problem

Water trapped at index `i` = `min(max_left, max_right) - height[i]`.

# Intuition

Prefix/Suffix arrays give max left/right in O(n) space. Compress prefix/suffix into Two Pointers with running max variables for O(1) space.

# Approach

1. Maintain `left = 0`, `right = n - 1`, and running `left_max`, `right_max`.
2. If `height[left] <= height[right]`, update `left_max` or add `left_max - height[left]`, then `left += 1`.
3. Else, update `right_max` or add `right_max - height[right]`, then `right -= 1`.

# Naive Solution — Brute Force

For every position, scan left and right to find maximum wall heights.

```python filename:Python
class Solution:
    def trap(self, height):
        water = 0
        n = len(height)

        for i in range(n):
            left_max = max(height[:i + 1])
            right_max = max(height[i:])

            water += min(
                left_max,
                right_max
            ) - height[i]

        return water
```

```cpp filename:C%2B%2B
class Solution {
public:
    int trap(vector<int>& height) {
        int water = 0;
        int n = height.size();
        for (int i = 0; i < n; i++) {
            int leftMax = *max_element(height.begin(), height.begin() + i + 1);
            int rightMax = *max_element(height.begin() + i, height.end());
            water += min(leftMax, rightMax) - height[i];
        }
        return water;
    }
};
```

```java filename:Java
class Solution {
    public int trap(int[] height) {
        int water = 0;
        int n = height.length;
        for (int i = 0; i < n; i++) {
            int leftMax = 0, rightMax = 0;
            for (int j = 0; j <= i; j++) leftMax = Math.max(leftMax, height[j]);
            for (int j = i; j < n; j++) rightMax = Math.max(rightMax, height[j]);
            water += Math.min(leftMax, rightMax) - height[i];
        }
        return water;
    }
}
```

```javascript filename:JavaScript
var trap = function(height) {
    let water = 0;
    const n = height.length;
    for (let i = 0; i < n; i++) {
        const leftMax = Math.max(...height.slice(0, i + 1));
        const rightMax = Math.max(...height.slice(i));
        water += Math.min(leftMax, rightMax) - height[i];
    }
    return water;
};
```

<strong>Time: O(n²) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def trap(self, height):
        left = 0
        right = len(height) - 1

        left_max = 0
        right_max = 0

        water = 0

        while left < right:

            if height[left] <= height[right]:

                if height[left] >= left_max:
                    left_max = height[left]
                else:
                    water += left_max - height[left]

                left += 1

            else:

                if height[right] >= right_max:
                    right_max = height[right]
                else:
                    water += right_max - height[right]

                right -= 1

        return water
```

```cpp filename:C%2B%2B
class Solution {
public:
    int trap(vector<int>& height) {
        int left = 0, right = height.size() - 1;
        int leftMax = 0, rightMax = 0;
        int water = 0;
        while (left < right) {
            if (height[left] <= height[right]) {
                if (height[left] >= leftMax) leftMax = height[left];
                else water += leftMax - height[left];
                left++;
            } else {
                if (height[right] >= rightMax) rightMax = height[right];
                else water += rightMax - height[right];
                right--;
            }
        }
        return water;
    }
};
```

```java filename:Java
class Solution {
    public int trap(int[] height) {
        int left = 0, right = height.length - 1;
        int leftMax = 0, rightMax = 0;
        int water = 0;
        while (left < right) {
            if (height[left] <= height[right]) {
                if (height[left] >= leftMax) leftMax = height[left];
                else water += leftMax - height[left];
                left++;
            } else {
                if (height[right] >= rightMax) rightMax = height[right];
                else water += rightMax - height[right];
                right--;
            }
        }
        return water;
    }
}
```

```javascript filename:JavaScript
var trap = function(height) {
    let left = 0, right = height.length - 1;
    let leftMax = 0, rightMax = 0;
    let water = 0;
    while (left < right) {
        if (height[left] <= height[right]) {
            if (height[left] >= leftMax) leftMax = height[left];
            else water += leftMax - height[left];
            left++;
        } else {
            if (height[right] >= rightMax) rightMax = height[right];
            else water += rightMax - height[right];
            right--;
        }
    }
    return water;
};
```

<strong>Time: O(n) · Aux Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Prefix/Suffix information compressed into Two Pointers + running max state
