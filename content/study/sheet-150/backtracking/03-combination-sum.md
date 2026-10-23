---
id: 7c423123-9faa-77bd-8b1b-1c25e262434e
key: problem:sheet-150/lc-39
subject: sheet-150
topic: backtracking
title: Combination Sum
slug: combination-sum
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 39](https://leetcode.com/problems/combination-sum/)

# Problem

Given candidates and target, find combinations whose sum equals target. Elements can be reused.

# Understanding the problem

Let T = target and k = len(candidates). The recursion depth can be approximately T when the smallest candidate is 1. We must avoid generating permutations of the same combination.

# Intuition

Use `start` index to avoid generating the same combination in different orders, and sort candidates to break the loop early when a candidate exceeds the remaining target.

# Approach

1. Sort candidates array.
2. Define `backtrack(start, remaining, current)`.
3. If `remaining == 0`, append `current[:]` to `result` and return.
4. Iterate `i` from `start` to `len(candidates) - 1`.
5. If `candidates[i] > remaining`, break early (pruning).
6. Append candidate, call `backtrack(i, remaining - num, current)` (pass `i` to allow reuse), and pop.

# Naive Solution

Try every candidate at every step without pruning.

```python filename:Python
class Solution:
    def combinationSum(self, candidates, target):
        result = []

        def backtrack(start, current, total):
            if total == target:
                result.append(current[:])
                return

            if total > target:
                return

            for i in range(start, len(candidates)):
                current.append(candidates[i])
                backtrack(i, current, total + candidates[i])
                current.pop()

        backtrack(0, [], 0)
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        vector<vector<int>> result;
        vector<int> current;
        backtrack(candidates, target, 0, current, 0, result);
        return result;
    }

private:
    void backtrack(vector<int>& candidates, int target, int start, vector<int>& current, int total,
                   vector<vector<int>>& result) {
        if (total == target) {
            result.push_back(current);
            return;
        }

        if (total > target) return;

        for (int i = start; i < (int)candidates.size(); i++) {
            current.push_back(candidates[i]);
            backtrack(candidates, target, i, current, total + candidates[i], result);
            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(candidates, target, 0, new ArrayList<>(), 0, result);
        return result;
    }

    private void backtrack(int[] candidates, int target, int start, List<Integer> current, int total,
                           List<List<Integer>> result) {
        if (total == target) {
            result.add(new ArrayList<>(current));
            return;
        }

        if (total > target) return;

        for (int i = start; i < candidates.length; i++) {
            current.add(candidates[i]);
            backtrack(candidates, target, i, current, total + candidates[i], result);
            current.remove(current.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var combinationSum = function(candidates, target) {
    const result = [];

    const backtrack = (start, current, total) => {
        if (total === target) {
            result.push([...current]);
            return;
        }

        if (total > target) return;

        for (let i = start; i < candidates.length; i++) {
            current.push(candidates[i]);
            backtrack(i, current, total + candidates[i]);
            current.pop();
        }
    };

    backtrack(0, [], 0);
    return result;
};
```

<strong>Time: O(k^T) worst case · Aux Space: O(T) · Output Space: depends on number of valid combinations</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def combinationSum(self, candidates, target):
        result = []
        candidates.sort()

        def backtrack(start, remaining, current):
            if remaining == 0:
                result.append(current[:])
                return

            for i in range(start, len(candidates)):
                num = candidates[i]

                if num > remaining:
                    break

                current.append(num)

                # i, not i + 1, because we can reuse the same number
                backtrack(i, remaining - num, current)

                current.pop()

        backtrack(0, target, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        vector<vector<int>> result;
        vector<int> current;
        sort(candidates.begin(), candidates.end());
        backtrack(candidates, 0, target, current, result);
        return result;
    }

private:
    void backtrack(vector<int>& candidates, int start, int remaining, vector<int>& current,
                   vector<vector<int>>& result) {
        if (remaining == 0) {
            result.push_back(current);
            return;
        }

        for (int i = start; i < (int)candidates.size(); i++) {
            int num = candidates[i];

            if (num > remaining) break;

            current.push_back(num);

            // i, not i + 1, because we can reuse the same number
            backtrack(candidates, i, remaining - num, current, result);

            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        List<List<Integer>> result = new ArrayList<>();
        Arrays.sort(candidates);
        backtrack(candidates, 0, target, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] candidates, int start, int remaining, List<Integer> current,
                           List<List<Integer>> result) {
        if (remaining == 0) {
            result.add(new ArrayList<>(current));
            return;
        }

        for (int i = start; i < candidates.length; i++) {
            int num = candidates[i];

            if (num > remaining) break;

            current.add(num);

            // i, not i + 1, because we can reuse the same number
            backtrack(candidates, i, remaining - num, current, result);

            current.remove(current.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var combinationSum = function(candidates, target) {
    const result = [];
    candidates.sort((a, b) => a - b);

    const backtrack = (start, remaining, current) => {
        if (remaining === 0) {
            result.push([...current]);
            return;
        }

        for (let i = start; i < candidates.length; i++) {
            const num = candidates[i];

            if (num > remaining) break;

            current.push(num);

            // i, not i + 1, because we can reuse the same number
            backtrack(i, remaining - num, current);

            current.pop();
        }
    };

    backtrack(0, target, []);
    return result;
};
```

<strong>Time: O(k^T) worst case · Aux Space: O(T) · Output Space: O(number of combinations × T)</strong>

# Takeaway

The important optimization is avoiding permutations of the same combination and pruning candidates larger than the remaining target.
