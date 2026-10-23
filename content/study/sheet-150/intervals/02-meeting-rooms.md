---
id: 32da95e2-0d4e-7893-b79b-327e3d0e7180
key: problem:sheet-150/lc-252
subject: sheet-150
topic: intervals
title: Meeting Rooms
slug: meeting-rooms
order: 2
---

Difficulty: <strong>Easy</strong> · [LeetCode 252](https://leetcode.com/problems/meeting-rooms/)

# Problem

Given a list of meeting time intervals, determine if a single person can attend all meetings (no two meetings may overlap).

# Understanding the problem

After sorting by start, any overlap can only occur between consecutive meetings. A single adjacent comparison pass suffices.

# Intuition

Sort by start time. After sorting, any two overlapping intervals must be adjacent. A single pass comparing each meeting's start to the previous meeting's end is enough.

# Approach

1. Sort `intervals` by start time.
2. Iterate from index 1.
3. If `intervals[i][0] < intervals[i-1][1]`: overlap found, return `False`.
4. Return `True`.

# Naive Solution — Brute Force

Compare every pair of meetings for overlap.

```python filename:Python
class Solution:
    def canAttendMeetings(self, intervals):
        n = len(intervals)

        for i in range(n):
            for j in range(i + 1, n):
                start1, end1 = intervals[i]
                start2, end2 = intervals[j]

                if start1 < end2 and start2 < end1:
                    return False

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canAttendMeetings(vector<Interval>& intervals) {
        int n = intervals.size();

        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                int start1 = intervals[i].start, end1 = intervals[i].end;
                int start2 = intervals[j].start, end2 = intervals[j].end;

                if (start1 < end2 && start2 < end1) return false;
            }
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean canAttendMeetings(List<Interval> intervals) {
        int n = intervals.size();

        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                int start1 = intervals.get(i).start, end1 = intervals.get(i).end;
                int start2 = intervals.get(j).start, end2 = intervals.get(j).end;

                if (start1 < end2 && start2 < end1) return false;
            }
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var canAttendMeetings = function(intervals) {
    const n = intervals.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const { start: start1, end: end1 } = intervals[i];
            const { start: start2, end: end2 } = intervals[j];

            if (start1 < end2 && start2 < end1) return false;
        }
    }

    return true;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def canAttendMeetings(self, intervals):
        intervals.sort()

        for i in range(1, len(intervals)):
            if intervals[i][0] < intervals[i - 1][1]:
                return False

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canAttendMeetings(vector<Interval>& intervals) {
        sort(intervals.begin(), intervals.end(), [](const Interval& a, const Interval& b) {
            return a.start < b.start;
        });

        for (int i = 1; i < (int)intervals.size(); i++) {
            if (intervals[i].start < intervals[i - 1].end) return false;
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean canAttendMeetings(List<Interval> intervals) {
        intervals.sort((a, b) -> Integer.compare(a.start, b.start));

        for (int i = 1; i < intervals.size(); i++) {
            if (intervals.get(i).start < intervals.get(i - 1).end) return false;
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var canAttendMeetings = function(intervals) {
    intervals.sort((a, b) => a.start - b.start);

    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i].start < intervals[i - 1].end) return false;
    }

    return true;
};
```

<strong>Time: O(n log n) · Space: O(1) auxiliary</strong>

# Takeaway

<strong>Pattern</strong> — Sort by start → compare adjacent pairs
