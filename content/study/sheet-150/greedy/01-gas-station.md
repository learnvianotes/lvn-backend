---
id: 8c746a96-f3f0-7970-b9c0-6a240e511463
key: problem:sheet-150/lc-134
subject: sheet-150
topic: greedy
title: Gas Station
slug: gas-station
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 134](https://leetcode.com/problems/gas-station/)

# Problem

Given `gas[i]` and `cost[i]` for a circular route, find the starting station index from which you can complete the full circuit (or return -1).

# Understanding the problem

If starting at `s` causes a fuel deficit at station `i`, then no station between `s` and `i` can work either — they inherit the same or worse prefix. Jump directly to `i+1`.

# Intuition

Two insights: (1) A solution exists if and only if `sum(gas) >= sum(cost)`. (2) Whenever running fuel goes negative, every station from `start` to `i` is invalid — skip them all and try `i+1`.

# Approach

1. If `sum(gas) < sum(cost)`: return -1 immediately.
2. Initialize `start = 0`, `fuel = 0`.
3. Iterate each station `i`: add `gas[i] - cost[i]` to `fuel`.
4. If `fuel < 0`: set `start = i + 1`, reset `fuel = 0`.
5. Return `start`.

# Naive Solution — Brute Force

Try every station as a start, simulate the full circuit for each.

```python filename:Python
class Solution:
    def canCompleteCircuit(self, gas, cost):
        n = len(gas)

        for start in range(n):
            fuel = 0
            possible = True

            for i in range(n):
                index = (start + i) % n
                fuel += gas[index]
                fuel -= cost[index]

                if fuel < 0:
                    possible = False
                    break

            if possible:
                return start

        return -1
```

```cpp filename:C%2B%2B
class Solution {
public:
    int canCompleteCircuit(vector<int>& gas, vector<int>& cost) {
        int n = gas.size();

        for (int start = 0; start < n; start++) {
            int fuel = 0;
            bool possible = true;

            for (int i = 0; i < n; i++) {
                int index = (start + i) % n;
                fuel += gas[index];
                fuel -= cost[index];

                if (fuel < 0) {
                    possible = false;
                    break;
                }
            }

            if (possible) {
                return start;
            }
        }

        return -1;
    }
};
```

```java filename:Java
class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int n = gas.length;

        for (int start = 0; start < n; start++) {
            int fuel = 0;
            boolean possible = true;

            for (int i = 0; i < n; i++) {
                int index = (start + i) % n;
                fuel += gas[index];
                fuel -= cost[index];

                if (fuel < 0) {
                    possible = false;
                    break;
                }
            }

            if (possible) {
                return start;
            }
        }

        return -1;
    }
}
```

```javascript filename:JavaScript
var canCompleteCircuit = function(gas, cost) {
    const n = gas.length;

    for (let start = 0; start < n; start++) {
        let fuel = 0;
        let possible = true;

        for (let i = 0; i < n; i++) {
            const index = (start + i) % n;
            fuel += gas[index];
            fuel -= cost[index];

            if (fuel < 0) {
                possible = false;
                break;
            }
        }

        if (possible) {
            return start;
        }
    }

    return -1;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def canCompleteCircuit(self, gas, cost):
        if sum(gas) < sum(cost):
            return -1

        start = 0
        fuel = 0

        for i in range(len(gas)):
            fuel += gas[i] - cost[i]

            if fuel < 0:
                start = i + 1
                fuel = 0

        return start
```

```cpp filename:C%2B%2B
class Solution {
public:
    int canCompleteCircuit(vector<int>& gas, vector<int>& cost) {
        long long totalGas = accumulate(gas.begin(), gas.end(), 0LL);
        long long totalCost = accumulate(cost.begin(), cost.end(), 0LL);
        if (totalGas < totalCost) {
            return -1;
        }

        int start = 0;
        int fuel = 0;

        for (int i = 0; i < (int)gas.size(); i++) {
            fuel += gas[i] - cost[i];

            if (fuel < 0) {
                start = i + 1;
                fuel = 0;
            }
        }

        return start;
    }
};
```

```java filename:Java
class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        long totalGas = 0, totalCost = 0;
        for (int i = 0; i < gas.length; i++) {
            totalGas += gas[i];
            totalCost += cost[i];
        }
        if (totalGas < totalCost) {
            return -1;
        }

        int start = 0;
        int fuel = 0;

        for (int i = 0; i < gas.length; i++) {
            fuel += gas[i] - cost[i];

            if (fuel < 0) {
                start = i + 1;
                fuel = 0;
            }
        }

        return start;
    }
}
```

```javascript filename:JavaScript
var canCompleteCircuit = function(gas, cost) {
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    if (sum(gas) < sum(cost)) {
        return -1;
    }

    let start = 0;
    let fuel = 0;

    for (let i = 0; i < gas.length; i++) {
        fuel += gas[i] - cost[i];

        if (fuel < 0) {
            start = i + 1;
            fuel = 0;
        }
    }

    return start;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Greedy Candidate Elimination — failed range means every start in it is invalid
