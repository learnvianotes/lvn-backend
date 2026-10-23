---
id: dee8e760-f024-7b1d-9cb6-8b0cb169f2e3
key: problem:sheet-150/lc-40
subject: sheet-150
topic: backtracking
title: Combination Sum II
slug: combination-sum-ii
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 40](https://leetcode.com/problems/combination-sum-ii/)

# Problem

Each candidate can be used only once, and candidates may contain duplicates. Find unique combinations summing to target.

# Understanding the problem

Combines single-use constraint with duplicate candidate values. We cannot reuse an element (use `i + 1`) and must prune duplicate sibling choices.

# Intuition

Sort array, skip duplicate choices at the same level (`i > start and candidates[i] == candidates[i - 1]`), and prune when `candidates[i] > remaining`.

# Approach

1. Sort `candidates`.
2. Define `backtrack(start, remaining, current)`.
3. If `remaining == 0`, append copy to `result`.
4. Loop `i` from `start` to `len(candidates) - 1`.
5. Skip duplicates at same level: `if i > start and candidates[i] == candidates[i - 1]: continue`.
6. Break if `candidates[i] > remaining`.
7. Recurse with `i + 1` because each element can be used once.

# Naive Solution

Generate combinations recursively and use a set to remove duplicates.

```python filename:Python
class Solution:
    def combinationSum2(self, candidates, target):
        result = set()
        candidates.sort()

        def backtrack(index, remaining, current):
            if remaining == 0:
                result.add(tuple(current))
                return

            if index == len(candidates) or remaining < 0:
                return

            # Don't choose
            backtrack(index + 1, remaining, current)

            # Choose
            current.append(candidates[index])
            backtrack(
                index + 1,
                remaining - candidates[index],
                current
            )
            current.pop()

        backtrack(0, target, [])
        return [list(x) for x in result]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> combinationSum2(vector<int>& candidates, int target) {
        set<vector<int>> result;
        vector<int> current;
        sort(candidates.begin(), candidates.end());
        backtrack(candidates, 0, target, current, result);
        return vector<vector<int>>(result.begin(), result.end());
    }

private:
    void backtrack(vector<int>& candidates, int index, int remaining, vector<int>& current,
                   set<vector<int>>& result) {
        if (remaining == 0) {
            result.insert(current);
            return;
        }

        if (index == (int)candidates.size() || remaining < 0) return;

        // Don't choose
        backtrack(candidates, index + 1, remaining, current, result);

        // Choose
        current.push_back(candidates[index]);
        backtrack(candidates, index + 1, remaining - candidates[index], current, result);
        current.pop_back();
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        Set<List<Integer>> result = new HashSet<>();
        Arrays.sort(candidates);
        backtrack(candidates, 0, target, new ArrayList<>(), result);
        return new ArrayList<>(result);
    }

    private void backtrack(int[] candidates, int index, int remaining, List<Integer> current,
                           Set<List<Integer>> result) {
        if (remaining == 0) {
            result.add(new ArrayList<>(current));
            return;
        }

        if (index == candidates.length || remaining < 0) return;

        // Don't choose
        backtrack(candidates, index + 1, remaining, current, result);

        // Choose
        current.add(candidates[index]);
        backtrack(candidates, index + 1, remaining - candidates[index], current, result);
        current.remove(current.size() - 1);
    }
}
```

```javascript filename:JavaScript
var combinationSum2 = function(candidates, target) {
    const result = new Map();  // key -> combination, acts as a set
    candidates.sort((a, b) => a - b);

    const backtrack = (index, remaining, current) => {
        if (remaining === 0) {
            result.set(current.join(','), [...current]);
            return;
        }

        if (index === candidates.length || remaining < 0) return;

        // Don't choose
        backtrack(index + 1, remaining, current);

        // Choose
        current.push(candidates[index]);
        backtrack(index + 1, remaining - candidates[index], current);
        current.pop();
    };

    backtrack(0, target, []);
    return [...result.values()];
};
```

<strong>Time: O(2^n × n) worst case · Aux Space: O(n) · Output/Set Space: O(2^n × n)</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def combinationSum2(self, candidates, target):
        candidates.sort()
        result = []

        def backtrack(start, remaining, current):
            if remaining == 0:
                result.append(current[:])
                return

            for i in range(start, len(candidates)):
                # Skip duplicate choices at the same level
                if i > start and candidates[i] == candidates[i - 1]:
                    continue

                # Since sorted, no later value can work
                if candidates[i] > remaining:
                    break

                current.append(candidates[i])

                # i + 1 because each element can be used once
                backtrack(
                    i + 1,
                    remaining - candidates[i],
                    current
                )

                current.pop()

        backtrack(0, target, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> combinationSum2(vector<int>& candidates, int target) {
        sort(candidates.begin(), candidates.end());
        vector<vector<int>> result;
        vector<int> current;
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
            // Skip duplicate choices at the same level
            if (i > start && candidates[i] == candidates[i - 1]) continue;

            // Since sorted, no later value can work
            if (candidates[i] > remaining) break;

            current.push_back(candidates[i]);

            // i + 1 because each element can be used once
            backtrack(candidates, i + 1, remaining - candidates[i], current, result);

            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        Arrays.sort(candidates);
        List<List<Integer>> result = new ArrayList<>();
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
            // Skip duplicate choices at the same level
            if (i > start && candidates[i] == candidates[i - 1]) continue;

            // Since sorted, no later value can work
            if (candidates[i] > remaining) break;

            current.add(candidates[i]);

            // i + 1 because each element can be used once
            backtrack(candidates, i + 1, remaining - candidates[i], current, result);

            current.remove(current.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var combinationSum2 = function(candidates, target) {
    candidates.sort((a, b) => a - b);
    const result = [];

    const backtrack = (start, remaining, current) => {
        if (remaining === 0) {
            result.push([...current]);
            return;
        }

        for (let i = start; i < candidates.length; i++) {
            // Skip duplicate choices at the same level
            if (i > start && candidates[i] === candidates[i - 1]) continue;

            // Since sorted, no later value can work
            if (candidates[i] > remaining) break;

            current.push(candidates[i]);

            // i + 1 because each element can be used once
            backtrack(i + 1, remaining - candidates[i], current);

            current.pop();
        }
    };

    backtrack(0, target, []);
    return result;
};
```

<strong>Time: O(2^n × n) worst case · Aux Space: O(n) · Output Space: O(number of valid combinations × n)</strong>

# Takeaway

<strong>Important Difference:</strong><br>Combination Sum uses `backtrack(i, ...)` (can reuse the same element).<br>Combination Sum II uses `backtrack(i + 1, ...)` (cannot reuse it).
