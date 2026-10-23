---
id: 469378e7-610b-7aa4-a81e-1073240697d3
key: problem:sheet-150/lc-703
subject: sheet-150
topic: heap
title: Kth Largest Element in a Stream
slug: kth-largest-element-in-a-stream
order: 6
---

Difficulty: <strong>Easy</strong> · [LeetCode 703](https://leetcode.com/problems/kth-largest-element-in-a-stream/)

# Problem

Design a class to find the `k`th largest element in a stream. The stream receives numbers dynamically, and after every insertion we need the `k`th largest.

# Understanding the problem

The `k`th largest element corresponds to the smallest element among the top `k` largest elements.

# Intuition

Maintain a Min Heap of size exactly `k`. The root of the Min Heap `heap[0]` will always be the `k`th largest element.

# Approach

1. Initialize a min heap with array `nums` and call `heapq.heapify()`.
2. Pop elements until size is `k`.
3. On `add(val)`: push `val` into heap.
4. If heap size exceeds `k`, pop smallest element.
5. Return `heap[0]` in O(1) time.

# Naive Solution — Brute Force

Store all incoming numbers in a list and re-sort descending on every `add()` call.

```python filename:Python
class KthLargest:

    def __init__(self, k, nums):
        self.k = k
        self.nums = nums

    def add(self, val):
        self.nums.append(val)
        self.nums.sort(reverse=True)

        return self.nums[self.k - 1]
```

```cpp filename:C%2B%2B
class KthLargest {
    int k;
    vector<int> nums;

public:
    KthLargest(int k, vector<int>& nums) : k(k), nums(nums) {}

    int add(int val) {
        nums.push_back(val);
        sort(nums.begin(), nums.end(), greater<int>());

        return nums[k - 1];
    }
};
```

```java filename:Java
class KthLargest {
    private int k;
    private List<Integer> nums = new ArrayList<>();

    public KthLargest(int k, int[] nums) {
        this.k = k;
        for (int num : nums) this.nums.add(num);
    }

    public int add(int val) {
        nums.add(val);
        nums.sort(Collections.reverseOrder());

        return nums.get(k - 1);
    }
}
```

```javascript filename:JavaScript
class KthLargest {
    constructor(k, nums) {
        this.k = k;
        this.nums = nums;
    }

    add(val) {
        this.nums.push(val);
        this.nums.sort((a, b) => b - a);

        return this.nums[this.k - 1];
    }
}
```

<strong>Time: O(n log n) per add() · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class KthLargest:

    def __init__(self, k, nums):
        self.k = k
        self.heap = nums

        heapq.heapify(self.heap)

        while len(self.heap) > k:
            heapq.heappop(self.heap)

    def add(self, val):
        heapq.heappush(self.heap, val)

        if len(self.heap) > self.k:
            heapq.heappop(self.heap)

        return self.heap[0]
```

```cpp filename:C%2B%2B
class KthLargest {
    int k;
    priority_queue<int, vector<int>, greater<int>> heap;  // min-heap

public:
    KthLargest(int k, vector<int>& nums) : k(k), heap(nums.begin(), nums.end()) {
        while ((int)heap.size() > k) heap.pop();
    }

    int add(int val) {
        heap.push(val);

        if ((int)heap.size() > k) heap.pop();

        return heap.top();
    }
};
```

```java filename:Java
class KthLargest {
    private int k;
    private PriorityQueue<Integer> heap = new PriorityQueue<>();  // min-heap

    public KthLargest(int k, int[] nums) {
        this.k = k;
        for (int num : nums) heap.offer(num);

        while (heap.size() > k) heap.poll();
    }

    public int add(int val) {
        heap.offer(val);

        if (heap.size() > k) heap.poll();

        return heap.peek();
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

class KthLargest {
    constructor(k, nums) {
        this.k = k;
        this.heap = new MinHeap((a, b) => a - b, nums);

        while (this.heap.size() > k) this.heap.pop();
    }

    add(val) {
        this.heap.push(val);

        if (this.heap.size() > this.k) this.heap.pop();

        return this.heap.peek();
    }
}
```

<strong>Time: O(log k) per add() · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Kth largest in stream → Min Heap of size K
