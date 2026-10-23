---
id: 83e2b6e2-a30f-7a84-8285-37733ed5011b
key: problem:sheet-150/lc-56
subject: sheet-150
topic: intervals
title: Merge Intervals
slug: merge-intervals
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 56](https://leetcode.com/problems/merge-intervals/)

# Problem

Given an array of intervals, merge all overlapping intervals and return the resulting array.

# Understanding the problem

Once intervals are sorted by start time, any overlap can only occur with the previous interval in the result list. A single left-to-right scan is sufficient.

# Intuition

Sort by start time. After sorting, overlapping intervals must be adjacent. Walk once: if the current interval's start is within the last result interval's end, extend; otherwise append fresh.

# Approach

1. Sort `intervals` by start time.
2. Initialize `result = []`.
3. For each `[start, end]`: if result is empty or `start > result[-1][1]`, append `[start, end]`.
4. Otherwise: `result[-1][1] = max(result[-1][1], end)`.
5. Return `result`.

# Naive Solution — Brute Force

Repeatedly scan for any overlapping pair and merge them until no overlaps remain.

```python filename:Python
class Solution:
    def merge(self, intervals):
        intervals = [x[:] for x in intervals]
        changed = True

        while changed:
            changed = False
            result = []
            used = [False] * len(intervals)

            for i in range(len(intervals)):
                if used[i]:
                    continue

                current = intervals[i]

                for j in range(i + 1, len(intervals)):
                    if used[j]:
                        continue

                    other = intervals[j]

                    if (
                        current[0] <= other[1]
                        and other[0] <= current[1]
                    ):
                        current = [
                            min(current[0], other[0]),
                            max(current[1], other[1]),
                        ]
                        used[j] = True
                        changed = True

                result.append(current)

            intervals = result

        return intervals
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& input) {
        vector<vector<int>> intervals = input;
        bool changed = true;

        while (changed) {
            changed = false;
            vector<vector<int>> result;
            vector<bool> used(intervals.size(), false);

            for (int i = 0; i < (int)intervals.size(); i++) {
                if (used[i]) continue;

                vector<int> current = intervals[i];

                for (int j = i + 1; j < (int)intervals.size(); j++) {
                    if (used[j]) continue;

                    vector<int>& other = intervals[j];

                    if (current[0] <= other[1] && other[0] <= current[1]) {
                        current = {
                            min(current[0], other[0]),
                            max(current[1], other[1]),
                        };
                        used[j] = true;
                        changed = true;
                    }
                }

                result.push_back(current);
            }

            intervals = result;
        }

        return intervals;
    }
};
```

```java filename:Java
class Solution {
    public int[][] merge(int[][] input) {
        List<int[]> intervals = new ArrayList<>();
        for (int[] interval : input) intervals.add(interval.clone());

        boolean changed = true;

        while (changed) {
            changed = false;
            List<int[]> result = new ArrayList<>();
            boolean[] used = new boolean[intervals.size()];

            for (int i = 0; i < intervals.size(); i++) {
                if (used[i]) continue;

                int[] current = intervals.get(i);

                for (int j = i + 1; j < intervals.size(); j++) {
                    if (used[j]) continue;

                    int[] other = intervals.get(j);

                    if (current[0] <= other[1] && other[0] <= current[1]) {
                        current = new int[]{
                            Math.min(current[0], other[0]),
                            Math.max(current[1], other[1]),
                        };
                        used[j] = true;
                        changed = true;
                    }
                }

                result.add(current);
            }

            intervals = result;
        }

        return intervals.toArray(new int[0][]);
    }
}
```

```javascript filename:JavaScript
var merge = function(input) {
    let intervals = input.map((x) => [...x]);
    let changed = true;

    while (changed) {
        changed = false;
        const result = [];
        const used = new Array(intervals.length).fill(false);

        for (let i = 0; i < intervals.length; i++) {
            if (used[i]) continue;

            let current = intervals[i];

            for (let j = i + 1; j < intervals.length; j++) {
                if (used[j]) continue;

                const other = intervals[j];

                if (current[0] <= other[1] && other[0] <= current[1]) {
                    current = [
                        Math.min(current[0], other[0]),
                        Math.max(current[1], other[1]),
                    ];
                    used[j] = true;
                    changed = true;
                }
            }

            result.push(current);
        }

        intervals = result;
    }

    return intervals;
};
```

<strong>Time: O(n²) worst case · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def merge(self, intervals):
        intervals.sort()
        result = []

        for start, end in intervals:
            if not result or start > result[-1][1]:
                result.append([start, end])
            else:
                result[-1][1] = max(result[-1][1], end)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end());
        vector<vector<int>> result;

        for (auto& interval : intervals) {
            int start = interval[0], end = interval[1];

            if (result.empty() || start > result.back()[1]) {
                result.push_back({start, end});
            } else {
                result.back()[1] = max(result.back()[1], end);
            }
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));
        List<int[]> result = new ArrayList<>();

        for (int[] interval : intervals) {
            int start = interval[0], end = interval[1];

            if (result.isEmpty() || start > result.get(result.size() - 1)[1]) {
                result.add(new int[]{start, end});
            } else {
                int[] last = result.get(result.size() - 1);
                last[1] = Math.max(last[1], end);
            }
        }

        return result.toArray(new int[0][]);
    }
}
```

```javascript filename:JavaScript
var merge = function(intervals) {
    intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const result = [];

    for (const [start, end] of intervals) {
        if (!result.length || start > result[result.length - 1][1]) {
            result.push([start, end]);
        } else {
            const last = result[result.length - 1];
            last[1] = Math.max(last[1], end);
        }
    }

    return result;
};
```

<strong>Time: O(n log n) · Space: O(n) output</strong>

# Takeaway

<strong>Pattern</strong> — Sort by start → compare current start with previous end
