---
id: 4931807b-3b87-7e6d-8ffe-ceae93c1ed59
key: problem:sheet-150/lc-141
subject: sheet-150
topic: linked-list
title: Linked List Cycle
slug: linked-list-cycle
order: 2
---

Difficulty: <strong>Easy</strong> · [LeetCode 141](https://leetcode.com/problems/linked-list-cycle/)

# Problem

Determine if the linked list has a cycle in it.

# Understanding the problem

A cycle exists if a node's next pointer visits a previously seen node.

# Intuition

Floyd's Tortoise and Hare: `fast` pointer moves 2 steps, `slow` pointer moves 1 step. If cycle exists, fast will catch slow.

# Approach

1. Set `slow = head`, `fast = head`.
2. While `fast` and `fast.next` exist:
3. Advance `slow = slow.next`, `fast = fast.next.next`.
4. If `slow == fast`, return `True`.
5. Return `False` if loop finishes.

# Naive Solution — Brute Force

Store visited node references in a hash set.

```python filename:Python
class Solution:
    def hasCycle(self, head):
        visited = set()

        while head:
            if head in visited:
                return True

            visited.add(head)
            head = head.next

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool hasCycle(ListNode *head) {
        unordered_set<ListNode*> visited;

        while (head) {
            if (visited.count(head)) {
                return true;
            }

            visited.insert(head);
            head = head->next;
        }

        return false;
    }
};
```

```java filename:Java
public class Solution {
    public boolean hasCycle(ListNode head) {
        Set<ListNode> visited = new HashSet<>();

        while (head != null) {
            if (visited.contains(head)) {
                return true;
            }

            visited.add(head);
            head = head.next;
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var hasCycle = function(head) {
    const visited = new Set();

    while (head) {
        if (visited.has(head)) {
            return true;
        }

        visited.add(head);
        head = head.next;
    }

    return false;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def hasCycle(self, head):
        slow = head
        fast = head

        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next

            if slow == fast:
                return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool hasCycle(ListNode *head) {
        ListNode* slow = head;
        ListNode* fast = head;

        while (fast && fast->next) {
            slow = slow->next;
            fast = fast->next->next;

            if (slow == fast) {
                return true;
            }
        }

        return false;
    }
};
```

```java filename:Java
public class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;

        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;

            if (slow == fast) {
                return true;
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var hasCycle = function(head) {
    let slow = head;
    let fast = head;

    while (fast && fast.next) {
        slow = slow.next;
        fast = fast.next.next;

        if (slow === fast) {
            return true;
        }
    }

    return false;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Fast (2x) &amp; Slow (1x) Pointers → Floyd's Cycle Detection
