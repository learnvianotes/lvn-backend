---
id: 8d4466c2-7cd6-7e93-b6f8-73af2ab12e59
key: problem:sheet-150/lc-1046
subject: sheet-150
topic: heap
title: Last Stone Weight
slug: last-stone-weight
order: 1
---

Difficulty: <strong>Easy</strong> · [LeetCode 1046](https://leetcode.com/problems/last-stone-weight/)

# Problem

Simulate stone smashing: each step choose the two heaviest stones `x` and `y` (with `x <= y`). If `x == y` both destroyed, else remaining stone is `y - x`.

# Understanding the problem

Repeatedly extract the 2 maximum elements until at most 1 stone remains.

# Intuition

Use a Max Heap. In Python, invert stone weights (negate values) to build a max heap with `heapq`.

# Approach

1. Convert stones to negative values: `heap = [-s for s in stones]`.
2. Heapify array in O(n) time.
3. While `len(heap) > 1`: pop `y` and `x`.
4. If `y != x`, push negated difference `-(y - x)` back into heap.
5. Return `-heap[0]` if heap non-empty else 0.

# Naive Solution — Brute Force

Sort the stones array descending on every iteration and pop the two largest.

```python filename:Python
class Solution:
    def lastStoneWeight(self, stones):

        while len(stones) > 1:
            stones.sort()

            y = stones.pop()
            x = stones.pop()

            if y != x:
                stones.append(y - x)

        return stones[0] if stones else 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    int lastStoneWeight(vector<int>& stones) {
        while (stones.size() > 1) {
            sort(stones.begin(), stones.end());

            int y = stones.back(); stones.pop_back();
            int x = stones.back(); stones.pop_back();

            if (y != x) stones.push_back(y - x);
        }

        return stones.empty() ? 0 : stones[0];
    }
};
```

```java filename:Java
class Solution {
    public int lastStoneWeight(int[] stones) {
        List<Integer> list = new ArrayList<>();
        for (int stone : stones) list.add(stone);

        while (list.size() > 1) {
            Collections.sort(list);

            int y = list.remove(list.size() - 1);
            int x = list.remove(list.size() - 1);

            if (y != x) list.add(y - x);
        }

        return list.isEmpty() ? 0 : list.get(0);
    }
}
```

```javascript filename:JavaScript
var lastStoneWeight = function(stones) {
    while (stones.length > 1) {
        stones.sort((a, b) => a - b);

        const y = stones.pop();
        const x = stones.pop();

        if (y !== x) stones.push(y - x);
    }

    return stones.length ? stones[0] : 0;
};
```

<strong>Time: O(n² log n) · Space: O(1) aux</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def lastStoneWeight(self, stones):

        heap = [-stone for stone in stones]
        heapq.heapify(heap)

        while len(heap) > 1:
            y = -heapq.heappop(heap)
            x = -heapq.heappop(heap)

            if y != x:
                heapq.heappush(
                    heap,
                    -(y - x)
                )

        return -heap[0] if heap else 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    int lastStoneWeight(vector<int>& stones) {
        priority_queue<int> heap(stones.begin(), stones.end());  // max-heap

        while (heap.size() > 1) {
            int y = heap.top(); heap.pop();
            int x = heap.top(); heap.pop();

            if (y != x) heap.push(y - x);
        }

        return heap.empty() ? 0 : heap.top();
    }
};
```

```java filename:Java
class Solution {
    public int lastStoneWeight(int[] stones) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(Collections.reverseOrder());  // max-heap
        for (int stone : stones) heap.offer(stone);

        while (heap.size() > 1) {
            int y = heap.poll();
            int x = heap.poll();

            if (y != x) heap.offer(y - x);
        }

        return heap.isEmpty() ? 0 : heap.peek();
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

var lastStoneWeight = function(stones) {
    const heap = new MinHeap((a, b) => b - a, [...stones]);  // max-heap

    while (heap.size() > 1) {
        const y = heap.pop();
        const x = heap.pop();

        if (y !== x) heap.push(y - x);
    }

    return heap.size() ? heap.peek() : 0;
};
```

<strong>Time: O(n log n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Repeatedly extract maximum element → Max Heap
