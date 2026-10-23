---
id: 52802cf3-3077-7361-b774-6b10c6021b23
key: problem:sheet-150/lc-45
subject: sheet-150
topic: greedy
title: Jump Game II
slug: jump-game-ii
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 45](https://leetcode.com/problems/jump-game-ii/)

# Problem

Given `nums`, return the minimum number of jumps to reach the last index. It is guaranteed you can always reach the end.

# Understanding the problem

Think of each jump as a BFS 'level'. Within the current jump's reach, find the position that extends the frontier farthest. When we exhaust the current level, increment jumps and start the next level.

# Intuition

Greedy BFS: treat each jump as expanding to the next 'level'. Within the current range `[prev_end+1 … current_end]`, find the furthest reach. When `i == current_end` you must jump — increment and extend.

# Approach

1. Initialize `jumps = 0`, `current_end = 0`, `farthest = 0`.
2. Iterate `i` from 0 to `n-2` (last index never needs a jump from it).
3. Update `farthest = max(farthest, i + nums[i])`.
4. When `i == current_end`: increment `jumps`, set `current_end = farthest`.
5. Return `jumps`.

# Naive Solution — Brute Force

DFS trying all jump lengths from each position, tracking minimum jumps.

```python filename:Python
class Solution:
    def jump(self, nums):
        n = len(nums)
        answer = float("inf")

        def dfs(index, jumps):
            nonlocal answer

            if index >= n - 1:
                answer = min(answer, jumps)
                return

            if jumps >= answer:
                return

            for jump in range(1, nums[index] + 1):
                dfs(index + jump, jumps + 1)

        dfs(0, 0)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int jump(vector<int>& nums) {
        answer = INT_MAX;
        dfs(nums, 0, 0);
        return answer;
    }

private:
    int answer;

    void dfs(vector<int>& nums, int index, int jumps) {
        int n = nums.size();

        if (index >= n - 1) {
            answer = min(answer, jumps);
            return;
        }

        if (jumps >= answer) {
            return;
        }

        for (int jump = 1; jump <= nums[index]; jump++) {
            dfs(nums, index + jump, jumps + 1);
        }
    }
};
```

```java filename:Java
class Solution {
    private int answer;

    public int jump(int[] nums) {
        answer = Integer.MAX_VALUE;
        dfs(nums, 0, 0);
        return answer;
    }

    private void dfs(int[] nums, int index, int jumps) {
        int n = nums.length;

        if (index >= n - 1) {
            answer = Math.min(answer, jumps);
            return;
        }

        if (jumps >= answer) {
            return;
        }

        for (int jump = 1; jump <= nums[index]; jump++) {
            dfs(nums, index + jump, jumps + 1);
        }
    }
}
```

```javascript filename:JavaScript
var jump = function(nums) {
    const n = nums.length;
    let answer = Infinity;

    const dfs = (index, jumps) => {
        if (index >= n - 1) {
            answer = Math.min(answer, jumps);
            return;
        }

        if (jumps >= answer) {
            return;
        }

        for (let jump = 1; jump <= nums[index]; jump++) {
            dfs(index + jump, jumps + 1);
        }
    };

    dfs(0, 0);

    return answer;
};
```

<strong>Time: O(2ⁿ) worst case · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def jump(self, nums):
        jumps = 0
        current_end = 0
        farthest = 0

        for i in range(len(nums) - 1):
            farthest = max(
                farthest,
                i + nums[i]
            )

            if i == current_end:
                jumps += 1
                current_end = farthest

        return jumps
```

```cpp filename:C%2B%2B
class Solution {
public:
    int jump(vector<int>& nums) {
        int jumps = 0;
        int currentEnd = 0;
        int farthest = 0;

        for (int i = 0; i < (int)nums.size() - 1; i++) {
            farthest = max(farthest, i + nums[i]);

            if (i == currentEnd) {
                jumps++;
                currentEnd = farthest;
            }
        }

        return jumps;
    }
};
```

```java filename:Java
class Solution {
    public int jump(int[] nums) {
        int jumps = 0;
        int currentEnd = 0;
        int farthest = 0;

        for (int i = 0; i < nums.length - 1; i++) {
            farthest = Math.max(farthest, i + nums[i]);

            if (i == currentEnd) {
                jumps++;
                currentEnd = farthest;
            }
        }

        return jumps;
    }
}
```

```javascript filename:JavaScript
var jump = function(nums) {
    let jumps = 0;
    let currentEnd = 0;
    let farthest = 0;

    for (let i = 0; i < nums.length - 1; i++) {
        farthest = Math.max(farthest, i + nums[i]);

        if (i === currentEnd) {
            jumps++;
            currentEnd = farthest;
        }
    }

    return jumps;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Greedy BFS Range — current range → next range (BFS compressed, no queue)
