---
id: 4b8f1709-d71e-7ab7-a184-810e9e5e50ff
key: problem:sheet-150/lc-19
subject: sheet-150
topic: linked-list
title: Remove Nth Node From End of List
slug: remove-nth-node-from-end-of-list
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 19](https://leetcode.com/problems/remove-nth-node-from-end-of-list/)

# Problem

Remove the nth node from the end of the list and return its head.

# Understanding the problem

Target node is at position `length - n`.

# Intuition

Use two pointers `fast` and `slow` offset by `n` nodes. One pass.

# Approach

1. Initialize `dummy = ListNode(0, head)`.
2. Advance `fast` pointer `n` steps ahead of `slow`.
3. Move both pointers until `fast.next` is None.
4. Update `slow.next = slow.next.next` and return `dummy.next`.

# Naive Solution — Brute Force

Two passes: count total length, then advance length - n steps to delete node.

```python filename:Python
class Solution:
    def removeNthFromEnd(self, head, n):
        length = 0
        current = head

        while current:
            length += 1
            current = current.next

        dummy = ListNode(0, head)
        current = dummy

        for _ in range(length - n):
            current = current.next

        current.next = current.next.next

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* removeNthFromEnd(ListNode* head, int n) {
        int length = 0;
        ListNode* current = head;

        while (current) {
            length++;
            current = current->next;
        }

        ListNode dummy(0, head);
        current = &dummy;

        for (int i = 0; i < length - n; i++) {
            current = current->next;
        }

        current->next = current->next->next;

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        int length = 0;
        ListNode current = head;

        while (current != null) {
            length++;
            current = current.next;
        }

        ListNode dummy = new ListNode(0, head);
        current = dummy;

        for (int i = 0; i < length - n; i++) {
            current = current.next;
        }

        current.next = current.next.next;

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var removeNthFromEnd = function(head, n) {
    let length = 0;
    let current = head;

    while (current) {
        length++;
        current = current.next;
    }

    const dummy = new ListNode(0, head);
    current = dummy;

    for (let i = 0; i < length - n; i++) {
        current = current.next;
    }

    current.next = current.next.next;

    return dummy.next;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def removeNthFromEnd(self, head, n):
        dummy = ListNode(0, head)

        slow = dummy
        fast = dummy

        for _ in range(n):
            fast = fast.next

        while fast.next:
            slow = slow.next
            fast = fast.next

        slow.next = slow.next.next

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* removeNthFromEnd(ListNode* head, int n) {
        ListNode dummy(0, head);

        ListNode* slow = &dummy;
        ListNode* fast = &dummy;

        for (int i = 0; i < n; i++) {
            fast = fast->next;
        }

        while (fast->next) {
            slow = slow->next;
            fast = fast->next;
        }

        slow->next = slow->next->next;

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head);

        ListNode slow = dummy;
        ListNode fast = dummy;

        for (int i = 0; i < n; i++) {
            fast = fast.next;
        }

        while (fast.next != null) {
            slow = slow.next;
            fast = fast.next;
        }

        slow.next = slow.next.next;

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var removeNthFromEnd = function(head, n) {
    const dummy = new ListNode(0, head);

    let slow = dummy;
    let fast = dummy;

    for (let i = 0; i < n; i++) {
        fast = fast.next;
    }

    while (fast.next) {
        slow = slow.next;
        fast = fast.next;
    }

    slow.next = slow.next.next;

    return dummy.next;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Fast pointer is N nodes ahead of Slow pointer
