---
id: 18b5b959-7b82-7f37-a0e1-108608634c8d
key: problem:sheet-150/lc-78
subject: sheet-150
topic: backtracking
title: Subsets
slug: subsets
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 78](https://leetcode.com/problems/subsets/)

# Problem

Given an integer array `nums` containing unique elements, return all possible subsets (the power set). The solution must not contain duplicate subsets. The subsets can be returned in any order.

# Understanding the problem

For every element, we have two decisions: take or don't take. For n elements, there are 2^n possible subsets. Both naive binary decision-tree traversal and loop-based incremental backtracking generate all 2^n subsets.

# Intuition

The standard optimized backtracking version builds subsets incrementally. At each level of recursion, append the current path to result, then try adding each remaining candidate starting from `start` index.

# Approach

1. Define `backtrack(start, current)`.
2. Every `current` state is a valid subset, so append a copy to `result`.
3. Loop `i` from `start` to `len(nums) - 1`.
4. Append `nums[i]` to `current`.
5. Recurse with `backtrack(i + 1, current)`.
6. Pop `nums[i]` to backtrack.

# Naive Solution

Generate every subset by recursively deciding whether to take or not take each element.

```python filename:Python
class Solution:
    def subsets(self, nums):
        result = []

        def backtrack(index, current):
            if index == len(nums):
                result.append(current[:])
                return

            # Don't take nums[index]
            backtrack(index + 1, current)

            # Take nums[index]
            current.append(nums[index])
            backtrack(index + 1, current)
            current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> subsets(vector<int>& nums) {
        vector<vector<int>> result;
        vector<int> current;
        backtrack(nums, 0, current, result);
        return result;
    }

private:
    void backtrack(vector<int>& nums, int index, vector<int>& current, vector<vector<int>>& result) {
        if (index == (int)nums.size()) {
            result.push_back(current);
            return;
        }

        // Don't take nums[index]
        backtrack(nums, index + 1, current, result);

        // Take nums[index]
        current.push_back(nums[index]);
        backtrack(nums, index + 1, current, result);
        current.pop_back();
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] nums, int index, List<Integer> current, List<List<Integer>> result) {
        if (index == nums.length) {
            result.add(new ArrayList<>(current));
            return;
        }

        // Don't take nums[index]
        backtrack(nums, index + 1, current, result);

        // Take nums[index]
        current.add(nums[index]);
        backtrack(nums, index + 1, current, result);
        current.remove(current.size() - 1);
    }
}
```

```javascript filename:JavaScript
var subsets = function(nums) {
    const result = [];

    const backtrack = (index, current) => {
        if (index === nums.length) {
            result.push([...current]);
            return;
        }

        // Don't take nums[index]
        backtrack(index + 1, current);

        // Take nums[index]
        current.push(nums[index]);
        backtrack(index + 1, current);
        current.pop();
    };

    backtrack(0, []);
    return result;
};
```

<strong>Time: O(n × 2^n) · Aux Space: O(n) recursion + current path · Output Space: O(n × 2^n)</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def subsets(self, nums):
        result = []

        def backtrack(start, current):
            result.append(current[:])

            for i in range(start, len(nums)):
                current.append(nums[i])
                backtrack(i + 1, current)
                current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> subsets(vector<int>& nums) {
        vector<vector<int>> result;
        vector<int> current;
        backtrack(nums, 0, current, result);
        return result;
    }

private:
    void backtrack(vector<int>& nums, int start, vector<int>& current, vector<vector<int>>& result) {
        result.push_back(current);

        for (int i = start; i < (int)nums.size(); i++) {
            current.push_back(nums[i]);
            backtrack(nums, i + 1, current, result);
            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
        result.add(new ArrayList<>(current));

        for (int i = start; i < nums.length; i++) {
            current.add(nums[i]);
            backtrack(nums, i + 1, current, result);
            current.remove(current.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var subsets = function(nums) {
    const result = [];

    const backtrack = (start, current) => {
        result.push([...current]);

        for (let i = start; i < nums.length; i++) {
            current.push(nums[i]);
            backtrack(i + 1, current);
            current.pop();
        }
    };

    backtrack(0, []);
    return result;
};
```

<strong>Time: O(n × 2^n) · Aux Space: O(n) · Output Space: O(n × 2^n)</strong>

# Takeaway

Both have the same asymptotic complexity. The optimized version has a cleaner subset-generation pattern.
