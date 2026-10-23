---
id: efebe958-3c64-73f4-82a9-b2ab16aeeb0e
key: problem:sheet-150/lc-973
subject: sheet-150
topic: heap
title: K Closest Points to Origin
slug: k-closest-points-to-origin
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 973](https://leetcode.com/problems/k-closest-points-to-origin/)

# Problem

Given an array of `points` where `points[i] = [xi, yi]` and an integer `k`, return the `k` closest points to origin `(0,0)`.

# Understanding the problem

Distance formula $x^2 + y^2$. We don't need square root since relative ordering is identical.

# Intuition

Maintain a Max Heap of size `k`. The top of the heap is the farthest point among the top `k` closest, allowing us to drop points with distance greater than current `k`th closest.

# Approach

1. Iterate through points `(x, y)`.
2. Compute `distance = x * x + y * y`.
3. Push `(-distance, x, y)` into max heap.
4. If heap size exceeds `k`, pop top (farthest point).
5. Return `[[x, y] for _, x, y in heap]`.

# Naive Solution — Brute Force

Calculate distance squared for all points and sort array.

```python filename:Python
class Solution:
    def kClosest(self, points, k):

        points.sort(
            key=lambda p: p[0] ** 2 + p[1] ** 2
        )

        return points[:k]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> kClosest(vector<vector<int>>& points, int k) {
        sort(points.begin(), points.end(), [](const vector<int>& a, const vector<int>& b) {
            return a[0] * a[0] + a[1] * a[1] < b[0] * b[0] + b[1] * b[1];
        });

        return vector<vector<int>>(points.begin(), points.begin() + k);
    }
};
```

```java filename:Java
class Solution {
    public int[][] kClosest(int[][] points, int k) {
        Arrays.sort(points, (a, b) -> Integer.compare(
            a[0] * a[0] + a[1] * a[1],
            b[0] * b[0] + b[1] * b[1]
        ));

        return Arrays.copyOf(points, k);
    }
}
```

```javascript filename:JavaScript
var kClosest = function(points, k) {
    points.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));

    return points.slice(0, k);
};
```

<strong>Time: O(n log n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def kClosest(self, points, k):

        heap = []

        for x, y in points:
            distance = x * x + y * y

            heapq.heappush(
                heap,
                (-distance, x, y)
            )

            if len(heap) > k:
                heapq.heappop(heap)

        return [
            [x, y]
            for _, x, y in heap
        ]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<int>> kClosest(vector<vector<int>>& points, int k) {
        priority_queue<array<int, 3>> heap;  // max-heap by distance

        for (auto& p : points) {
            int x = p[0], y = p[1];
            int distance = x * x + y * y;

            heap.push({distance, x, y});

            if ((int)heap.size() > k) heap.pop();
        }

        vector<vector<int>> result;
        while (!heap.empty()) {
            auto [_, x, y] = heap.top();
            heap.pop();
            result.push_back({x, y});
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public int[][] kClosest(int[][] points, int k) {
        // max-heap by distance: {distance, x, y}
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(b[0], a[0]));

        for (int[] p : points) {
            int x = p[0], y = p[1];
            int distance = x * x + y * y;

            heap.offer(new int[]{distance, x, y});

            if (heap.size() > k) heap.poll();
        }

        int[][] result = new int[heap.size()][];
        int i = 0;
        for (int[] entry : heap) {
            result[i++] = new int[]{entry[1], entry[2]};
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

var kClosest = function(points, k) {
    const heap = new MinHeap((a, b) => b[0] - a[0]);  // max-heap by distance

    for (const [x, y] of points) {
        const distance = x * x + y * y;

        heap.push([distance, x, y]);

        if (heap.size() > k) heap.pop();
    }

    return heap.data.map(([, x, y]) => [x, y]);
};
```

<strong>Time: O(n log k) · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Need K smallest items → Max Heap of size K
