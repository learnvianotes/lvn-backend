---
id: 84b405a6-7a8d-772f-88a7-02cb4db78545
key: problem:sheet-150/lc-435
subject: sheet-150
topic: intervals
title: Non-Overlapping Intervals
slug: non-overlapping-intervals
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 435](https://leetcode.com/problems/non-overlapping-intervals/)

# Problem

Given an array of intervals, return the minimum number of intervals to remove so that the rest are non-overlapping.

# Understanding the problem

When two intervals overlap, greedy insight: keep the one that ends earlier — it leaves the most room for future intervals. This is the classic Interval Scheduling Maximization problem.

# Intuition

Sort by end time. Scan left to right: if the current interval overlaps the previous kept one, remove it (increment counter). If it does not overlap, keep it and update `previous_end`.

# Approach

1. Sort intervals by end time: `key=lambda x: x[1]`.
2. Initialize `removed = 0`, `previous_end = -inf`.
3. For each `[start, end]`: if `start < previous_end` → conflict, increment `removed`.
4. Else: keep this interval, set `previous_end = end`.
5. Return `removed`.

# Naive Solution — Brute Force

DFS: try all combinations of kept/removed intervals and find the minimum removals.

```python filename:Python
class Solution:
    def eraseOverlapIntervals(self, intervals):
        n = len(intervals)
        best = [n]

        def overlaps(a, b):
            return a[0] < b[1] and b[0] < a[1]

        def dfs(index, chosen):
            if index == n:
                best[0] = min(best[0], n - len(chosen))
                return

            # Skip this interval
            dfs(index + 1, chosen)

            # Take if compatible
            if all(
                not overlaps(intervals[index], x)
                for x in chosen
            ):
                chosen.append(intervals[index])
                dfs(index + 1, chosen)
                chosen.pop()

        dfs(0, [])
        return best[0]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int eraseOverlapIntervals(vector<vector<int>>& intervals) {
        int n = intervals.size();
        int best = n;
        vector<vector<int>> chosen;
        dfs(intervals, 0, chosen, best);
        return best;
    }

private:
    bool overlaps(const vector<int>& a, const vector<int>& b) {
        return a[0] < b[1] && b[0] < a[1];
    }

    void dfs(vector<vector<int>>& intervals, int index, vector<vector<int>>& chosen, int& best) {
        int n = intervals.size();

        if (index == n) {
            best = min(best, n - (int)chosen.size());
            return;
        }

        // Skip this interval
        dfs(intervals, index + 1, chosen, best);

        // Take if compatible
        bool compatible = true;
        for (auto& x : chosen) {
            if (overlaps(intervals[index], x)) {
                compatible = false;
                break;
            }
        }

        if (compatible) {
            chosen.push_back(intervals[index]);
            dfs(intervals, index + 1, chosen, best);
            chosen.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    private int best;

    public int eraseOverlapIntervals(int[][] intervals) {
        best = intervals.length;
        dfs(intervals, 0, new ArrayList<>());
        return best;
    }

    private boolean overlaps(int[] a, int[] b) {
        return a[0] < b[1] && b[0] < a[1];
    }

    private void dfs(int[][] intervals, int index, List<int[]> chosen) {
        int n = intervals.length;

        if (index == n) {
            best = Math.min(best, n - chosen.size());
            return;
        }

        // Skip this interval
        dfs(intervals, index + 1, chosen);

        // Take if compatible
        boolean compatible = true;
        for (int[] x : chosen) {
            if (overlaps(intervals[index], x)) {
                compatible = false;
                break;
            }
        }

        if (compatible) {
            chosen.add(intervals[index]);
            dfs(intervals, index + 1, chosen);
            chosen.remove(chosen.size() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var eraseOverlapIntervals = function(intervals) {
    const n = intervals.length;
    let best = n;

    const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];

    const dfs = (index, chosen) => {
        if (index === n) {
            best = Math.min(best, n - chosen.length);
            return;
        }

        // Skip this interval
        dfs(index + 1, chosen);

        // Take if compatible
        if (chosen.every((x) => !overlaps(intervals[index], x))) {
            chosen.push(intervals[index]);
            dfs(index + 1, chosen);
            chosen.pop();
        }
    };

    dfs(0, []);
    return best;
};
```

<strong>Time: O(2ⁿ × n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def eraseOverlapIntervals(self, intervals):
        intervals.sort(key=lambda x: x[1])

        removed = 0
        previous_end = float("-inf")

        for start, end in intervals:
            if start < previous_end:
                removed += 1
            else:
                previous_end = end

        return removed
```

```cpp filename:C%2B%2B
class Solution {
public:
    int eraseOverlapIntervals(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end(), [](const vector<int>& a, const vector<int>& b) {
            return a[1] < b[1];
        });

        int removed = 0;
        int previousEnd = INT_MIN;

        for (auto& interval : intervals) {
            int start = interval[0], end = interval[1];

            if (start < previousEnd) {
                removed++;
            } else {
                previousEnd = end;
            }
        }

        return removed;
    }
};
```

```java filename:Java
class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));

        int removed = 0;
        int previousEnd = Integer.MIN_VALUE;

        for (int[] interval : intervals) {
            int start = interval[0], end = interval[1];

            if (start < previousEnd) {
                removed++;
            } else {
                previousEnd = end;
            }
        }

        return removed;
    }
}
```

```javascript filename:JavaScript
var eraseOverlapIntervals = function(intervals) {
    intervals.sort((a, b) => a[1] - b[1]);

    let removed = 0;
    let previousEnd = -Infinity;

    for (const [start, end] of intervals) {
        if (start < previousEnd) {
            removed++;
        } else {
            previousEnd = end;
        }
    }

    return removed;
};
```

<strong>Time: O(n log n) · Space: O(1) auxiliary</strong>

# Takeaway

<strong>Pattern</strong> — Sort by END → Earliest Finish Time (keep the interval ending soonest to maximize future room)
