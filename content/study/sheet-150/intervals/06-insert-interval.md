---
id: 2ebb68dc-d461-73bc-8379-56202e437a0a
key: problem:sheet-150/lc-57
subject: sheet-150
topic: intervals
title: Insert Interval
slug: insert-interval
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 57](https://leetcode.com/problems/insert-interval/)

# Problem

Given a list of non-overlapping, sorted intervals and a new interval, insert the new interval and merge any overlapping intervals. Return the result.

# Understanding the problem

The intervals are already sorted. Exploit that structure: everything before the new interval is untouched, everything overlapping gets merged, and everything after is also untouched. Three regions — three passes.

# Intuition

The list is already sorted — no need to re-sort. Scan in three explicit phases: (1) intervals ending before the new one starts, (2) overlapping intervals that get absorbed into `newInterval`, (3) intervals starting after the new one ends.

# Approach

1. Walk while `intervals[i][1] < newInterval[0]` — append directly to result.
2. Walk while `intervals[i][0] <= newInterval[1]` — merge: take `min` of starts and `max` of ends into `newInterval`.
3. Append the merged `newInterval`.
4. Append all remaining intervals.

# Naive Solution — Brute Force

Append the new interval, sort everything, then run standard merge-intervals.

```python filename:Python
class Solution:
    def insert(self, intervals, newInterval):
        intervals.append(newInterval)
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
    vector<vector<int>> insert(vector<vector<int>>& intervals, vector<int>& newInterval) {
        intervals.push_back(newInterval);
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
    public int[][] insert(int[][] intervals, int[] newInterval) {
        List<int[]> all = new ArrayList<>(Arrays.asList(intervals));
        all.add(newInterval);
        all.sort((a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));

        List<int[]> result = new ArrayList<>();

        for (int[] interval : all) {
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
var insert = function(intervals, newInterval) {
    intervals.push(newInterval);
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

<strong>Time: O(n log n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def insert(self, intervals, newInterval):
        result = []
        i = 0
        n = len(intervals)

        # Phase 1 — completely before new interval
        while i < n and intervals[i][1] < newInterval[0]:
            result.append(intervals[i])
            i += 1

        # Phase 2 — overlapping: merge into newInterval
        while i < n and intervals[i][0] <= newInterval[1]:
            newInterval[0] = min(newInterval[0], intervals[i][0])
            newInterval[1] = max(newInterval[1], intervals[i][1])
            i += 1

        result.append(newInterval)

        # Phase 3 — completely after new interval
        while i < n:
            result.append(intervals[i])
            i += 1

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> insert(vector<vector<int>>& intervals, vector<int>& newInterval) {
        vector<vector<int>> result;
        int i = 0;
        int n = intervals.size();

        // Phase 1 — completely before new interval
        while (i < n && intervals[i][1] < newInterval[0]) {
            result.push_back(intervals[i]);
            i++;
        }

        // Phase 2 — overlapping: merge into newInterval
        while (i < n && intervals[i][0] <= newInterval[1]) {
            newInterval[0] = min(newInterval[0], intervals[i][0]);
            newInterval[1] = max(newInterval[1], intervals[i][1]);
            i++;
        }

        result.push_back(newInterval);

        // Phase 3 — completely after new interval
        while (i < n) {
            result.push_back(intervals[i]);
            i++;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[][] insert(int[][] intervals, int[] newInterval) {
        List<int[]> result = new ArrayList<>();
        int i = 0;
        int n = intervals.length;

        // Phase 1 — completely before new interval
        while (i < n && intervals[i][1] < newInterval[0]) {
            result.add(intervals[i]);
            i++;
        }

        // Phase 2 — overlapping: merge into newInterval
        while (i < n && intervals[i][0] <= newInterval[1]) {
            newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
            newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
            i++;
        }

        result.add(newInterval);

        // Phase 3 — completely after new interval
        while (i < n) {
            result.add(intervals[i]);
            i++;
        }

        return result.toArray(new int[0][]);
    }
}
```

```javascript filename:JavaScript
var insert = function(intervals, newInterval) {
    const result = [];
    let i = 0;
    const n = intervals.length;

    // Phase 1 — completely before new interval
    while (i < n && intervals[i][1] < newInterval[0]) {
        result.push(intervals[i]);
        i++;
    }

    // Phase 2 — overlapping: merge into newInterval
    while (i < n && intervals[i][0] <= newInterval[1]) {
        newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
        newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
        i++;
    }

    result.push(newInterval);

    // Phase 3 — completely after new interval
    while (i < n) {
        result.push(intervals[i]);
        i++;
    }

    return result;
};
```

<strong>Time: O(n) · Space: O(n) output</strong>

# Takeaway

<strong>Pattern</strong> — Already-sorted list → Three-phase scan (before / overlap-merge / after)
