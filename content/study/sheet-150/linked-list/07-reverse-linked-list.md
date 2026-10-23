---
id: f1ce1f32-0221-7c9e-9c04-cb940a130804
key: problem:sheet-150/lc-206
subject: sheet-150
topic: linked-list
title: Reverse Linked List
slug: reverse-linked-list
order: 7
---

Difficulty: <strong>Easy</strong> · [LeetCode 206](https://leetcode.com/problems/reverse-linked-list/)

# Problem

Given the head of a singly linked list, reverse the list and return its new head.

# Understanding the problem

Invert all `next` pointers.

# Intuition

Iterative three pointers: `previous`, `current`, `next_node`.

# Approach

1. Initialize `previous = None`, `current = head`.
2. While `current` exists:
3. Save `next_node = current.next`.
4. Reverse pointer: `current.next = previous`.
5. Advance `previous = current`, `current = next_node`.
6. Return `previous` as new head.

# Naive Solution — Brute Force

Recursive call stack reversal.

```python filename:Python
class Solution:
    def reverseList(self, head):
        if not head or not head.next:
            return head

        new_head = self.reverseList(head.next)

        head.next.next = head
        head.next = None

        return new_head
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        if (!head || !head->next) {
            return head;
        }

        ListNode* newHead = reverseList(head->next);

        head->next->next = head;
        head->next = nullptr;

        return newHead;
    }
};
```

```java filename:Java
class Solution {
    public ListNode reverseList(ListNode head) {
        if (head == null || head.next == null) {
            return head;
        }

        ListNode newHead = reverseList(head.next);

        head.next.next = head;
        head.next = null;

        return newHead;
    }
}
```

```javascript filename:JavaScript
var reverseList = function(head) {
    if (!head || !head.next) {
        return head;
    }

    const newHead = reverseList(head.next);

    head.next.next = head;
    head.next = null;

    return newHead;
};
```

<strong>Time: O(n) · Space: O(n) stack</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def reverseList(self, head):
        previous = None
        current = head

        while current:
            next_node = current.next

            current.next = previous

            previous = current
            current = next_node

        return previous
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* previous = nullptr;
        ListNode* current = head;

        while (current) {
            ListNode* nextNode = current->next;

            current->next = previous;

            previous = current;
            current = nextNode;
        }

        return previous;
    }
};
```

```java filename:Java
class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode previous = null;
        ListNode current = head;

        while (current != null) {
            ListNode nextNode = current.next;

            current.next = previous;

            previous = current;
            current = nextNode;
        }

        return previous;
    }
}
```

```javascript filename:JavaScript
var reverseList = function(head) {
    let previous = null;
    let current = head;

    while (current) {
        const nextNode = current.next;

        current.next = previous;

        previous = current;
        current = nextNode;
    }

    return previous;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Three pointers: previous → current → next
