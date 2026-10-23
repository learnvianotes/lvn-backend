---
id: 8bd2a125-4f93-7469-831c-2749cb2f153d
key: problem:sheet-150/lc-21
subject: sheet-150
topic: linked-list
title: Merge Two Sorted Lists
slug: merge-two-sorted-lists
order: 8
---

Difficulty: <strong>Easy</strong> · [LeetCode 21](https://leetcode.com/problems/merge-two-sorted-lists/)

# Problem

Merge two sorted linked lists into one sorted linked list.

# Understanding the problem

Splice together nodes of the two lists in sorted order.

# Intuition

Use a dummy head node and compare current nodes of both lists to splice smaller node.

# Approach

1. Create `dummy = ListNode()`, `current = dummy`.
2. While both `list1` and `list2` exist:
3. Append smaller node to `current.next` and advance that list pointer.
4. Attach remaining non-empty list `current.next = list1 or list2`.
5. Return `dummy.next`.

# Naive Solution — Brute Force

Extract node values to an array, sort array, rebuild new linked list.

```python filename:Python
class Solution:
    def mergeTwoLists(self, list1, list2):
        values = []

        while list1:
            values.append(list1.val)
            list1 = list1.next

        while list2:
            values.append(list2.val)
            list2 = list2.next

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
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        vector<int> values;

        while (list1) {
            values.push_back(list1->val);
            list1 = list1->next;
        }

        while (list2) {
            values.push_back(list2->val);
            list2 = list2->next;
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
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        List<Integer> values = new ArrayList<>();

        while (list1 != null) {
            values.add(list1.val);
            list1 = list1.next;
        }

        while (list2 != null) {
            values.add(list2.val);
            list2 = list2.next;
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
var mergeTwoLists = function(list1, list2) {
    const values = [];

    while (list1) {
        values.push(list1.val);
        list1 = list1.next;
    }

    while (list2) {
        values.push(list2.val);
        list2 = list2.next;
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

<strong>Time: O((n + m) log(n + m)) · Space: O(n + m)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def mergeTwoLists(self, list1, list2):
        dummy = ListNode()
        current = dummy

        while list1 and list2:

            if list1.val <= list2.val:
                current.next = list1
                list1 = list1.next
            else:
                current.next = list2
                list2 = list2.next

            current = current.next

        current.next = list1 or list2

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        ListNode dummy;
        ListNode* current = &dummy;

        while (list1 && list2) {
            if (list1->val <= list2->val) {
                current->next = list1;
                list1 = list1->next;
            } else {
                current->next = list2;
                list2 = list2->next;
            }

            current = current->next;
        }

        current->next = list1 ? list1 : list2;

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        ListNode dummy = new ListNode();
        ListNode current = dummy;

        while (list1 != null && list2 != null) {
            if (list1.val <= list2.val) {
                current.next = list1;
                list1 = list1.next;
            } else {
                current.next = list2;
                list2 = list2.next;
            }

            current = current.next;
        }

        current.next = list1 != null ? list1 : list2;

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var mergeTwoLists = function(list1, list2) {
    const dummy = new ListNode();
    let current = dummy;

    while (list1 && list2) {
        if (list1.val <= list2.val) {
            current.next = list1;
            list1 = list1.next;
        } else {
            current.next = list2;
            list2 = list2.next;
        }

        current = current.next;
    }

    current.next = list1 || list2;

    return dummy.next;
};
```

<strong>Time: O(n + m) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Dummy Node + Two Pointer Splice
