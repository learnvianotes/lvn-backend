---
id: 6252105b-e669-71cf-af20-cf6b98361141
key: problem:sheet-150/lc-11
subject: sheet-150
topic: two-pointers
title: Container With Most Water
slug: container-with-most-water
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 11](https://leetcode.com/problems/container-with-most-water/)

# Problem

Given an integer array `height`, find two lines that together with the x-axis form a container containing the most water.

# Understanding the problem

`Area = (right - left) * min(height[left], height[right])`.

# Intuition

Start with widest pointers (left=0, right=n-1). To potentially increase area as width shrinks, move the pointer pointing to the shorter line.

# Approach

1. Place `left = 0`, `right = len(height) - 1`.
2. Compute `area = (right - left) * min(height[left], height[right])`.
3. Update `answer = max(answer, area)`.
4. If `height[left] < height[right]`, move `left += 1`; else `right -= 1`.

# Naive Solution — Brute Force

Check area between all pairs of vertical lines.

```python filename:Python
class Solution:
    def maxArea(self, height):
        answer = 0

        for i in range(len(height)):
            for j in range(i + 1, len(height)):
                width = j - i

                area = width * min(
                    height[i],
                    height[j]
                )

                answer = max(answer, area)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxArea(vector<int>& height) {
        int answer = 0;
        for (int i = 0; i < height.size(); i++)
            for (int j = i + 1; j < height.size(); j++) {
                int width = j - i;
                int area = width * min(height[i], height[j]);
                answer = max(answer, area);
            }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxArea(int[] height) {
        int answer = 0;
        for (int i = 0; i < height.length; i++)
            for (int j = i + 1; j < height.length; j++) {
                int width = j - i;
                int area = width * Math.min(height[i], height[j]);
                answer = Math.max(answer, area);
            }
        return answer;
    }
}
```

```javascript filename:JavaScript
var maxArea = function(height) {
    let answer = 0;
    for (let i = 0; i < height.length; i++)
        for (let j = i + 1; j < height.length; j++) {
            const width = j - i;
            const area = width * Math.min(height[i], height[j]);
            answer = Math.max(answer, area);
        }
    return answer;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxArea(self, height):
        left = 0
        right = len(height) - 1

        answer = 0

        while left < right:
            width = right - left

            area = width * min(
                height[left],
                height[right]
            )

            answer = max(answer, area)

            if height[left] < height[right]:
                left += 1
            else:
                right -= 1

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxArea(vector<int>& height) {
        int left = 0, right = height.size() - 1;
        int answer = 0;
        while (left < right) {
            int width = right - left;
            int area = width * min(height[left], height[right]);
            answer = max(answer, area);
            if (height[left] < height[right]) left++;
            else right--;
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxArea(int[] height) {
        int left = 0, right = height.length - 1;
        int answer = 0;
        while (left < right) {
            int width = right - left;
            int area = width * Math.min(height[left], height[right]);
            answer = Math.max(answer, area);
            if (height[left] < height[right]) left++;
            else right--;
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var maxArea = function(height) {
    let left = 0, right = height.length - 1;
    let answer = 0;
    while (left < right) {
        const width = right - left;
        const area = width * Math.min(height[left], height[right]);
        answer = Math.max(answer, area);
        if (height[left] < height[right]) left++;
        else right--;
    }
    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Shrinking width → Discard pointer with smaller height
