---
id: 1fc1d7fa-4c60-7e8d-8e51-5a6b637561fd
key: problem:sheet-150/lc-239
subject: sheet-150
topic: sliding-window
title: Sliding Window Maximum
slug: sliding-window-maximum
order: 2
---

Difficulty: <strong>Hard</strong> · [LeetCode 239](https://leetcode.com/problems/sliding-window-maximum/)

# Problem

Given an array `nums` and sliding window size `k`, return maximum element in each moving window.

# Understanding the problem

Find max value for each contiguous slice of size `k`.

# Intuition

Monotonic Decreasing Deque: store indices whose values are strictly decreasing. Front of deque always holds index of max element.

# Approach

1. Use `deque` storing indices.
2. Before inserting `right`, pop indices from back whose values &lt;= `nums[right]`.
3. Pop front index if it falls outside current window `deque[0] < right - k + 1`.
4. Append `nums[deque[0]]` to result once `right >= k - 1`.

# Naive Solution — Brute Force

Extract sub-array slice of size k and compute max(slice).

```python filename:Python
class Solution:
    def maxSlidingWindow(self, nums, k):
        result = []

        for i in range(
            len(nums) - k + 1
        ):
            result.append(
                max(nums[i:i + k])
            )

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> maxSlidingWindow(vector<int>& nums, int k) {
        vector<int> result;
        for (int i = 0; i + k <= (int)nums.size(); i++)
            result.push_back(*max_element(nums.begin() + i, nums.begin() + i + k));
        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        int[] result = new int[nums.length - k + 1];
        for (int i = 0; i + k <= nums.length; i++) {
            int best = nums[i];
            for (int j = i + 1; j < i + k; j++) best = Math.max(best, nums[j]);
            result[i] = best;
        }
        return result;
    }
}
```

```javascript filename:JavaScript
var maxSlidingWindow = function(nums, k) {
    const result = [];
    for (let i = 0; i + k <= nums.length; i++)
        result.push(Math.max(...nums.slice(i, i + k)));
    return result;
};
```

<strong>Time: O(nk) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def maxSlidingWindow(self, nums, k):
        result = []
        deque_indices = deque()

        for right in range(len(nums)):

            # Remove smaller values
            while (
                deque_indices
                and nums[deque_indices[-1]]
                <= nums[right]
            ):
                deque_indices.pop()

            deque_indices.append(right)

            # Remove indices outside window
            left = right - k + 1

            if deque_indices[0] < left:
                deque_indices.popleft()

            if right >= k - 1:
                result.append(
                    nums[deque_indices[0]]
                )

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> maxSlidingWindow(vector<int>& nums, int k) {
        vector<int> result;
        deque<int> dq;
        for (int right = 0; right < nums.size(); right++) {
            // Remove smaller values
            while (!dq.empty() && nums[dq.back()] <= nums[right]) dq.pop_back();
            dq.push_back(right);
            // Remove indices outside window
            int left = right - k + 1;
            if (dq.front() < left) dq.pop_front();
            if (right >= k - 1) result.push_back(nums[dq.front()]);
        }
        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        int[] result = new int[nums.length - k + 1];
        Deque<Integer> dq = new ArrayDeque<>();
        for (int right = 0; right < nums.length; right++) {
            // Remove smaller values
            while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[right]) dq.pollLast();
            dq.offerLast(right);
            // Remove indices outside window
            int left = right - k + 1;
            if (dq.peekFirst() < left) dq.pollFirst();
            if (right >= k - 1) result[left] = nums[dq.peekFirst()];
        }
        return result;
    }
}
```

```javascript filename:JavaScript
var maxSlidingWindow = function(nums, k) {
    const result = [];
    const dq = [];
    let head = 0; // dq[head..] is the live deque
    for (let right = 0; right < nums.length; right++) {
        // Remove smaller values
        while (dq.length > head && nums[dq[dq.length - 1]] <= nums[right]) dq.pop();
        dq.push(right);
        // Remove indices outside window
        const left = right - k + 1;
        if (dq[head] < left) head++;
        if (right >= k - 1) result.push(nums[dq[head]]);
    }
    return result;
};
```

<strong>Time: O(n) · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Max/Min over moving window → Monotonic Deque
