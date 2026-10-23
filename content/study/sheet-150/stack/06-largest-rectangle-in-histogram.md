---
id: efc7e652-07a8-735e-8992-13c72fce4a9b
key: problem:sheet-150/lc-84
subject: sheet-150
topic: stack
title: Largest Rectangle in Histogram
slug: largest-rectangle-in-histogram
order: 6
---

Difficulty: <strong>Hard</strong> · [LeetCode 84](https://leetcode.com/problems/largest-rectangle-in-histogram/)

# Problem

Given an array of integers `heights` representing the histogram's bar height where width of each bar is 1, find the area of the largest rectangle in the histogram.

# Understanding the problem

For a bar at index `i` with height `h`, the max width rectangle extending this height spans between the Previous Smaller Element and Next Smaller Element.

# Intuition

Monotonic Increasing Stack storing bar indices. When a shorter bar is encountered, taller bars at top of stack can no longer extend rightward; pop and calculate rectangle area.

# Approach

1. Append sentinel `0` height to `heights` to flush stack at end.
2. Maintain monotonic increasing stack of bar indices.
3. When current `height < heights[stack[-1]]`:
4. Pop `h = heights[stack.pop()]`.
5. Left boundary is new `stack[-1]` if stack non-empty else `-1`.
6. Compute `width = current_index - left_boundary - 1` and update max area.
7. Push current index.

# Naive Solution — Brute Force

For every bar i, expand left and right pointers while bar heights are $\\ge heights\[i\]$, then compute area.

```python filename:Python
class Solution:
    def largestRectangleArea(self, heights):

        answer = 0
        n = len(heights)

        for i in range(n):

            left = i
            right = i

            while (
                left - 1 >= 0
                and heights[left - 1] >= heights[i]
            ):
                left -= 1

            while (
                right + 1 < n
                and heights[right + 1] >= heights[i]
            ):
                right += 1

            width = right - left + 1

            answer = max(
                answer,
                heights[i] * width
            )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int largestRectangleArea(vector<int>& heights) {
        int answer = 0;
        int n = heights.size();
        for (int i = 0; i < n; i++) {
            int left = i, right = i;
            while (left - 1 >= 0 && heights[left - 1] >= heights[i]) left--;
            while (right + 1 < n && heights[right + 1] >= heights[i]) right++;
            int width = right - left + 1;
            answer = max(answer, heights[i] * width);
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int largestRectangleArea(int[] heights) {
        int answer = 0;
        int n = heights.length;
        for (int i = 0; i < n; i++) {
            int left = i, right = i;
            while (left - 1 >= 0 && heights[left - 1] >= heights[i]) left--;
            while (right + 1 < n && heights[right + 1] >= heights[i]) right++;
            int width = right - left + 1;
            answer = Math.max(answer, heights[i] * width);
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var largestRectangleArea = function(heights) {
    let answer = 0;
    const n = heights.length;
    for (let i = 0; i < n; i++) {
        let left = i, right = i;
        while (left - 1 >= 0 && heights[left - 1] >= heights[i]) left--;
        while (right + 1 < n && heights[right + 1] >= heights[i]) right++;
        const width = right - left + 1;
        answer = Math.max(answer, heights[i] * width);
    }
    return answer;
};
```

<strong>Time: O(n²) · Space: O(1) aux</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def largestRectangleArea(self, heights):

        stack = []
        answer = 0

        heights.append(0)

        for i, height in enumerate(heights):

            while (
                stack
                and heights[stack[-1]] > height
            ):
                h = heights[stack.pop()]

                left_boundary = (
                    stack[-1]
                    if stack
                    else -1
                )

                width = (
                    i
                    - left_boundary
                    - 1
                )

                answer = max(
                    answer,
                    h * width
                )

            stack.append(i)

        heights.pop()

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int largestRectangleArea(vector<int>& heights) {
        stack<int> st;
        int answer = 0;
        heights.push_back(0);
        for (int i = 0; i < heights.size(); i++) {
            while (!st.empty() && heights[st.top()] > heights[i]) {
                int h = heights[st.top()];
                st.pop();
                int leftBoundary = st.empty() ? -1 : st.top();
                int width = i - leftBoundary - 1;
                answer = max(answer, h * width);
            }
            st.push(i);
        }
        heights.pop_back();
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int largestRectangleArea(int[] heights) {
        Deque<Integer> stack = new ArrayDeque<>();
        int answer = 0;
        int n = heights.length;
        for (int i = 0; i <= n; i++) {
            int height = i == n ? 0 : heights[i]; // sentinel 0 at the end
            while (!stack.isEmpty() && heights[stack.peek()] > height) {
                int h = heights[stack.pop()];
                int leftBoundary = stack.isEmpty() ? -1 : stack.peek();
                int width = i - leftBoundary - 1;
                answer = Math.max(answer, h * width);
            }
            stack.push(i);
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var largestRectangleArea = function(heights) {
    const stack = [];
    let answer = 0;
    heights.push(0);
    for (let i = 0; i < heights.length; i++) {
        while (stack.length && heights[stack[stack.length - 1]] > heights[i]) {
            const h = heights[stack.pop()];
            const leftBoundary = stack.length ? stack[stack.length - 1] : -1;
            const width = i - leftBoundary - 1;
            answer = Math.max(answer, h * width);
        }
        stack.push(i);
    }
    heights.pop();
    return answer;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Next / Previous Smaller Element → Monotonic Increasing Stack
