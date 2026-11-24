---
id: 57f4718e-3a02-7928-a5a3-21734caf8c13
key: problem:sheet-150/lc-2
subject: sheet-150
topic: linked-list
title: Add Two Numbers
slug: add-two-numbers
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 2](https://leetcode.com/problems/add-two-numbers/)

# Problem

Given two non-empty linked lists representing two non-negative integers in reverse order, add the numbers and return the sum as a linked list.

# Understanding the problem

Digits are stored in reverse order; add digit by digit with carry.

# Intuition

Elementary digit-by-digit addition traversing both lists simultaneously with a carry variable.

# Approach

1. Use `dummy = ListNode()` and `carry = 0`.
2. Loop while `l1` or `l2` or `carry`:
3. Sum values + carry, update `carry = total // 10`.
4. Append `ListNode(total % 10)` to result list.

# Naive Solution — Brute Force

Convert lists to Python integers, add numbers, convert sum back to linked list.

```python filename:Python
class Solution:
    def addTwoNumbers(self, l1, l2):
        def to_number(node):
            number = 0
            multiplier = 1

            while node:
                number += node.val * multiplier
                multiplier *= 10
                node = node.next

            return number

        total = to_number(l1) + to_number(l2)

        dummy = ListNode()
        current = dummy

        if total == 0:
            return ListNode(0)

        while total:
            current.next = ListNode(total % 10)
            total //= 10
            current = current.next

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {
        // Up to 100 digits overflows any built-in integer (Python has big ints),
        // so each number is kept as a digit string, least significant digit first.
        auto toNumber = [](ListNode* node) {
            string number;

            while (node) {
                number += char('0' + node->val);
                node = node->next;
            }

            return number;
        };

        string a = toNumber(l1);
        string b = toNumber(l2);

        string total;
        int carry = 0;

        for (int i = 0; i < max(a.size(), b.size()) || carry; i++) {
            int digit = carry;
            if (i < a.size()) digit += a[i] - '0';
            if (i < b.size()) digit += b[i] - '0';

            total += char('0' + digit % 10);
            carry = digit / 10;
        }

        ListNode dummy;
        ListNode* current = &dummy;

        for (char digit : total) {
            current->next = new ListNode(digit - '0');
            current = current->next;
        }

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        // Up to 100 digits overflows long, so use java.math.BigInteger (like Python's int)
        java.math.BigInteger total = toNumber(l1).add(toNumber(l2));

        if (total.signum() == 0) {
            return new ListNode(0);
        }

        ListNode dummy = new ListNode();
        ListNode current = dummy;

        while (total.signum() > 0) {
            java.math.BigInteger[] parts = total.divideAndRemainder(java.math.BigInteger.TEN);
            current.next = new ListNode(parts[1].intValue());
            total = parts[0];
            current = current.next;
        }

        return dummy.next;
    }

    private java.math.BigInteger toNumber(ListNode node) {
        java.math.BigInteger number = java.math.BigInteger.ZERO;
        java.math.BigInteger multiplier = java.math.BigInteger.ONE;

        while (node != null) {
            number = number.add(multiplier.multiply(java.math.BigInteger.valueOf(node.val)));
            multiplier = multiplier.multiply(java.math.BigInteger.TEN);
            node = node.next;
        }

        return number;
    }
}
```

```javascript filename:JavaScript
var addTwoNumbers = function(l1, l2) {
    // Up to 100 digits exceeds Number precision, so use BigInt
    const toNumber = (node) => {
        let number = 0n;
        let multiplier = 1n;

        while (node) {
            number += BigInt(node.val) * multiplier;
            multiplier *= 10n;
            node = node.next;
        }

        return number;
    };

    let total = toNumber(l1) + toNumber(l2);

    const dummy = new ListNode();
    let current = dummy;

    if (total === 0n) {
        return new ListNode(0);
    }

    while (total) {
        current.next = new ListNode(Number(total % 10n));
        total /= 10n;
        current = current.next;
    }

    return dummy.next;
};
```

<strong>Time: O(n + m) · Space: O(n + m)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def addTwoNumbers(self, l1, l2):
        dummy = ListNode()
        current = dummy

        carry = 0

        while l1 or l2 or carry:
            a = l1.val if l1 else 0
            b = l2.val if l2 else 0

            total = a + b + carry

            carry = total // 10

            current.next = ListNode(
                total % 10
            )

            current = current.next

            if l1:
                l1 = l1.next

            if l2:
                l2 = l2.next

        return dummy.next
```

```cpp filename:C%2B%2B
class Solution {
public:
    ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {
        ListNode dummy;
        ListNode* current = &dummy;

        int carry = 0;

        while (l1 || l2 || carry) {
            int a = l1 ? l1->val : 0;
            int b = l2 ? l2->val : 0;

            int total = a + b + carry;

            carry = total / 10;

            current->next = new ListNode(total % 10);

            current = current->next;

            if (l1) l1 = l1->next;
            if (l2) l2 = l2->next;
        }

        return dummy.next;
    }
};
```

```java filename:Java
class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode();
        ListNode current = dummy;

        int carry = 0;

        while (l1 != null || l2 != null || carry != 0) {
            int a = l1 != null ? l1.val : 0;
            int b = l2 != null ? l2.val : 0;

            int total = a + b + carry;

            carry = total / 10;

            current.next = new ListNode(total % 10);

            current = current.next;

            if (l1 != null) l1 = l1.next;
            if (l2 != null) l2 = l2.next;
        }

        return dummy.next;
    }
}
```

```javascript filename:JavaScript
var addTwoNumbers = function(l1, l2) {
    const dummy = new ListNode();
    let current = dummy;

    let carry = 0;

    while (l1 || l2 || carry) {
        const a = l1 ? l1.val : 0;
        const b = l2 ? l2.val : 0;

        const total = a + b + carry;

        carry = Math.floor(total / 10);

        current.next = new ListNode(total % 10);

        current = current.next;

        if (l1) l1 = l1.next;
        if (l2) l2 = l2.next;
    }

    return dummy.next;
};
```

<strong>Time: O(max(n,m)) · Space: O(max(n,m))</strong>

# Takeaway

<strong>Pattern</strong> — Elementary Addition with Carry Pointer
