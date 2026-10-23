---
id: e72ef51d-907f-7437-a0c3-431316425dd6
key: problem:sheet-150/lc-1851
subject: sheet-150
topic: intervals
title: Minimum Interval to Include Each Query
slug: minimum-interval-to-include-each-query
order: 1
---

Difficulty: <strong>Hard</strong> · [LeetCode 1851](https://leetcode.com/problems/minimum-interval-to-include-each-query/)

# Problem

Given intervals and queries, for each query return the size of the smallest interval that contains it, or -1 if none exists.

# Understanding the problem

Sorting both intervals and queries lets us add intervals incrementally as queries grow. A min-heap ordered by interval size keeps the best candidate at the top. Expired intervals (those ending before the current query) are lazily removed.

# Intuition

Sort intervals by start and queries (with original indices) by value. Sweep queries left-to-right: push all intervals whose start ≤ query onto a min-heap keyed by size. Pop intervals from the heap whose end &lt; query (expired). The heap top is the smallest valid interval.

# Approach

1. Sort `intervals` by start.
2. Create `sorted_queries = sorted((q, i) for i, q in enumerate(queries))`.
3. Initialize `result = [-1] * len(queries)`, `heap = []`, `i = 0`.
4. For each `(query, original_index)`: push all intervals with `start <= query` as `(size, end)`.
5. Pop heap entries where `end < query` (expired intervals).
6. If heap is non-empty: `result[original_index] = heap[0][0]`.
7. Return `result`.

# Naive Solution — Brute Force

For every query, scan all intervals linearly and find the smallest containing one.

```python filename:Python
class Solution:
    def minInterval(self, intervals, queries):
        result = []

        for query in queries:
            best = float("inf")

            for start, end in intervals:
                if start <= query <= end:
                    size = end - start + 1
                    best = min(best, size)

            result.append(-1 if best == float("inf") else best)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> minInterval(vector<vector<int>>& intervals, vector<int>& queries) {
        vector<int> result;

        for (int query : queries) {
            int best = INT_MAX;

            for (auto& interval : intervals) {
                int start = interval[0], end = interval[1];

                if (start <= query && query <= end) {
                    int size = end - start + 1;
                    best = min(best, size);
                }
            }

            result.push_back(best == INT_MAX ? -1 : best);
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] minInterval(int[][] intervals, int[] queries) {
        int[] result = new int[queries.length];

        for (int q = 0; q < queries.length; q++) {
            int query = queries[q];
            int best = Integer.MAX_VALUE;

            for (int[] interval : intervals) {
                int start = interval[0], end = interval[1];

                if (start <= query && query <= end) {
                    int size = end - start + 1;
                    best = Math.min(best, size);
                }
            }

            result[q] = best == Integer.MAX_VALUE ? -1 : best;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var minInterval = function(intervals, queries) {
    const result = [];

    for (const query of queries) {
        let best = Infinity;

        for (const [start, end] of intervals) {
            if (start <= query && query <= end) {
                const size = end - start + 1;
                best = Math.min(best, size);
            }
        }

        result.push(best === Infinity ? -1 : best);
    }

    return result;
};
```

<strong>Time: O(n × q) · Space: O(q)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def minInterval(self, intervals, queries):
        intervals.sort()

        sorted_queries = sorted(
            (query, i)
            for i, query in enumerate(queries)
        )

        result = [-1] * len(queries)
        heap = []
        i = 0

        for query, original_index in sorted_queries:

            # Add all intervals whose start <= query
            while i < len(intervals) and intervals[i][0] <= query:
                start, end = intervals[i]
                size = end - start + 1
                heapq.heappush(heap, (size, end))
                i += 1

            # Remove intervals that ended before this query
            while heap and heap[0][1] < query:
                heapq.heappop(heap)

            if heap:
                result[original_index] = heap[0][0]

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> minInterval(vector<vector<int>>& intervals, vector<int>& queries) {
        sort(intervals.begin(), intervals.end());

        vector<pair<int, int>> sortedQueries;  // {query, original index}
        for (int i = 0; i < (int)queries.size(); i++) sortedQueries.push_back({queries[i], i});
        sort(sortedQueries.begin(), sortedQueries.end());

        vector<int> result(queries.size(), -1);
        // min-heap of {size, end}
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> heap;
        int i = 0;

        for (auto [query, originalIndex] : sortedQueries) {
            // Add all intervals whose start <= query
            while (i < (int)intervals.size() && intervals[i][0] <= query) {
                int start = intervals[i][0], end = intervals[i][1];
                int size = end - start + 1;
                heap.push({size, end});
                i++;
            }

            // Remove intervals that ended before this query
            while (!heap.empty() && heap.top().second < query) heap.pop();

            if (!heap.empty()) result[originalIndex] = heap.top().first;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[] minInterval(int[][] intervals, int[] queries) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));

        Integer[] sortedQueries = new Integer[queries.length];  // original indices, sorted by query
        for (int i = 0; i < queries.length; i++) sortedQueries[i] = i;
        Arrays.sort(sortedQueries, (a, b) -> Integer.compare(queries[a], queries[b]));

        int[] result = new int[queries.length];
        Arrays.fill(result, -1);

        // min-heap of {size, end}
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1])
        );
        int i = 0;

        for (int originalIndex : sortedQueries) {
            int query = queries[originalIndex];

            // Add all intervals whose start <= query
            while (i < intervals.length && intervals[i][0] <= query) {
                int start = intervals[i][0], end = intervals[i][1];
                int size = end - start + 1;
                heap.offer(new int[]{size, end});
                i++;
            }

            // Remove intervals that ended before this query
            while (!heap.isEmpty() && heap.peek()[1] < query) heap.poll();

            if (!heap.isEmpty()) result[originalIndex] = heap.peek()[0];
        }

        return result;
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

var minInterval = function(intervals, queries) {
    intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    const sortedQueries = queries
        .map((query, i) => [query, i])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    const result = new Array(queries.length).fill(-1);
    const heap = new MinHeap((a, b) => a[0] - b[0] || a[1] - b[1]);  // [size, end]
    let i = 0;

    for (const [query, originalIndex] of sortedQueries) {
        // Add all intervals whose start <= query
        while (i < intervals.length && intervals[i][0] <= query) {
            const [start, end] = intervals[i];
            const size = end - start + 1;
            heap.push([size, end]);
            i++;
        }

        // Remove intervals that ended before this query
        while (heap.size() && heap.peek()[1] < query) heap.pop();

        if (heap.size()) result[originalIndex] = heap.peek()[0];
    }

    return result;
};
```

<strong>Time: O(n log n + q log q) · Space: O(n + q)</strong>

# Takeaway

<strong>Pattern</strong> — Sort intervals by start + sort queries + Min-Heap by size (lazy-remove expired intervals)
