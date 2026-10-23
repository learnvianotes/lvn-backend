---
id: b3dacf2c-a07b-7302-b75f-782b72f90116
key: problem:sheet-150/lc-295
subject: sheet-150
topic: heap
title: Find Median From Data Stream
slug: find-median-from-data-stream
order: 3
---

Difficulty: <strong>Hard</strong> · [LeetCode 295](https://leetcode.com/problems/find-median-from-data-stream/)

# Problem

Design a data structure supporting `addNum(num)` and `findMedian()` on continuous stream of integers.

# Understanding the problem

Median is middle element (odd count) or average of two middle elements (even count).

# Intuition

Two Heaps Pattern: Max Heap `small` for smaller half of numbers, Min Heap `large` for larger half of numbers.

# Approach

1. Maintain `small` (Max Heap) and `large` (Min Heap).
2. Push `num` into `small`.
3. If `-small[0] > large[0]`, move root from `small` to `large`.
4. Rebalance sizes so `len(small) == len(large)` or `len(small) == len(large) + 1`.
5. `findMedian()` returns `-small[0]` (if odd) or average of roots (if even) in O(1) time.

# Naive Solution — Brute Force

Append numbers to list and sort array every time `findMedian()` is called.

```python filename:Python
class MedianFinder:

    def __init__(self):
        self.nums = []

    def addNum(self, num):
        self.nums.append(num)

    def findMedian(self):
        self.nums.sort()

        n = len(self.nums)

        if n % 2:
            return self.nums[n // 2]

        return (
            self.nums[n // 2 - 1]
            + self.nums[n // 2]
        ) / 2
```

```cpp filename:C%2B%2B
class MedianFinder {
    vector<int> nums;

public:
    MedianFinder() {}

    void addNum(int num) {
        nums.push_back(num);
    }

    double findMedian() {
        sort(nums.begin(), nums.end());

        int n = nums.size();

        if (n % 2) return nums[n / 2];

        return (nums[n / 2 - 1] + nums[n / 2]) / 2.0;
    }
};
```

```java filename:Java
class MedianFinder {
    private List<Integer> nums = new ArrayList<>();

    public MedianFinder() {}

    public void addNum(int num) {
        nums.add(num);
    }

    public double findMedian() {
        Collections.sort(nums);

        int n = nums.size();

        if (n % 2 == 1) return nums.get(n / 2);

        return (nums.get(n / 2 - 1) + nums.get(n / 2)) / 2.0;
    }
}
```

```javascript filename:JavaScript
class MedianFinder {
    constructor() {
        this.nums = [];
    }

    addNum(num) {
        this.nums.push(num);
    }

    findMedian() {
        this.nums.sort((a, b) => a - b);

        const n = this.nums.length;

        if (n % 2) return this.nums[n >> 1];

        return (this.nums[n / 2 - 1] + this.nums[n / 2]) / 2;
    }
}
```

<strong>add: O(1), findMedian: O(n log n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class MedianFinder:

    def __init__(self):
        self.small = []  # max heap
        self.large = []  # min heap

    def addNum(self, num):

        heapq.heappush(
            self.small,
            -num
        )

        # Ensure every small <= every large
        if (
            self.small
            and self.large
            and -self.small[0] > self.large[0]
        ):
            value = -heapq.heappop(self.small)

            heapq.heappush(
                self.large,
                value
            )

        # Balance sizes
        if len(self.small) > len(self.large) + 1:
            value = -heapq.heappop(self.small)

            heapq.heappush(
                self.large,
                value
            )

        elif len(self.large) > len(self.small):
            value = heapq.heappop(self.large)

            heapq.heappush(
                self.small,
                -value
            )

    def findMedian(self):

        if len(self.small) > len(self.large):
            return -self.small[0]

        return (
            -self.small[0]
            + self.large[0]
        ) / 2
```

```cpp filename:C%2B%2B
class MedianFinder {
    priority_queue<int> small;                             // max-heap
    priority_queue<int, vector<int>, greater<int>> large;  // min-heap

public:
    MedianFinder() {}

    void addNum(int num) {
        small.push(num);

        // Ensure every small <= every large
        if (!small.empty() && !large.empty() && small.top() > large.top()) {
            large.push(small.top());
            small.pop();
        }

        // Balance sizes
        if (small.size() > large.size() + 1) {
            large.push(small.top());
            small.pop();
        } else if (large.size() > small.size()) {
            small.push(large.top());
            large.pop();
        }
    }

    double findMedian() {
        if (small.size() > large.size()) return small.top();

        return (small.top() + large.top()) / 2.0;
    }
};
```

```java filename:Java
class MedianFinder {
    private PriorityQueue<Integer> small = new PriorityQueue<>(Collections.reverseOrder());  // max-heap
    private PriorityQueue<Integer> large = new PriorityQueue<>();                            // min-heap

    public MedianFinder() {}

    public void addNum(int num) {
        small.offer(num);

        // Ensure every small <= every large
        if (!small.isEmpty() && !large.isEmpty() && small.peek() > large.peek()) {
            large.offer(small.poll());
        }

        // Balance sizes
        if (small.size() > large.size() + 1) {
            large.offer(small.poll());
        } else if (large.size() > small.size()) {
            small.offer(large.poll());
        }
    }

    public double findMedian() {
        if (small.size() > large.size()) return small.peek();

        return (small.peek() + large.peek()) / 2.0;
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

class MedianFinder {
    constructor() {
        this.small = new MinHeap((a, b) => b - a);  // max-heap
        this.large = new MinHeap((a, b) => a - b);  // min-heap
    }

    addNum(num) {
        this.small.push(num);

        // Ensure every small <= every large
        if (this.small.size() && this.large.size() && this.small.peek() > this.large.peek()) {
            this.large.push(this.small.pop());
        }

        // Balance sizes
        if (this.small.size() > this.large.size() + 1) {
            this.large.push(this.small.pop());
        } else if (this.large.size() > this.small.size()) {
            this.small.push(this.large.pop());
        }
    }

    findMedian() {
        if (this.small.size() > this.large.size()) return this.small.peek();

        return (this.small.peek() + this.large.peek()) / 2;
    }
}
```

<strong>add: O(log n), findMedian: O(1) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Dynamic Median → Two Heaps (Max Heap + Min Heap)
