---
id: 3b45492e-8056-7173-b54c-a7720cb4cad7
key: problem:sheet-150/lc-90
subject: sheet-150
topic: backtracking
title: Subsets II
slug: subsets-ii
order: 9
---

Difficulty: <strong>Medium</strong> · [LeetCode 90](https://leetcode.com/problems/subsets-ii/)

# Problem

Array may contain duplicates. We need unique subsets.

# Understanding the problem

When input elements contain duplicates, standard subset branching generates identical subsets multiple times.

# Intuition

Sort the array and skip duplicate choices at the same recursion level.

# Approach

1. Sort `nums`.
2. Define `backtrack(start, current)` and append `current[:]`.
3. Loop `i` from `start` to `len(nums) - 1`.
4. If `i > start and nums[i] == nums[i - 1]`, `continue`.
5. Append `nums[i]`, call `backtrack(i + 1, current)`, and pop.

# Naive Solution

Generate all 2^n subsets and put them into a set to eliminate duplicate subsets.

```python filename:Python
class Solution:
    def subsetsWithDup(self, nums):
        nums.sort()
        result = set()

        def backtrack(index, current):
            if index == len(nums):
                result.add(tuple(current))
                return

            # Don't take
            backtrack(index + 1, current)

            # Take
            current.append(nums[index])
            backtrack(index + 1, current)
            current.pop()

        backtrack(0, [])
        return [list(x) for x in result]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> subsetsWithDup(vector<int>& nums) {
        sort(nums.begin(), nums.end());
        set<vector<int>> result;
        vector<int> current;
        backtrack(nums, 0, current, result);
        return vector<vector<int>>(result.begin(), result.end());
    }

private:
    void backtrack(vector<int>& nums, int index, vector<int>& current, set<vector<int>>& result) {
        if (index == (int)nums.size()) {
            result.insert(current);
            return;
        }

        // Don't take
        backtrack(nums, index + 1, current, result);

        // Take
        current.push_back(nums[index]);
        backtrack(nums, index + 1, current, result);
        current.pop_back();
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums);
        Set<List<Integer>> result = new HashSet<>();
        backtrack(nums, 0, new ArrayList<>(), result);
        return new ArrayList<>(result);
    }

    private void backtrack(int[] nums, int index, List<Integer> current, Set<List<Integer>> result) {
        if (index == nums.length) {
            result.add(new ArrayList<>(current));
            return;
        }

        // Don't take
        backtrack(nums, index + 1, current, result);

        // Take
        current.add(nums[index]);
        backtrack(nums, index + 1, current, result);
        current.remove(current.size() - 1);
    }
}
```

```javascript filename:JavaScript
var subsetsWithDup = function(nums) {
    nums.sort((a, b) => a - b);
    const result = new Map();  // key -> subset, acts as a set of subsets

    const backtrack = (index, current) => {
        if (index === nums.length) {
            result.set(current.join(','), [...current]);
            return;
        }

        // Don't take
        backtrack(index + 1, current);

        // Take
        current.push(nums[index]);
        backtrack(index + 1, current);
        current.pop();
    };

    backtrack(0, []);
    return [...result.values()];
};
```

<strong>Time: O(n × 2^n) · Aux Space: O(n) · Output/Set Space: O(n × 2^n) worst case</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def subsetsWithDup(self, nums):
        nums.sort()
        result = []

        def backtrack(start, current):
            result.append(current[:])

            for i in range(start, len(nums)):
                if i > start and nums[i] == nums[i - 1]:
                    continue

                current.append(nums[i])
                backtrack(i + 1, current)
                current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> subsetsWithDup(vector<int>& nums) {
        sort(nums.begin(), nums.end());
        vector<vector<int>> result;
        vector<int> current;
        backtrack(nums, 0, current, result);
        return result;
    }

private:
    void backtrack(vector<int>& nums, int start, vector<int>& current, vector<vector<int>>& result) {
        result.push_back(current);

        for (int i = start; i < (int)nums.size(); i++) {
            if (i > start && nums[i] == nums[i - 1]) continue;

            current.push_back(nums[i]);
            backtrack(nums, i + 1, current, result);
            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> result = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
        result.add(new ArrayList<>(current));

        for (int i = start; i < nums.length; i++) {
            if (i > start && nums[i] == nums[i - 1]) continue;

            current.add(nums[i]);
            backtrack(nums, i + 1, current, result);
            current.remove(current.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var subsetsWithDup = function(nums) {
    nums.sort((a, b) => a - b);
    const result = [];

    const backtrack = (start, current) => {
        result.push([...current]);

        for (let i = start; i < nums.length; i++) {
            if (i > start && nums[i] === nums[i - 1]) continue;

            current.push(nums[i]);
            backtrack(i + 1, current);
            current.pop();
        }
    };

    backtrack(0, []);
    return result;
};
```

<strong>Time: O(n × 2^n) worst case · Aux Space: O(n) · Output Space: O(n × 2^n) worst case</strong>

# Takeaway

<strong>Critical Pattern:</strong> `if i > start and nums[i] == nums[i - 1]: continue`<br>Skip duplicates at the same recursion level, but allow duplicates at different levels.
