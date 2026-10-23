---
id: a25beb86-c243-7a81-9406-28e2f441283c
key: problem:sheet-150/lc-138
subject: sheet-150
topic: linked-list
title: Copy List with Random Pointer
slug: copy-list-with-random-pointer
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 138](https://leetcode.com/problems/copy-list-with-random-pointer/)

# Problem

Construct a deep copy of a linked list where each node has an extra `random` pointer.

# Understanding the problem

Deep copy requires copying nodes and setting next and random pointers correctly.

# Intuition

Interleave copied nodes directly after original nodes (A -&gt; A' -&gt; B -&gt; B') to set random pointers in O(1) extra space.

# Approach

1. Pass 1: Interleave cloned nodes `copy = Node(curr.val)` after `curr`.
2. Pass 2: Set random pointers: `curr.next.random = curr.random.next`.
3. Pass 3: Unweave original and cloned lists.

# Naive Solution — Brute Force

Use a hash map mapping original\_node -&gt; copied\_node.

```python filename:Python
class Solution:
    def copyRandomList(self, head):
        if not head:
            return None

        copies = {}

        current = head

        while current:
            copies[current] = Node(current.val)
            current = current.next

        current = head

        while current:
            copies[current].next = copies.get(
                current.next
            )

            copies[current].random = copies.get(
                current.random
            )

            current = current.next

        return copies[head]
```

```cpp filename:C%2B%2B
class Solution {
public:
    Node* copyRandomList(Node* head) {
        if (!head) {
            return nullptr;
        }

        unordered_map<Node*, Node*> copies;
        copies[nullptr] = nullptr;

        Node* current = head;

        while (current) {
            copies[current] = new Node(current->val);
            current = current->next;
        }

        current = head;

        while (current) {
            copies[current]->next = copies[current->next];
            copies[current]->random = copies[current->random];

            current = current->next;
        }

        return copies[head];
    }
};
```

```java filename:Java
class Solution {
    public Node copyRandomList(Node head) {
        if (head == null) {
            return null;
        }

        Map<Node, Node> copies = new HashMap<>();

        Node current = head;

        while (current != null) {
            copies.put(current, new Node(current.val));
            current = current.next;
        }

        current = head;

        while (current != null) {
            copies.get(current).next = copies.get(current.next);
            copies.get(current).random = copies.get(current.random);

            current = current.next;
        }

        return copies.get(head);
    }
}
```

```javascript filename:JavaScript
var copyRandomList = function(head) {
    if (!head) {
        return null;
    }

    const copies = new Map();

    let current = head;

    while (current) {
        copies.set(current, new _Node(current.val, null, null));
        current = current.next;
    }

    current = head;

    while (current) {
        copies.get(current).next = copies.get(current.next) || null;
        copies.get(current).random = copies.get(current.random) || null;

        current = current.next;
    }

    return copies.get(head);
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def copyRandomList(self, head):
        if not head:
            return None

        current = head

        # Create copied nodes
        while current:
            copy = Node(current.val)

            copy.next = current.next
            current.next = copy

            current = copy.next

        # Set random pointers
        current = head

        while current:
            if current.random:
                current.next.random = (
                    current.random.next
                )

            current = current.next.next

        # Separate lists
        dummy = Node(0)
        copy_current = dummy
        current = head

        while current:
            copy = current.next

            copy_current.next = copy
            copy_current = copy

            current.next = copy.next
            current = current.next

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    Node* copyRandomList(Node* head) {
        if (!head) {
            return nullptr;
        }

        Node* current = head;

        // Create copied nodes
        while (current) {
            Node* copy = new Node(current->val);

            copy->next = current->next;
            current->next = copy;

            current = copy->next;
        }

        // Set random pointers
        current = head;

        while (current) {
            if (current->random) {
                current->next->random = current->random->next;
            }

            current = current->next->next;
        }

        // Separate lists
        Node dummy(0);
        Node* copyCurrent = &dummy;
        current = head;

        while (current) {
            Node* copy = current->next;

            copyCurrent->next = copy;
            copyCurrent = copy;

            current->next = copy->next;
            current = current->next;
        }

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public Node copyRandomList(Node head) {
        if (head == null) {
            return null;
        }

        Node current = head;

        // Create copied nodes
        while (current != null) {
            Node copy = new Node(current.val);

            copy.next = current.next;
            current.next = copy;

            current = copy.next;
        }

        // Set random pointers
        current = head;

        while (current != null) {
            if (current.random != null) {
                current.next.random = current.random.next;
            }

            current = current.next.next;
        }

        // Separate lists
        Node dummy = new Node(0);
        Node copyCurrent = dummy;
        current = head;

        while (current != null) {
            Node copy = current.next;

            copyCurrent.next = copy;
            copyCurrent = copy;

            current.next = copy.next;
            current = current.next;
        }

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var copyRandomList = function(head) {
    if (!head) {
        return null;
    }

    let current = head;

    // Create copied nodes
    while (current) {
        const copy = new _Node(current.val, null, null);

        copy.next = current.next;
        current.next = copy;

        current = copy.next;
    }

    // Set random pointers
    current = head;

    while (current) {
        if (current.random) {
            current.next.random = current.random.next;
        }

        current = current.next.next;
    }

    // Separate lists
    const dummy = new _Node(0, null, null);
    let copyCurrent = dummy;
    current = head;

    while (current) {
        const copy = current.next;

        copyCurrent.next = copy;
        copyCurrent = copy;

        current.next = copy.next;
        current = current.next;
    }

    return dummy.next;
};
```

<strong>Time: O(n) · Aux Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Interleave copied nodes with original nodes
