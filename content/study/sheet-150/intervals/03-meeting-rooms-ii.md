---
id: 7ecf181e-e9ea-7481-afc7-48b334b0a8a7
key: problem:sheet-150/lc-253
subject: sheet-150
topic: intervals
title: Meeting Rooms II
slug: meeting-rooms-ii
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 253](https://leetcode.com/problems/meeting-rooms-ii/)

# Problem

Given meeting intervals, find the minimum number of conference rooms required to host all meetings simultaneously.

# Understanding the problem

When a new meeting starts, check the room that becomes free earliest. If it frees up before the new meeting starts, reuse it. Otherwise, open a new room. A min-heap of end times models this perfectly.

# Intuition

Sort meetings by start time. Use a min-heap to track the earliest end time among ongoing meetings. When a new meeting starts: if the heap's top (earliest ending room) is free, pop and reuse; otherwise push a new room. Heap size = rooms needed.

# Approach

1. Sort intervals by start time.
2. Initialize `rooms = []` (min-heap of end times).
3. For each `[start, end]`: if `rooms` is non-empty and `rooms[0] <= start`, pop (reuse that room).
4. Push `end` onto the heap.
5. Return `len(rooms)`.

# Naive Solution — Brute Force

For every meeting, count how many other meetings overlap with it.

```python filename:Python
class Solution:
    def minMeetingRooms(self, intervals):
        answer = 0

        for start, _ in intervals:
            rooms = 0

            for other_start, other_end in intervals:
                if other_start <= start < other_end:
                    rooms += 1

            answer = max(answer, rooms)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minMeetingRooms(vector<Interval>& intervals) {
        int answer = 0;

        for (auto& meeting : intervals) {
            int rooms = 0;

            for (auto& other : intervals) {
                if (other.start <= meeting.start && meeting.start < other.end) rooms++;
            }

            answer = max(answer, rooms);
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int minMeetingRooms(List<Interval> intervals) {
        int answer = 0;

        for (Interval meeting : intervals) {
            int rooms = 0;

            for (Interval other : intervals) {
                if (other.start <= meeting.start && meeting.start < other.end) rooms++;
            }

            answer = Math.max(answer, rooms);
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var minMeetingRooms = function(intervals) {
    let answer = 0;

    for (const { start } of intervals) {
        let rooms = 0;

        for (const other of intervals) {
            if (other.start <= start && start < other.end) rooms++;
        }

        answer = Math.max(answer, rooms);
    }

    return answer;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def minMeetingRooms(self, intervals):
        if not intervals:
            return 0

        intervals.sort()
        rooms = []

        for start, end in intervals:
            # Reuse the room that ends earliest
            if rooms and rooms[0] <= start:
                heapq.heappop(rooms)

            heapq.heappush(rooms, end)

        return len(rooms)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int minMeetingRooms(vector<Interval>& intervals) {
        if (intervals.empty()) return 0;

        sort(intervals.begin(), intervals.end(), [](const Interval& a, const Interval& b) {
            return a.start < b.start;
        });

        priority_queue<int, vector<int>, greater<int>> rooms;  // min-heap of end times

        for (auto& meeting : intervals) {
            // Reuse the room that ends earliest
            if (!rooms.empty() && rooms.top() <= meeting.start) rooms.pop();

            rooms.push(meeting.end);
        }

        return rooms.size();
    }
};
```

```java filename:Java
class Solution {
    public int minMeetingRooms(List<Interval> intervals) {
        if (intervals.isEmpty()) return 0;

        intervals.sort((a, b) -> Integer.compare(a.start, b.start));

        PriorityQueue<Integer> rooms = new PriorityQueue<>();  // min-heap of end times

        for (Interval meeting : intervals) {
            // Reuse the room that ends earliest
            if (!rooms.isEmpty() && rooms.peek() <= meeting.start) rooms.poll();

            rooms.offer(meeting.end);
        }

        return rooms.size();
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor(compare = (a, b) => a - b, items = []) {
        this.compare = compare;
        this.data = items;
        for (let i = (items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
    }

    size() { return this.data.length; }

    peek() { return this.data[0]; }

    push(value) {
        const data = this.data;
        data.push(value);
        let i = data.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.compare(data[i], data[parent]) >= 0) break;
            [data[i], data[parent]] = [data[parent], data[i]];
            i = parent;
        }
    }

    pop() {
        const data = this.data;
        const top = data[0];
        const last = data.pop();
        if (data.length > 0) {
            data[0] = last;
            this.siftDown(0);
        }
        return top;
    }

    siftDown(i) {
        const data = this.data;
        while (true) {
            const left = 2 * i + 1, right = left + 1;
            let smallest = i;
            if (left < data.length && this.compare(data[left], data[smallest]) < 0) smallest = left;
            if (right < data.length && this.compare(data[right], data[smallest]) < 0) smallest = right;
            if (smallest === i) return;
            [data[i], data[smallest]] = [data[smallest], data[i]];
            i = smallest;
        }
    }
}

var minMeetingRooms = function(intervals) {
    if (!intervals.length) return 0;

    intervals.sort((a, b) => a.start - b.start);
    const rooms = new MinHeap();  // end times

    for (const { start, end } of intervals) {
        // Reuse the room that ends earliest
        if (rooms.size() && rooms.peek() <= start) rooms.pop();

        rooms.push(end);
    }

    return rooms.size();
};
```

<strong>Time: O(n log n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Sort by start + Min-Heap of end times (earliest available room at the top)
