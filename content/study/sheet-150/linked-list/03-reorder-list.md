---
id: a928a651-7e68-703a-bf9a-17e86fa80312
key: problem:sheet-150/lc-143
subject: sheet-150
topic: linked-list
title: Reorder List
slug: reorder-list
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 143](https://leetcode.com/problems/reorder-list/)

# Problem

Reorder list to follow: L0 → Ln → L1 → Ln-1 → L2 → ...

# Understanding the problem

Interleave first half with reversed second half.

# Intuition

Three steps in O(1) space: 1. Find middle (Fast/Slow) -&gt; 2. Reverse second half -&gt; 3. Interleave merge.

# Approach

1. Find middle: `slow` and `fast` pointers.
2. Reverse second half starting at `slow.next`, split list.
3. Interleave merge two lists `first` and `second`.

# Naive Solution — Brute Force

Store node references in array, set left/right pointers to re-link.

```python filename:Python
class Solution:
    def reorderList(self, head):
        nodes = []

        current = head

        while current:
            nodes.append(current)
            current = current.next

        left = 0
        right = len(nodes) - 1

        while left < right:
            nodes[left].next = nodes[right]
            left += 1

            if left == right:
                break

            nodes[right].next = nodes[left]
            right -= 1

        nodes[left].next = None
```

```cpp filename:C%2B%2B
class Solution {
public:
    void reorderList(ListNode* head) {
        vector<ListNode*> nodes;

        ListNode* current = head;

        while (current) {
            nodes.push_back(current);
            current = current->next;
        }

        int left = 0;
        int right = nodes.size() - 1;

        while (left < right) {
            nodes[left]->next = nodes[right];
            left++;

            if (left == right) {
                break;
            }

            nodes[right]->next = nodes[left];
            right--;
        }

        nodes[left]->next = nullptr;
    }
};
```

```java filename:Java
class Solution {
    public void reorderList(ListNode head) {
        List<ListNode> nodes = new ArrayList<>();

        ListNode current = head;

        while (current != null) {
            nodes.add(current);
            current = current.next;
        }

        int left = 0;
        int right = nodes.size() - 1;

        while (left < right) {
            nodes.get(left).next = nodes.get(right);
            left++;

            if (left == right) {
                break;
            }

            nodes.get(right).next = nodes.get(left);
            right--;
        }

        nodes.get(left).next = null;
    }
}
```

```javascript filename:JavaScript
var reorderList = function(head) {
    const nodes = [];

    let current = head;

    while (current) {
        nodes.push(current);
        current = current.next;
    }

    let left = 0;
    let right = nodes.length - 1;

    while (left < right) {
        nodes[left].next = nodes[right];
        left++;

        if (left === right) {
            break;
        }

        nodes[right].next = nodes[left];
        right--;
    }

    nodes[left].next = null;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def reorderList(self, head):
        if not head or not head.next:
            return

        # Find middle
        slow = head
        fast = head

        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next

        # Reverse second half
        second = slow.next
        slow.next = None

        previous = None

        while second:
            next_node = second.next
            second.next = previous
            previous = second
            second = next_node

        second = previous
        first = head

        # Merge
        while second:
            first_next = first.next
            second_next = second.next

            first.next = second
            second.next = first_next

            first = first_next
            second = second_next
```

```cpp filename:C%2B%2B
class Solution {
public:
    void reorderList(ListNode* head) {
        if (!head || !head->next) {
            return;
        }

        // Find middle
        ListNode* slow = head;
        ListNode* fast = head;

        while (fast && fast->next) {
            slow = slow->next;
            fast = fast->next->next;
        }

        // Reverse second half
        ListNode* second = slow->next;
        slow->next = nullptr;

        ListNode* previous = nullptr;

        while (second) {
            ListNode* nextNode = second->next;
            second->next = previous;
            previous = second;
            second = nextNode;
        }

        second = previous;
        ListNode* first = head;

        // Merge
        while (second) {
            ListNode* firstNext = first->next;
            ListNode* secondNext = second->next;

            first->next = second;
            second->next = firstNext;

            first = firstNext;
            second = secondNext;
        }
    }
};
```

```java filename:Java
class Solution {
    public void reorderList(ListNode head) {
        if (head == null || head.next == null) {
            return;
        }

        // Find middle
        ListNode slow = head;
        ListNode fast = head;

        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }

        // Reverse second half
        ListNode second = slow.next;
        slow.next = null;

        ListNode previous = null;

        while (second != null) {
            ListNode nextNode = second.next;
            second.next = previous;
            previous = second;
            second = nextNode;
        }

        second = previous;
        ListNode first = head;

        // Merge
        while (second != null) {
            ListNode firstNext = first.next;
            ListNode secondNext = second.next;

            first.next = second;
            second.next = firstNext;

            first = firstNext;
            second = secondNext;
        }
    }
}
```

```javascript filename:JavaScript
var reorderList = function(head) {
    if (!head || !head.next) {
        return;
    }

    // Find middle
    let slow = head;
    let fast = head;

    while (fast && fast.next) {
        slow = slow.next;
        fast = fast.next.next;
    }

    // Reverse second half
    let second = slow.next;
    slow.next = null;

    let previous = null;

    while (second) {
        const nextNode = second.next;
        second.next = previous;
        previous = second;
        second = nextNode;
    }

    second = previous;
    let first = head;

    // Merge
    while (second) {
        const firstNext = first.next;
        const secondNext = second.next;

        first.next = second;
        second.next = firstNext;

        first = firstNext;
        second = secondNext;
    }
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Find Middle + Reverse Second Half + Interleave Merge
