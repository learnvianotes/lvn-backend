---
id: f76b7761-d795-7b88-af39-cb88d84d2bdb
key: problem:sheet-150/lc-2013
subject: sheet-150
topic: math-geometry
title: Detect Squares
slug: detect-squares
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 2013](https://leetcode.com/problems/detect-squares/)

# Problem

Design a data structure that supports `add(point)` and `count(point)`. For `count`, return the number of axis-aligned squares that can be formed using the query point as one corner.

# Understanding the problem

For a query point `(x, y)` and a diagonal point `(x2, y2)` to form an axis-aligned square: `|x2-x| == |y2-y|` (non-zero). The other two corners are then `(x2, y)` and `(x, y2)`. Count = product of frequencies of all three non-query corners.

# Intuition

Group points by their `x`-coordinate. For each unique `x2 ≠ x`, the diagonal candidate's `y` value must be exactly `y ± side` where `side = |x2 - x|`. Only two candidate `y2` values need checking — constant per `x2`.

# Approach

1. Store `self.points = defaultdict(Counter)` where `self.points[x][y]` = frequency.
2. `add(x, y)`: `self.points[x][y] += 1`.
3. `count(x, y)`: iterate over all distinct `x2` in `self.points` (skip `x2 == x`).
4. `side = abs(x2 - x)`. Check `y2 ∈ {y + side, y - side}`.
5. For each valid `y2`: `answer += points[x2][y2] × points[x][y2] × points[x2][y]`.
6. Return `answer`.

# Naive Solution — Brute Force

Store all points in a list; for each `count` query, scan all pairs and check the square condition.

```python filename:Python
from collections import Counter

class DetectSquares:

    def __init__(self):
        self.points = Counter()

    def add(self, point):
        self.points[tuple(point)] += 1

    def count(self, point):
        x, y = point
        answer = 0

        for (x2, y2), cnt_diag in self.points.items():
            if x2 == x or y2 == y:
                continue

            if abs(x2 - x) != abs(y2 - y):
                continue

            answer += (
                cnt_diag
                * self.points[(x2, y)]
                * self.points[(x, y2)]
            )

        return answer
```

```cpp filename:C%2B%2B
class DetectSquares {
public:
    DetectSquares() {}

    void add(vector<int> point) {
        points[{point[0], point[1]}]++;
    }

    int count(vector<int> point) {
        int x = point[0], y = point[1];
        int answer = 0;

        for (auto& [p, cntDiag] : points) {
            auto [x2, y2] = p;
            if (x2 == x || y2 == y) {
                continue;
            }

            if (abs(x2 - x) != abs(y2 - y)) {
                continue;
            }

            answer += cntDiag * get(x2, y) * get(x, y2);
        }

        return answer;
    }

private:
    map<pair<int, int>, int> points;

    int get(int x, int y) {
        auto it = points.find({x, y});
        return it == points.end() ? 0 : it->second;
    }
};
```

```java filename:Java
class DetectSquares {
    private Map<List<Integer>, Integer> points;

    public DetectSquares() {
        points = new HashMap<>();
    }

    public void add(int[] point) {
        points.merge(Arrays.asList(point[0], point[1]), 1, Integer::sum);
    }

    public int count(int[] point) {
        int x = point[0], y = point[1];
        int answer = 0;

        for (Map.Entry<List<Integer>, Integer> entry : points.entrySet()) {
            int x2 = entry.getKey().get(0);
            int y2 = entry.getKey().get(1);
            int cntDiag = entry.getValue();

            if (x2 == x || y2 == y) {
                continue;
            }

            if (Math.abs(x2 - x) != Math.abs(y2 - y)) {
                continue;
            }

            answer += cntDiag
                * points.getOrDefault(Arrays.asList(x2, y), 0)
                * points.getOrDefault(Arrays.asList(x, y2), 0);
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var DetectSquares = function() {
    this.points = new Map();  // "x,y" -> frequency
};

DetectSquares.prototype.add = function(point) {
    const key = point.join(",");
    this.points.set(key, (this.points.get(key) || 0) + 1);
};

DetectSquares.prototype.count = function(point) {
    const [x, y] = point;
    let answer = 0;

    for (const [key, cntDiag] of this.points) {
        const [x2, y2] = key.split(",").map(Number);
        if (x2 === x || y2 === y) {
            continue;
        }

        if (Math.abs(x2 - x) !== Math.abs(y2 - y)) {
            continue;
        }

        answer +=
            cntDiag *
            (this.points.get(`${x2},${y}`) || 0) *
            (this.points.get(`${x},${y2}`) || 0);
    }

    return answer;
};
```

<strong>add: O(1), count: O(P) — P = distinct points · Space: O(P)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import defaultdict, Counter

class DetectSquares:

    def __init__(self):
        # points[x][y] = frequency
        self.points = defaultdict(Counter)

    def add(self, point):
        x, y = point
        self.points[x][y] += 1

    def count(self, point):
        x, y = point
        answer = 0

        for x2, ys in self.points.items():
            if x2 == x:
                continue

            side = abs(x2 - x)

            # Two possible diagonal y-coords
            for y2 in (y + side, y - side):
                if y2 not in ys:
                    continue

                cnt_diag   = ys[y2]           # (x2, y2)
                cnt_corner = self.points[x][y2] # (x,  y2)
                cnt_base   = self.points[x2][y] # (x2, y )

                answer += cnt_diag * cnt_corner * cnt_base

        return answer
```

```cpp filename:C%2B%2B
class DetectSquares {
public:
    DetectSquares() {}

    void add(vector<int> point) {
        int x = point[0], y = point[1];
        points[x][y]++;
    }

    int count(vector<int> point) {
        int x = point[0], y = point[1];
        int answer = 0;

        for (auto& [x2, ys] : points) {
            if (x2 == x) {
                continue;
            }

            int side = abs(x2 - x);

            // Two possible diagonal y-coords
            for (int y2 : {y + side, y - side}) {
                auto it = ys.find(y2);
                if (it == ys.end()) {
                    continue;
                }

                int cntDiag   = it->second;     // (x2, y2)
                int cntCorner = get(x, y2);     // (x,  y2)
                int cntBase   = get(x2, y);     // (x2, y )

                answer += cntDiag * cntCorner * cntBase;
            }
        }

        return answer;
    }

private:
    // points[x][y] = frequency
    unordered_map<int, unordered_map<int, int>> points;

    // lookup without inserting (inserting would invalidate the loop's iterators)
    int get(int x, int y) {
        auto row = points.find(x);
        if (row == points.end()) return 0;
        auto it = row->second.find(y);
        return it == row->second.end() ? 0 : it->second;
    }
};
```

```java filename:Java
class DetectSquares {
    // points[x][y] = frequency
    private Map<Integer, Map<Integer, Integer>> points;

    public DetectSquares() {
        points = new HashMap<>();
    }

    public void add(int[] point) {
        int x = point[0], y = point[1];
        points.computeIfAbsent(x, k -> new HashMap<>()).merge(y, 1, Integer::sum);
    }

    public int count(int[] point) {
        int x = point[0], y = point[1];
        int answer = 0;

        for (Map.Entry<Integer, Map<Integer, Integer>> entry : points.entrySet()) {
            int x2 = entry.getKey();
            Map<Integer, Integer> ys = entry.getValue();

            if (x2 == x) {
                continue;
            }

            int side = Math.abs(x2 - x);

            // Two possible diagonal y-coords
            for (int y2 : new int[]{y + side, y - side}) {
                if (!ys.containsKey(y2)) {
                    continue;
                }

                int cntDiag   = ys.get(y2);      // (x2, y2)
                int cntCorner = get(x, y2);      // (x,  y2)
                int cntBase   = get(x2, y);      // (x2, y )

                answer += cntDiag * cntCorner * cntBase;
            }
        }

        return answer;
    }

    private int get(int x, int y) {
        Map<Integer, Integer> ys = points.get(x);
        return ys == null ? 0 : ys.getOrDefault(y, 0);
    }
}
```

```javascript filename:JavaScript
var DetectSquares = function() {
    // points.get(x).get(y) = frequency
    this.points = new Map();
};

DetectSquares.prototype.add = function(point) {
    const [x, y] = point;
    if (!this.points.has(x)) {
        this.points.set(x, new Map());
    }
    const ys = this.points.get(x);
    ys.set(y, (ys.get(y) || 0) + 1);
};

DetectSquares.prototype.count = function(point) {
    const [x, y] = point;
    const get = (px, py) => this.points.get(px)?.get(py) || 0;
    let answer = 0;

    for (const [x2, ys] of this.points) {
        if (x2 === x) {
            continue;
        }

        const side = Math.abs(x2 - x);

        // Two possible diagonal y-coords
        for (const y2 of [y + side, y - side]) {
            if (!ys.has(y2)) {
                continue;
            }

            const cntDiag   = ys.get(y2);    // (x2, y2)
            const cntCorner = get(x, y2);    // (x,  y2)
            const cntBase   = get(x2, y);    // (x2, y )

            answer += cntDiag * cntCorner * cntBase;
        }
    }

    return answer;
};
```

<strong>add: O(1), count: O(distinct x-coords) · Space: O(P)</strong>

# Takeaway

<strong>Pattern</strong> — Coordinate frequency map — axis-aligned square: |Δx| == |Δy|; count = product of three corner frequencies
