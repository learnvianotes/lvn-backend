---
id: f109eb6e-65e5-7b7c-a499-5af8965761fb
key: problem:sheet-150/lc-853
subject: sheet-150
topic: stack
title: Car Fleet
slug: car-fleet
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 853](https://leetcode.com/problems/car-fleet/)

# Problem

Cars travel to target destination. A faster car catching a slower fleet merges into that fleet. Return total number of fleets that arrive at destination.

# Understanding the problem

Car arrival time = `(target - position) / speed`. Sorting cars by starting position descending lets us evaluate fleet merging.

# Intuition

Sort cars by position descending (closest to target first). Compute target arrival time. If current car's arrival time $\\le$ last fleet's arrival time, it merges into that fleet.

# Approach

1. Pair position &amp; speed, sort descending by position: `sorted(zip(position, speed), reverse=True)`.
2. Initialize stack storing fleet arrival times.
3. For each car: compute `time = (target - pos) / spd`.
4. If stack is empty or `time > stack[-1]`, push `time` to stack (forms a new distinct fleet).
5. Return `len(stack)`.

# Naive Solution — Brute Force

Simulate positions over continuous time steps or iteratively merge adjacent fleets.

```python filename:Python
class Solution:
    def carFleet(self, target, position, speed):

        cars = sorted(
            zip(position, speed)
        )

        fleets = []

        for pos, spd in cars:
            time = (target - pos) / spd

            while (
                fleets
                and fleets[-1] <= time
            ):
                fleets.pop()

            fleets.append(time)

        return len(fleets)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int carFleet(int target, vector<int>& position, vector<int>& speed) {
        vector<pair<int, int>> cars;
        for (int i = 0; i < position.size(); i++) cars.push_back({position[i], speed[i]});
        sort(cars.begin(), cars.end());
        vector<double> fleets;
        for (auto& [pos, spd] : cars) {
            double time = (double)(target - pos) / spd;
            while (!fleets.empty() && fleets.back() <= time) fleets.pop_back();
            fleets.push_back(time);
        }
        return fleets.size();
    }
};
```

```java filename:Java
class Solution {
    public int carFleet(int target, int[] position, int[] speed) {
        int n = position.length;
        int[][] cars = new int[n][];
        for (int i = 0; i < n; i++) cars[i] = new int[]{position[i], speed[i]};
        Arrays.sort(cars, (x, y) -> Integer.compare(x[0], y[0]));
        Deque<Double> fleets = new ArrayDeque<>();
        for (int[] car : cars) {
            double time = (double) (target - car[0]) / car[1];
            while (!fleets.isEmpty() && fleets.peek() <= time) fleets.pop();
            fleets.push(time);
        }
        return fleets.size();
    }
}
```

```javascript filename:JavaScript
var carFleet = function(target, position, speed) {
    const cars = position.map((p, i) => [p, speed[i]]).sort((a, b) => a[0] - b[0]);
    const fleets = [];
    for (const [pos, spd] of cars) {
        const time = (target - pos) / spd;
        while (fleets.length && fleets[fleets.length - 1] <= time) fleets.pop();
        fleets.push(time);
    }
    return fleets.length;
};
```

<strong>Time: O(n log n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def carFleet(self, target, position, speed):

        cars = sorted(
            zip(position, speed),
            reverse=True
        )

        stack = []

        for pos, spd in cars:
            time = (
                target - pos
            ) / spd

            if (
                not stack
                or time > stack[-1]
            ):
                stack.append(time)

        return len(stack)
```

```cpp filename:C%2B%2B
class Solution {
public:
    int carFleet(int target, vector<int>& position, vector<int>& speed) {
        vector<pair<int, int>> cars;
        for (int i = 0; i < position.size(); i++) cars.push_back({position[i], speed[i]});
        sort(cars.rbegin(), cars.rend());
        vector<double> stack;
        for (auto& [pos, spd] : cars) {
            double time = (double)(target - pos) / spd;
            if (stack.empty() || time > stack.back()) stack.push_back(time);
        }
        return stack.size();
    }
};
```

```java filename:Java
class Solution {
    public int carFleet(int target, int[] position, int[] speed) {
        int n = position.length;
        int[][] cars = new int[n][];
        for (int i = 0; i < n; i++) cars[i] = new int[]{position[i], speed[i]};
        Arrays.sort(cars, (x, y) -> Integer.compare(y[0], x[0]));
        Deque<Double> stack = new ArrayDeque<>();
        for (int[] car : cars) {
            double time = (double) (target - car[0]) / car[1];
            if (stack.isEmpty() || time > stack.peek()) stack.push(time);
        }
        return stack.size();
    }
}
```

```javascript filename:JavaScript
var carFleet = function(target, position, speed) {
    const cars = position.map((p, i) => [p, speed[i]]).sort((a, b) => b[0] - a[0]);
    const stack = [];
    for (const [pos, spd] of cars) {
        const time = (target - pos) / spd;
        if (!stack.length || time > stack[stack.length - 1]) stack.push(time);
    }
    return stack.length;
};
```

<strong>Time: O(n log n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Sort by position descending → Target Arrival Time Stack
