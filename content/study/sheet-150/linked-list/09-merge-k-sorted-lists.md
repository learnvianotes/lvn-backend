---
id: 4b24a2ba-c924-75d8-a61a-4c2d8c5c5b18
key: problem:sheet-150/lc-23
subject: sheet-150
topic: linked-list
title: Merge k Sorted Lists
slug: merge-k-sorted-lists
order: 9
---

Difficulty: <strong>Hard</strong> · [LeetCode 23](https://leetcode.com/problems/merge-k-sorted-lists/)

# Problem

You are given an array of `k` linked-lists, each sorted in ascending order. Merge all into one sorted list.

# Understanding the problem

Merge multiple sorted streams efficiently.

# Intuition

Min Heap: maintain a heap of size `k` holding current head of each list `(node.val, i, node)`.

# Approach

1. Push initial head node of each non-empty list into min heap.
2. Pop min element from heap, append to merged list.
3. If popped node has a `next` node, push `(next.val, i, next)` into heap.
4. Repeat until heap is empty.

# Naive Solution — Brute Force

Extract all node values into an array, sort array, build new list.

```python filename:Python
class Solution:
    def mergeKLists(self, lists):
        values = []

        for head in lists:
            while head:
                values.append(head.val)
                head = head.next

        values.sort()

        dummy = ListNode()
        current = dummy

        for value in values:
            current.next = ListNode(value)
            current = current.next

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* mergeKLists(vector<ListNode*>& lists) {
        vector<int> values;

        for (ListNode* head : lists) {
            while (head) {
                values.push_back(head->val);
                head = head->next;
            }
        }

        sort(values.begin(), values.end());

        ListNode dummy;
        ListNode* current = &dummy;

        for (int value : values) {
            current->next = new ListNode(value);
            current = current->next;
        }

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        List<Integer> values = new ArrayList<>();

        for (ListNode head : lists) {
            while (head != null) {
                values.add(head.val);
                head = head.next;
            }
        }

        Collections.sort(values);

        ListNode dummy = new ListNode();
        ListNode current = dummy;

        for (int value : values) {
            current.next = new ListNode(value);
            current = current.next;
        }

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var mergeKLists = function(lists) {
    const values = [];

    for (let head of lists) {
        while (head) {
            values.push(head.val);
            head = head.next;
        }
    }

    values.sort((a, b) => a - b);

    const dummy = new ListNode();
    let current = dummy;

    for (const value of values) {
        current.next = new ListNode(value);
        current = current.next;
    }

    return dummy.next;
};
```

<strong>Time: O(N log N) · Space: O(N)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq

class Solution:
    def mergeKLists(self, lists):
        heap = []

        for i, node in enumerate(lists):
            if node:
                heapq.heappush(
                    heap,
                    (node.val, i, node)
                )

        dummy = ListNode()
        current = dummy

        while heap:
            value, i, node = heapq.heappop(heap)

            current.next = node
            current = current.next

            if node.next:
                heapq.heappush(
                    heap,
                    (
                        node.next.val,
                        i,
                        node.next
                    )
                )

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* mergeKLists(vector<ListNode*>& lists) {
        using Entry = tuple<int, int, ListNode*>;
        priority_queue<Entry, vector<Entry>, greater<Entry>> heap;

        for (int i = 0; i < lists.size(); i++) {
            if (lists[i]) {
                heap.push({lists[i]->val, i, lists[i]});
            }
        }

        ListNode dummy;
        ListNode* current = &dummy;

        while (!heap.empty()) {
            auto [value, i, node] = heap.top();
            heap.pop();

            current->next = node;
            current = current->next;

            if (node->next) {
                heap.push({node->next->val, i, node->next});
            }
        }

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));

        for (ListNode node : lists) {
            if (node != null) {
                heap.offer(node);
            }
        }

        ListNode dummy = new ListNode();
        ListNode current = dummy;

        while (!heap.isEmpty()) {
            ListNode node = heap.poll();

            current.next = node;
            current = current.next;

            if (node.next != null) {
                heap.offer(node.next);
            }
        }

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var mergeKLists = function(lists) {
    // Minimal binary min-heap of nodes keyed by val
    const heap = [];

    const push = (node) => {
        heap.push(node);
        let i = heap.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (heap[parent].val <= heap[i].val) break;
            [heap[parent], heap[i]] = [heap[i], heap[parent]];
            i = parent;
        }
    };

    const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let i = 0;
            while (true) {
                const l = 2 * i + 1, r = l + 1;
                let smallest = i;
                if (l < heap.length && heap[l].val < heap[smallest].val) smallest = l;
                if (r < heap.length && heap[r].val < heap[smallest].val) smallest = r;
                if (smallest === i) break;
                [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
                i = smallest;
            }
        }
        return top;
    };

    for (const node of lists) {
        if (node) {
            push(node);
        }
    }

    const dummy = new ListNode();
    let current = dummy;

    while (heap.length) {
        const node = pop();

        current.next = node;
        current = current.next;

        if (node.next) {
            push(node.next);
        }
    }

    return dummy.next;
};
```

<strong>Time: O(N log k) · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Multiple sorted streams → Min Heap
