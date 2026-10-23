---
id: 4f808d09-798c-7ec2-8e90-9316e547e3cc
key: problem:sheet-150/lc-287
subject: sheet-150
topic: linked-list
title: Find the Duplicate Number
slug: find-the-duplicate-number
order: 11
---

Difficulty: <strong>Medium</strong> · [LeetCode 287](https://leetcode.com/problems/find-the-duplicate-number/)

# Problem

Given an array of integers `nums` containing `n + 1` integers where each integer is in range `[1, n]`, find the duplicate number without modifying array in O(1) space.

# Understanding the problem

Map array indices to values as an implicit linked list: `index -> nums[index]`.

# Intuition

Treat array as implicit linked list. The duplicate number represents the entrance to a cycle. Apply Floyd's Cycle Detection in 2 phases.

# Approach

1. Phase 1: `slow = nums[0]`, `fast = nums[0]`. Move `slow = nums[slow]` and `fast = nums[nums[fast]]` until they meet.
2. Phase 2: Reset `slow = nums[0]`. Advance both pointers 1 step at a time until they meet at cycle entry point.
3. Return entry point value.

# Naive Solution — Brute Force

Use a hash set to track seen numbers.

```python filename:Python
class Solution:
    def findDuplicate(self, nums):
        seen = set()

        for num in nums:
            if num in seen:
                return num

            seen.add(num)

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findDuplicate(vector<int>& nums) {
        unordered_set<int> seen;
        for (auto num : nums) {
            if (seen.count(num)) {
                return num;
            }
            seen.insert(num);
        }
        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int findDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int num : nums) {
            if (seen.contains(num)) {
                return num;
            }
            seen.add(num);
        }
        return -1;
    }
}
```

```javascript filename:JavaScript
var findDuplicate = function(nums) {
    const seen = new Set();

    for (const num of nums) {
        if (seen.has(num)) {
            return num;
        }

        seen.add(num);
    }

    return -1;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def findDuplicate(self, nums):
        slow = nums[0]
        fast = nums[0]

        while True:
            slow = nums[slow]
            fast = nums[nums[fast]]

            if slow == fast:
                break

        slow = nums[0]

        while slow != fast:
            slow = nums[slow]
            fast = nums[fast]

        return slow
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findDuplicate(vector<int>& nums) {
        int slow = nums[0];
        int fast = nums[0];

        while (true) {
            slow = nums[slow];
            fast = nums[nums[fast]];

            if (slow == fast) {
                break;
            }
        }

        slow = nums[0];

        while (slow != fast) {
            slow = nums[slow];
            fast = nums[fast];
        }

        return slow;
    }
};
```

```java filename:Java
class Solution {
    public int findDuplicate(int[] nums) {
        int slow = nums[0];
        int fast = nums[0];

        while (true) {
            slow = nums[slow];
            fast = nums[nums[fast]];

            if (slow == fast) {
                break;
            }
        }

        slow = nums[0];

        while (slow != fast) {
            slow = nums[slow];
            fast = nums[fast];
        }

        return slow;
    }
}
```

```javascript filename:JavaScript
var findDuplicate = function(nums) {
    let slow = nums[0];
    let fast = nums[0];

    while (true) {
        slow = nums[slow];
        fast = nums[nums[fast]];

        if (slow === fast) {
            break;
        }
    }

    slow = nums[0];

    while (slow !== fast) {
        slow = nums[slow];
        fast = nums[fast];
    }

    return slow;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Array index mapping as Implicit Linked List Cycle Detection
