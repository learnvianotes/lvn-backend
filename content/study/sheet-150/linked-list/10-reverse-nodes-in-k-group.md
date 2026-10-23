---
id: 624619f0-1a67-7c56-a513-b8036e1b6a8a
key: problem:sheet-150/lc-25
subject: sheet-150
topic: linked-list
title: Reverse Nodes in k-Group
slug: reverse-nodes-in-k-group
order: 10
---

Difficulty: <strong>Hard</strong> · [LeetCode 25](https://leetcode.com/problems/reverse-nodes-in-k-group/)

# Problem

Reverse the nodes of a linked list `k` at a time and return its modified list.

# Understanding the problem

Reverse groups of size `k` in-place; if remaining nodes &lt; `k`, keep as is.

# Intuition

In-place group reversal: check if k nodes exist using helper `get_kth`. Reverse group and reconnect links.

# Approach

1. Use `dummy = ListNode(0, head)`, `group_prev = dummy`.
2. Find kth node: `kth = get_kth(group_prev, k)`. If None, break.
3. Save `group_next = kth.next`.
4. Reverse subsegment from `group_prev.next` to `group_next`.
5. Reconnect `group_prev.next` and set `group_prev` for next group.

# Naive Solution — Brute Force

Store node references in array, reverse sub-slices of length k, reconnect pointers.

```python filename:Python
class Solution:
    def reverseKGroup(self, head, k):
        nodes = []

        current = head

        while current:
            nodes.append(current)
            current = current.next

        for start in range(0, len(nodes), k):
            end = min(
                start + k,
                len(nodes)
            )

            if end - start < k:
                break

            nodes[start:end] = reversed(
                nodes[start:end]
            )

        for i in range(len(nodes) - 1):
            nodes[i].next = nodes[i + 1]

        if nodes:
            nodes[-1].next = None

        return nodes[0] if nodes else None
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* reverseKGroup(ListNode* head, int k) {
        vector<ListNode*> nodes;

        ListNode* current = head;

        while (current) {
            nodes.push_back(current);
            current = current->next;
        }

        int n = nodes.size();

        for (int start = 0; start < n; start += k) {
            int end = min(start + k, n);

            if (end - start < k) {
                break;
            }

            reverse(nodes.begin() + start, nodes.begin() + end);
        }

        for (int i = 0; i + 1 < n; i++) {
            nodes[i]->next = nodes[i + 1];
        }

        if (!nodes.empty()) {
            nodes.back()->next = nullptr;
        }

        return nodes.empty() ? nullptr : nodes[0];
    }
};
```

```java filename:Java
class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        List<ListNode> nodes = new ArrayList<>();

        ListNode current = head;

        while (current != null) {
            nodes.add(current);
            current = current.next;
        }

        int n = nodes.size();

        for (int start = 0; start < n; start += k) {
            int end = Math.min(start + k, n);

            if (end - start < k) {
                break;
            }

            Collections.reverse(nodes.subList(start, end));
        }

        for (int i = 0; i + 1 < n; i++) {
            nodes.get(i).next = nodes.get(i + 1);
        }

        if (!nodes.isEmpty()) {
            nodes.get(n - 1).next = null;
        }

        return nodes.isEmpty() ? null : nodes.get(0);
    }
}
```

```javascript filename:JavaScript
var reverseKGroup = function(head, k) {
    const nodes = [];

    let current = head;

    while (current) {
        nodes.push(current);
        current = current.next;
    }

    for (let start = 0; start < nodes.length; start += k) {
        const end = Math.min(start + k, nodes.length);

        if (end - start < k) {
            break;
        }

        nodes.splice(start, k, ...nodes.slice(start, end).reverse());
    }

    for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].next = nodes[i + 1];
    }

    if (nodes.length) {
        nodes[nodes.length - 1].next = null;
    }

    return nodes.length ? nodes[0] : null;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def reverseKGroup(self, head, k):

        def get_kth(node, k):
            while node and k > 0:
                node = node.next
                k -= 1

            return node

        dummy = ListNode(0, head)
        group_prev = dummy

        while True:
            kth = get_kth(group_prev, k)

            if not kth:
                break

            group_next = kth.next

            # Reverse group
            previous = group_next
            current = group_prev.next

            while current != group_next:
                next_node = current.next

                current.next = previous

                previous = current
                current = next_node

            old_start = group_prev.next

            group_prev.next = kth
            group_prev = old_start

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* reverseKGroup(ListNode* head, int k) {
        auto getKth = [](ListNode* node, int k) {
            while (node && k > 0) {
                node = node->next;
                k--;
            }

            return node;
        };

        ListNode dummy(0, head);
        ListNode* groupPrev = &dummy;

        while (true) {
            ListNode* kth = getKth(groupPrev, k);

            if (!kth) {
                break;
            }

            ListNode* groupNext = kth->next;

            // Reverse group
            ListNode* previous = groupNext;
            ListNode* current = groupPrev->next;

            while (current != groupNext) {
                ListNode* nextNode = current->next;

                current->next = previous;

                previous = current;
                current = nextNode;
            }

            ListNode* oldStart = groupPrev->next;

            groupPrev->next = kth;
            groupPrev = oldStart;
        }

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode dummy = new ListNode(0, head);
        ListNode groupPrev = dummy;

        while (true) {
            ListNode kth = getKth(groupPrev, k);

            if (kth == null) {
                break;
            }

            ListNode groupNext = kth.next;

            // Reverse group
            ListNode previous = groupNext;
            ListNode current = groupPrev.next;

            while (current != groupNext) {
                ListNode nextNode = current.next;

                current.next = previous;

                previous = current;
                current = nextNode;
            }

            ListNode oldStart = groupPrev.next;

            groupPrev.next = kth;
            groupPrev = oldStart;
        }

        return dummy.next;
    }

    private ListNode getKth(ListNode node, int k) {
        while (node != null && k > 0) {
            node = node.next;
            k--;
        }

        return node;
    }
}
```

```javascript filename:JavaScript
var reverseKGroup = function(head, k) {
    const getKth = (node, k) => {
        while (node && k > 0) {
            node = node.next;
            k--;
        }

        return node;
    };

    const dummy = new ListNode(0, head);
    let groupPrev = dummy;

    while (true) {
        const kth = getKth(groupPrev, k);

        if (!kth) {
            break;
        }

        const groupNext = kth.next;

        // Reverse group
        let previous = groupNext;
        let current = groupPrev.next;

        while (current !== groupNext) {
            const nextNode = current.next;

            current.next = previous;

            previous = current;
            current = nextNode;
        }

        const oldStart = groupPrev.next;

        groupPrev.next = kth;
        groupPrev = oldStart;
    }

    return dummy.next;
};
```

<strong>Time: O(n) · Aux Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Group size validation + In-place subsegment pointer reversal
