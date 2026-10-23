---
id: 6be35a47-a657-73c1-8951-00b1078d442d
key: problem:sheet-150/lc-215
subject: sheet-150
topic: heap
title: Kth Largest Element in an Array
slug: kth-largest-element-in-an-array
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 215](https://leetcode.com/problems/kth-largest-element-in-an-array/)

# Problem

Given an integer array `nums` and an integer `k`, return the `k`th largest element in the array.

# Understanding the problem

Find element at rank `k` without sorting the entire array.

# Intuition

Min Heap of size `k` gives $O(n \\log k)$ time. Alternatively, Quickselect achieves $O(n)$ average time in $O(1)$ auxiliary space.

# Approach

1. Method 1 (Min Heap): Push elements into min heap of size k. Return `heap[0]`.
2. Method 2 (Quickselect): Target index `target = len(nums) - k`.
3. Partition array around pivot. Recurse only into side containing `target` index.
4. Average time: O(n), Worst time: O(n²).

# Naive Solution — Brute Force

Sort array in descending order and return element at index `k - 1`.

```python filename:Python
class Solution:
    def findKthLargest(self, nums, k):
        nums.sort(reverse=True)

        return nums[k - 1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        sort(nums.begin(), nums.end(), greater<int>());

        return nums[k - 1];
    }
};
```

```java filename:Java
class Solution {
    public int findKthLargest(int[] nums, int k) {
        Arrays.sort(nums);

        // Sorted ascending, so the kth largest is k from the end
        return nums[nums.length - k];
    }
}
```

```javascript filename:JavaScript
var findKthLargest = function(nums, k) {
    nums.sort((a, b) => b - a);

    return nums[k - 1];
};
```

<strong>Time: O(n log n) · Space: O(1) aux</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def findKthLargest(self, nums, k):

        heap = []

        for num in nums:
            heapq.heappush(heap, num)

            if len(heap) > k:
                heapq.heappop(heap)

        return heap[0]

# --- Alternative: Quickselect O(n) average ---
class SolutionQuickselect:
    def findKthLargest(self, nums, k):

        target = len(nums) - k

        def quickselect(left, right):
            pivot = nums[right]
            partition_index = left

            for i in range(left, right):
                if nums[i] <= pivot:
                    nums[i], nums[partition_index] = nums[partition_index], nums[i]
                    partition_index += 1

            nums[partition_index], nums[right] = nums[right], nums[partition_index]

            if partition_index == target:
                return nums[partition_index]

            if partition_index < target:
                return quickselect(partition_index + 1, right)

            return quickselect(left, partition_index - 1)

        return quickselect(0, len(nums) - 1)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        priority_queue<int, vector<int>, greater<int>> heap;  // min-heap

        for (int num : nums) {
            heap.push(num);

            if ((int)heap.size() > k) heap.pop();
        }

        return heap.top();
    }
};

// --- Alternative: Quickselect O(n) average ---
class SolutionQuickselect {
public:
    int findKthLargest(vector<int>& nums, int k) {
        int target = nums.size() - k;

        function<int(int, int)> quickselect = [&](int left, int right) {
            int pivot = nums[right];
            int partitionIndex = left;

            for (int i = left; i < right; i++) {
                if (nums[i] <= pivot) {
                    swap(nums[i], nums[partitionIndex]);
                    partitionIndex++;
                }
            }

            swap(nums[partitionIndex], nums[right]);

            if (partitionIndex == target) return nums[partitionIndex];

            if (partitionIndex < target) return quickselect(partitionIndex + 1, right);

            return quickselect(left, partitionIndex - 1);
        };

        return quickselect(0, nums.size() - 1);
    }
};
```

```java filename:Java
class Solution {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();  // min-heap

        for (int num : nums) {
            heap.offer(num);

            if (heap.size() > k) heap.poll();
        }

        return heap.peek();
    }
}

// --- Alternative: Quickselect O(n) average ---
class SolutionQuickselect {
    public int findKthLargest(int[] nums, int k) {
        return quickselect(nums, 0, nums.length - 1, nums.length - k);
    }

    private int quickselect(int[] nums, int left, int right, int target) {
        int pivot = nums[right];
        int partitionIndex = left;

        for (int i = left; i < right; i++) {
            if (nums[i] <= pivot) {
                swap(nums, i, partitionIndex);
                partitionIndex++;
            }
        }

        swap(nums, partitionIndex, right);

        if (partitionIndex == target) return nums[partitionIndex];

        if (partitionIndex < target) return quickselect(nums, partitionIndex + 1, right, target);

        return quickselect(nums, left, partitionIndex - 1, target);
    }

    private void swap(int[] nums, int i, int j) {
        int temp = nums[i];
        nums[i] = nums[j];
        nums[j] = temp;
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

var findKthLargest = function(nums, k) {
    const heap = new MinHeap();

    for (const num of nums) {
        heap.push(num);

        if (heap.size() > k) heap.pop();
    }

    return heap.peek();
};

// --- Alternative: Quickselect O(n) average ---
var findKthLargestQuickselect = function(nums, k) {
    const target = nums.length - k;

    const quickselect = (left, right) => {
        const pivot = nums[right];
        let partitionIndex = left;

        for (let i = left; i < right; i++) {
            if (nums[i] <= pivot) {
                [nums[i], nums[partitionIndex]] = [nums[partitionIndex], nums[i]];
                partitionIndex++;
            }
        }

        [nums[partitionIndex], nums[right]] = [nums[right], nums[partitionIndex]];

        if (partitionIndex === target) return nums[partitionIndex];

        if (partitionIndex < target) return quickselect(partitionIndex + 1, right);

        return quickselect(left, partitionIndex - 1);
    };

    return quickselect(0, nums.length - 1);
};
```

<strong>Heap: O(n log k) | Quickselect: O(n) avg · Heap: O(k) | Quickselect: O(1) aux</strong>

# Takeaway

<strong>Pattern</strong> — Kth Largest → Min Heap of size K OR Quickselect
