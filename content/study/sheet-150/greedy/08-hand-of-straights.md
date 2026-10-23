---
id: ccc608c9-7c99-76b4-8646-5c7791d69dc7
key: problem:sheet-150/lc-846
subject: sheet-150
topic: greedy
title: Hand of Straights
slug: hand-of-straights
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 846](https://leetcode.com/problems/hand-of-straights/)

# Problem

Given an array of card values `hand` and an integer `groupSize`, return `True` if you can rearrange all cards into consecutive groups of size `groupSize`.

# Understanding the problem

The smallest available card must start a group — there is nothing smaller to put before it. Greedily consume groups starting from the minimum each time.

# Intuition

Use a frequency map. Iterate sorted unique keys. For the smallest key with count &gt; 0, try to consume `frequency` copies of each of the next `groupSize` cards. If any is short, return False.

# Approach

1. Return False if `len(hand) % groupSize != 0`.
2. Build `count = Counter(hand)`.
3. Iterate `first` in `sorted(count)`.
4. Skip if `count[first] == 0`.
5. Set `frequency = count[first]`.
6. For each value in `[first, first+groupSize)`: if `count[value] < frequency` return False; subtract `frequency`.
7. Return True.

# Naive Solution — Brute Force

Sort, then repeatedly remove groups starting from the smallest element using `list.remove()`.

```python filename:Python
class Solution:
    def isNStraightHand(self, hand, groupSize):
        if len(hand) % groupSize != 0:
            return False

        hand.sort()

        while hand:
            first = hand[0]

            for value in range(first, first + groupSize):
                if value not in hand:
                    return False

                hand.remove(value)

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isNStraightHand(vector<int>& hand, int groupSize) {
        if (hand.size() % groupSize != 0) {
            return false;
        }

        sort(hand.begin(), hand.end());

        while (!hand.empty()) {
            int first = hand[0];

            for (int value = first; value < first + groupSize; value++) {
                auto it = find(hand.begin(), hand.end(), value);
                if (it == hand.end()) {
                    return false;
                }

                hand.erase(it);
            }
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isNStraightHand(int[] hand, int groupSize) {
        if (hand.length % groupSize != 0) {
            return false;
        }

        Arrays.sort(hand);
        List<Integer> cards = new ArrayList<>();
        for (int card : hand) {
            cards.add(card);
        }

        while (!cards.isEmpty()) {
            int first = cards.get(0);

            for (int value = first; value < first + groupSize; value++) {
                if (!cards.contains(value)) {
                    return false;
                }

                cards.remove(Integer.valueOf(value));
            }
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var isNStraightHand = function(hand, groupSize) {
    if (hand.length % groupSize !== 0) {
        return false;
    }

    hand.sort((a, b) => a - b);

    while (hand.length > 0) {
        const first = hand[0];

        for (let value = first; value < first + groupSize; value++) {
            const index = hand.indexOf(value);
            if (index === -1) {
                return false;
            }

            hand.splice(index, 1);
        }
    }

    return true;
};
```

<strong>Time: O(n²) — list.remove() is O(n) · Space: O(1) auxiliary</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import Counter

class Solution:
    def isNStraightHand(self, hand, groupSize):
        if len(hand) % groupSize != 0:
            return False

        count = Counter(hand)

        for first in sorted(count):
            if count[first] == 0:
                continue

            frequency = count[first]

            for value in range(first, first + groupSize):
                if count[value] < frequency:
                    return False

                count[value] -= frequency

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isNStraightHand(vector<int>& hand, int groupSize) {
        if (hand.size() % groupSize != 0) {
            return false;
        }

        map<int, int> count;  // ordered by card value
        for (int card : hand) {
            count[card]++;
        }

        for (auto& [first, freq] : count) {
            if (freq == 0) {
                continue;
            }

            int frequency = freq;

            for (int value = first; value < first + groupSize; value++) {
                if (count[value] < frequency) {
                    return false;
                }

                count[value] -= frequency;
            }
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isNStraightHand(int[] hand, int groupSize) {
        if (hand.length % groupSize != 0) {
            return false;
        }

        TreeMap<Integer, Integer> count = new TreeMap<>();
        for (int card : hand) {
            count.merge(card, 1, Integer::sum);
        }

        for (int first : new ArrayList<>(count.keySet())) {
            if (count.get(first) == 0) {
                continue;
            }

            int frequency = count.get(first);

            for (int value = first; value < first + groupSize; value++) {
                if (count.getOrDefault(value, 0) < frequency) {
                    return false;
                }

                count.put(value, count.get(value) - frequency);
            }
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var isNStraightHand = function(hand, groupSize) {
    if (hand.length % groupSize !== 0) {
        return false;
    }

    const count = new Map();
    for (const card of hand) {
        count.set(card, (count.get(card) || 0) + 1);
    }

    const keys = [...count.keys()].sort((a, b) => a - b);

    for (const first of keys) {
        if (count.get(first) === 0) {
            continue;
        }

        const frequency = count.get(first);

        for (let value = first; value < first + groupSize; value++) {
            if ((count.get(value) || 0) < frequency) {
                return false;
            }

            count.set(value, count.get(value) - frequency);
        }
    }

    return true;
};
```

<strong>Time: O(n log n) — dominated by sort of unique keys · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Frequency Map + Sorted Keys — always start from the smallest available card
