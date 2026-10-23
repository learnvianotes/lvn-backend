---
id: 9cf3851b-bf08-79c6-ada7-901b33ed9ea8
key: problem:sheet-150/lc-1899
subject: sheet-150
topic: greedy
title: Merge Triplets to Form Target Triplet
slug: merge-triplets-to-form-target-triplet
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 1899](https://leetcode.com/problems/merge-triplets-to-form-target-triplet/)

# Problem

Given a list of triplets and a target triplet, you can merge any two triplets by taking the element-wise max. Return `True` if you can form the target.

# Understanding the problem

Merging uses `max()`, so any triplet where one coordinate exceeds the target can <em>never</em> be used — it would permanently overshoot that coordinate. Filter those out and check if the remaining triplets collectively cover every coordinate of the target.

# Intuition

Discard every triplet where any coordinate exceeds the target (merging would lock us above target). Among the remaining valid triplets, check whether we can find the exact target values at each coordinate position.

# Approach

1. Initialize `found = [False, False, False]`.
2. For each triplet: if any `triplet[i] > target[i]`, skip it entirely.
3. Otherwise, for each position `i`: if `triplet[i] == target[i]`, set `found[i] = True`.
4. Return `all(found)`.

# Naive Solution — Brute Force

DFS trying all subsets: include or exclude each triplet, merge, and check against target.

```python filename:Python
class Solution:
    def mergeTriplets(self, triplets, target):
        n = len(triplets)

        def dfs(index, current):
            if current == target:
                return True

            if index == n:
                return False

            if dfs(index + 1, current):
                return True

            triplet = triplets[index]

            if all(
                triplet[i] <= target[i]
                for i in range(3)
            ):
                merged = [
                    max(current[i], triplet[i])
                    for i in range(3)
                ]

                if dfs(index + 1, merged):
                    return True

            return False

        return dfs(0, [0, 0, 0])
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool mergeTriplets(vector<vector<int>>& triplets, vector<int>& target) {
        return dfs(triplets, target, 0, {0, 0, 0});
    }

private:
    bool dfs(vector<vector<int>>& triplets, vector<int>& target, int index, vector<int> current) {
        if (current == target) {
            return true;
        }

        if (index == (int)triplets.size()) {
            return false;
        }

        if (dfs(triplets, target, index + 1, current)) {
            return true;
        }

        vector<int>& triplet = triplets[index];

        if (triplet[0] <= target[0] && triplet[1] <= target[1] && triplet[2] <= target[2]) {
            vector<int> merged(3);
            for (int i = 0; i < 3; i++) {
                merged[i] = max(current[i], triplet[i]);
            }

            if (dfs(triplets, target, index + 1, merged)) {
                return true;
            }
        }

        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean mergeTriplets(int[][] triplets, int[] target) {
        return dfs(triplets, target, 0, new int[]{0, 0, 0});
    }

    private boolean dfs(int[][] triplets, int[] target, int index, int[] current) {
        if (Arrays.equals(current, target)) {
            return true;
        }

        if (index == triplets.length) {
            return false;
        }

        if (dfs(triplets, target, index + 1, current)) {
            return true;
        }

        int[] triplet = triplets[index];

        if (triplet[0] <= target[0] && triplet[1] <= target[1] && triplet[2] <= target[2]) {
            int[] merged = new int[3];
            for (int i = 0; i < 3; i++) {
                merged[i] = Math.max(current[i], triplet[i]);
            }

            if (dfs(triplets, target, index + 1, merged)) {
                return true;
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var mergeTriplets = function(triplets, target) {
    const n = triplets.length;

    const dfs = (index, current) => {
        if (current.every((v, i) => v === target[i])) {
            return true;
        }

        if (index === n) {
            return false;
        }

        if (dfs(index + 1, current)) {
            return true;
        }

        const triplet = triplets[index];

        if (triplet.every((v, i) => v <= target[i])) {
            const merged = current.map((v, i) => Math.max(v, triplet[i]));

            if (dfs(index + 1, merged)) {
                return true;
            }
        }

        return false;
    };

    return dfs(0, [0, 0, 0]);
};
```

<strong>Time: O(2ⁿ) · Space: O(n) recursion</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def mergeTriplets(self, triplets, target):
        found = [False, False, False]

        for triplet in triplets:
            if any(
                triplet[i] > target[i]
                for i in range(3)
            ):
                continue

            for i in range(3):
                if triplet[i] == target[i]:
                    found[i] = True

        return all(found)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool mergeTriplets(vector<vector<int>>& triplets, vector<int>& target) {
        bool found[3] = {false, false, false};

        for (auto& triplet : triplets) {
            if (triplet[0] > target[0] || triplet[1] > target[1] || triplet[2] > target[2]) {
                continue;
            }

            for (int i = 0; i < 3; i++) {
                if (triplet[i] == target[i]) {
                    found[i] = true;
                }
            }
        }

        return found[0] && found[1] && found[2];
    }
};
```

```java filename:Java
class Solution {
    public boolean mergeTriplets(int[][] triplets, int[] target) {
        boolean[] found = new boolean[3];

        for (int[] triplet : triplets) {
            if (triplet[0] > target[0] || triplet[1] > target[1] || triplet[2] > target[2]) {
                continue;
            }

            for (int i = 0; i < 3; i++) {
                if (triplet[i] == target[i]) {
                    found[i] = true;
                }
            }
        }

        return found[0] && found[1] && found[2];
    }
}
```

```javascript filename:JavaScript
var mergeTriplets = function(triplets, target) {
    const found = [false, false, false];

    for (const triplet of triplets) {
        if (triplet.some((v, i) => v > target[i])) {
            continue;
        }

        for (let i = 0; i < 3; i++) {
            if (triplet[i] === target[i]) {
                found[i] = true;
            }
        }
    }

    return found.every(Boolean);
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Greedy Filtering — eliminate impossible candidates (those that overshoot), then verify coverage
