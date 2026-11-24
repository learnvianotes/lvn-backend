---
id: b1c3d7ae-5c8d-7150-bac0-412cef4cc6e9
key: problem:sheet-150/lc-46
subject: sheet-150
topic: backtracking
title: Permutations
slug: permutations
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 46](https://leetcode.com/problems/permutations/)

# Problem

Generate all permutations of distinct numbers.

# Understanding the problem

Drawing tokens in different orders creates distinct permutations (n! arrangements). At each level, choose an unused element.

# Intuition

Use a boolean `used[]` array to keep track of used elements in O(1) time instead of checking membership in current path.

# Approach

1. Initialize `used = [False] * len(nums)`.
2. Define `backtrack(current)`.
3. If `len(current) == len(nums)`, append copy to `result`.
4. Loop `i` from `0` to `len(nums) - 1`. If `used[i]`, skip.
5. Set `used[i] = True`, append `nums[i]`, recurse, pop, and set `used[i] = False`.

# Naive Solution

At every level, scan the entire array and choose an unused element using `if num in current`, which costs O(n) per check.

```python filename:Python
class Solution:
    def permute(self, nums):
        result = []

        def backtrack(current):
            if len(current) == len(nums):
                result.append(current[:])
                return

            for num in nums:
                if num in current:
                    continue

                current.append(num)
                backtrack(current)
                current.pop()

        backtrack([])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> permute(vector<int>& nums) {
        vector<vector<int>> result;
        vector<int> current;
        backtrack(nums, current, result);
        return result;
    }

private:
    void backtrack(vector<int>& nums, vector<int>& current, vector<vector<int>>& result) {
        if (current.size() == nums.size()) {
            result.push_back(current);
            return;
        }

        for (int num : nums) {
            if (find(current.begin(), current.end(), num) != current.end()) continue;

            current.push_back(num);
            backtrack(nums, current, result);
            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(nums, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] nums, List<Integer> current, List<List<Integer>> result) {
        if (current.size() == nums.length) {
            result.add(new ArrayList<>(current));
            return;
        }

        for (int num : nums) {
            if (current.contains(num)) continue;

            current.add(num);
            backtrack(nums, current, result);
            current.remove(current.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var permute = function(nums) {
    const result = [];

    const backtrack = (current) => {
        if (current.length === nums.length) {
            result.push([...current]);
            return;
        }

        for (const num of nums) {
            if (current.includes(num)) continue;

            current.push(num);
            backtrack(current);
            current.pop();
        }
    };

    backtrack([]);
    return result;
};
```

<strong>Time: O(n × n!) · Aux Space: O(n) · Output Space: O(n × n!)</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def permute(self, nums):
        result = []
        used = [False] * len(nums)

        def backtrack(current):
            if len(current) == len(nums):
                result.append(current[:])
                return

            for i in range(len(nums)):
                if used[i]:
                    continue

                used[i] = True
                current.append(nums[i])

                backtrack(current)

                current.pop()
                used[i] = False

        backtrack([])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> permute(vector<int>& nums) {
        vector<vector<int>> result;
        vector<int> current;
        vector<bool> used(nums.size(), false);
        backtrack(nums, used, current, result);
        return result;
    }

private:
    void backtrack(vector<int>& nums, vector<bool>& used, vector<int>& current,
                   vector<vector<int>>& result) {
        if (current.size() == nums.size()) {
            result.push_back(current);
            return;
        }

        for (int i = 0; i < (int)nums.size(); i++) {
            if (used[i]) continue;

            used[i] = true;
            current.push_back(nums[i]);

            backtrack(nums, used, current, result);

            current.pop_back();
            used[i] = false;
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        boolean[] used = new boolean[nums.length];
        backtrack(nums, used, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] nums, boolean[] used, List<Integer> current,
                           List<List<Integer>> result) {
        if (current.size() == nums.length) {
            result.add(new ArrayList<>(current));
            return;
        }

        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;

            used[i] = true;
            current.add(nums[i]);

            backtrack(nums, used, current, result);

            current.remove(current.size() - 1);
            used[i] = false;
        }
    }
}
```

```javascript filename:JavaScript
var permute = function(nums) {
    const result = [];
    const used = new Array(nums.length).fill(false);

    const backtrack = (current) => {
        if (current.length === nums.length) {
            result.push([...current]);
            return;
        }

        for (let i = 0; i < nums.length; i++) {
            if (used[i]) continue;

            used[i] = true;
            current.push(nums[i]);

            backtrack(current);

            current.pop();
            used[i] = false;
        }
    };

    backtrack([]);
    return result;
};
```

<strong>Time: O(n × n!) · Aux Space: O(n) · Output Space: O(n × n!)</strong>

# Takeaway

Although the asymptotic time remains O(n × n!), the optimized solution removes the repeated O(n) membership search.
