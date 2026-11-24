---
id: 625a5d3c-6090-70c4-928f-36d1bf18fb12
key: problem:sheet-150/lc-202
subject: sheet-150
topic: math-geometry
title: Happy Number
slug: happy-number
order: 2
---

Difficulty: <strong>Easy</strong> · [LeetCode 202](https://leetcode.com/problems/happy-number/)

# Problem

A number is happy if repeatedly replacing it with the sum of the squares of its digits eventually reaches 1. Return `True` if the number is happy.

# Understanding the problem

An unhappy number never reaches 1 — it enters a cycle. The process of digit-squaring is a value transformation that either terminates at 1 or loops. Floyd's cycle detection handles both cases without storing visited states.

# Intuition

Model the transformation as a linked-list-style sequence. A happy number converges to the cycle `1 → 1 → …`; an unhappy number enters another cycle. Floyd's slow/fast pointers detect the cycle in O(1) space.

# Approach

1. Define `next_number(num)`: extract digits, return sum of their squares.
2. Initialize `slow = n`, `fast = next_number(n)`.
3. While `fast != 1` and `slow != fast`: advance `slow` one step, `fast` two steps.
4. Return `fast == 1`.

# Naive Solution — Brute Force

Keep a `seen` set; stop when 1 is reached or a repeated value is detected.

```python filename:Python
class Solution:
    def isHappy(self, n):
        seen = set()

        while n != 1:
            if n in seen:
                return False

            seen.add(n)

            total = 0

            while n > 0:
                digit = n % 10
                total += digit * digit
                n //= 10

            n = total

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isHappy(int n) {
        unordered_set<int> seen;

        while (n != 1) {
            if (seen.count(n)) {
                return false;
            }

            seen.insert(n);

            int total = 0;

            while (n > 0) {
                int digit = n % 10;
                total += digit * digit;
                n /= 10;
            }

            n = total;
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isHappy(int n) {
        Set<Integer> seen = new HashSet<>();

        while (n != 1) {
            if (seen.contains(n)) {
                return false;
            }

            seen.add(n);

            int total = 0;

            while (n > 0) {
                int digit = n % 10;
                total += digit * digit;
                n /= 10;
            }

            n = total;
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var isHappy = function(n) {
    const seen = new Set();

    while (n !== 1) {
        if (seen.has(n)) {
            return false;
        }

        seen.add(n);

        let total = 0;

        while (n > 0) {
            const digit = n % 10;
            total += digit * digit;
            n = Math.floor(n / 10);
        }

        n = total;
    }

    return true;
};
```

<strong>Time: O(log n) — bounded digit states · Space: O(log n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isHappy(self, n):

        def next_number(num):
            total = 0

            while num > 0:
                digit = num % 10
                total += digit * digit
                num //= 10

            return total

        slow = n
        fast = next_number(n)

        while fast != 1 and slow != fast:
            slow = next_number(slow)
            fast = next_number(next_number(fast))

        return fast == 1
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isHappy(int n) {
        int slow = n;
        int fast = nextNumber(n);

        while (fast != 1 && slow != fast) {
            slow = nextNumber(slow);
            fast = nextNumber(nextNumber(fast));
        }

        return fast == 1;
    }

private:
    int nextNumber(int num) {
        int total = 0;

        while (num > 0) {
            int digit = num % 10;
            total += digit * digit;
            num /= 10;
        }

        return total;
    }
};
```

```java filename:Java
class Solution {
    public boolean isHappy(int n) {
        int slow = n;
        int fast = nextNumber(n);

        while (fast != 1 && slow != fast) {
            slow = nextNumber(slow);
            fast = nextNumber(nextNumber(fast));
        }

        return fast == 1;
    }

    private int nextNumber(int num) {
        int total = 0;

        while (num > 0) {
            int digit = num % 10;
            total += digit * digit;
            num /= 10;
        }

        return total;
    }
}
```

```javascript filename:JavaScript
var isHappy = function(n) {
    const nextNumber = (num) => {
        let total = 0;

        while (num > 0) {
            const digit = num % 10;
            total += digit * digit;
            num = Math.floor(num / 10);
        }

        return total;
    };

    let slow = n;
    let fast = nextNumber(n);

    while (fast !== 1 && slow !== fast) {
        slow = nextNumber(slow);
        fast = nextNumber(nextNumber(fast));
    }

    return fast === 1;
};
```

<strong>Time: O(log n) — bounded digit states · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Repeated value transformation → cycle or termination → Floyd's Cycle Detection (same family as LC 141)
