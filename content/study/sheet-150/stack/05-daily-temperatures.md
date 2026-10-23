---
id: 21688eee-4853-7462-885f-728e4131252f
key: problem:sheet-150/lc-739
subject: sheet-150
topic: stack
title: Daily Temperatures
slug: daily-temperatures
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 739](https://leetcode.com/problems/daily-temperatures/)

# Problem

Given an array of integers `temperatures`, return an array `answer` such that `answer[i]` is the number of days you have to wait after the `i`th day to get a warmer temperature.

# Understanding the problem

Find the index distance to the Next Greater Element for each index.

# Intuition

Monotonic Decreasing Stack storing indices. When current temperature &gt; temperature at top index, pop index and compute day gap `curr_index - prev_index`.

# Approach

1. Initialize `result = [0] * len(temperatures)` and empty `stack`.
2. Iterate index `i` and `temperature`.
3. While `stack` and `temperature > temperatures[stack[-1]]`:
4. Pop `prev_index = stack.pop()`.
5. Set `result[prev_index] = i - prev_index`.
6. Push current index `i` onto stack.

# Naive Solution — Brute Force

For each day i, iterate through future days j = i+1 ... n-1 until a warmer temperature is found.

```python filename:Python
class Solution:
    def dailyTemperatures(self, temperatures):
        n = len(temperatures)
        result = [0] * n

        for i in range(n):

            for j in range(i + 1, n):

                if temperatures[j] > temperatures[i]:
                    result[i] = j - i
                    break

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        int n = temperatures.size();
        vector<int> result(n, 0);
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++)
                if (temperatures[j] > temperatures[i]) {
                    result[i] = j - i;
                    break;
                }
        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int n = temperatures.length;
        int[] result = new int[n];
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++)
                if (temperatures[j] > temperatures[i]) {
                    result[i] = j - i;
                    break;
                }
        return result;
    }
}
```

```javascript filename:JavaScript
var dailyTemperatures = function(temperatures) {
    const n = temperatures.length;
    const result = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
            if (temperatures[j] > temperatures[i]) {
                result[i] = j - i;
                break;
            }
    return result;
};
```

<strong>Time: O(n²) · Space: O(1) aux</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def dailyTemperatures(self, temperatures):

        result = [0] * len(temperatures)

        stack = []

        for i, temperature in enumerate(temperatures):

            while (
                stack
                and temperature > temperatures[stack[-1]]
            ):
                previous = stack.pop()

                result[previous] = i - previous

            stack.append(i)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        vector<int> result(temperatures.size(), 0);
        stack<int> st;
        for (int i = 0; i < temperatures.size(); i++) {
            while (!st.empty() && temperatures[i] > temperatures[st.top()]) {
                int previous = st.top();
                st.pop();
                result[previous] = i - previous;
            }
            st.push(i);
        }
        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int[] result = new int[temperatures.length];
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < temperatures.length; i++) {
            while (!stack.isEmpty() && temperatures[i] > temperatures[stack.peek()]) {
                int previous = stack.pop();
                result[previous] = i - previous;
            }
            stack.push(i);
        }
        return result;
    }
}
```

```javascript filename:JavaScript
var dailyTemperatures = function(temperatures) {
    const result = new Array(temperatures.length).fill(0);
    const stack = [];
    for (let i = 0; i < temperatures.length; i++) {
        while (stack.length && temperatures[i] > temperatures[stack[stack.length - 1]]) {
            const previous = stack.pop();
            result[previous] = i - previous;
        }
        stack.push(i);
    }
    return result;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Next Greater Element → Monotonic Decreasing Stack
