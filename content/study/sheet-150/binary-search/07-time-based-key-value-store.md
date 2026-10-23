---
id: 0d9338b1-fe82-7a68-8cdf-2c36fd70859d
key: problem:sheet-150/lc-981
subject: sheet-150
topic: binary-search
title: Time Based Key-Value Store
slug: time-based-key-value-store
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 981](https://leetcode.com/problems/time-based-key-value-store/)

# Problem

Design a key-value data structure that can store multiple values for the same key at different timestamps and retrieve key value at `timestamp_prev <= timestamp`.

# Understanding the problem

Timestamps for a key are added in strictly increasing order, so timestamps per key are sorted.

# Intuition

Binary search for the rightmost element whose timestamp $\\le$ requested timestamp.

# Approach

1. `set(key, val, time)`: append `(time, val)` to list `store[key]`.
2. `get(key, target_time)`: binary search `values = store[key]`.
3. While `left <= right`:
4. If `values[mid][0] <= target_time`: record `answer = values[mid][1]` and search right `left = mid + 1`.
5. Else: search left `right = mid - 1`.
6. Return `answer`.

# Naive Solution — Brute Force

Store list of `(timestamp, value)` tuples and scan backward linearly on `get()`.

```python filename:Python
class TimeMap:

    def __init__(self):
        self.store = {}

    def set(self, key, value, timestamp):

        if key not in self.store:
            self.store[key] = []

        self.store[key].append(
            (timestamp, value)
        )

    def get(self, key, timestamp):

        if key not in self.store:
            return ""

        result = ""

        for time, value in reversed(
            self.store[key]
        ):
            if time <= timestamp:
                return value

        return result
```

```cpp filename:C%2B%2B
class TimeMap {
    unordered_map<string, vector<pair<int, string>>> store;

public:
    TimeMap() {}

    void set(string key, string value, int timestamp) {
        store[key].push_back({timestamp, value});
    }

    string get(string key, int timestamp) {
        auto it = store.find(key);
        if (it == store.end()) {
            return "";
        }

        const auto& values = it->second;

        for (int i = values.size() - 1; i >= 0; i--) {
            if (values[i].first <= timestamp) {
                return values[i].second;
            }
        }

        return "";
    }
};
```

```java filename:Java
class TimeMap {
    private Map<String, List<Pair>> store;

    private static class Pair {
        int time;
        String value;

        Pair(int time, String value) {
            this.time = time;
            this.value = value;
        }
    }

    public TimeMap() {
        store = new HashMap<>();
    }

    public void set(String key, String value, int timestamp) {
        store.computeIfAbsent(key, k -> new ArrayList<>()).add(new Pair(timestamp, value));
    }

    public String get(String key, int timestamp) {
        if (!store.containsKey(key)) {
            return "";
        }

        List<Pair> values = store.get(key);

        for (int i = values.size() - 1; i >= 0; i--) {
            if (values.get(i).time <= timestamp) {
                return values.get(i).value;
            }
        }

        return "";
    }
}
```

```javascript filename:JavaScript
class TimeMap {
    constructor() {
        this.store = new Map();
    }

    set(key, value, timestamp) {
        if (!this.store.has(key)) {
            this.store.set(key, []);
        }

        this.store.get(key).push([timestamp, value]);
    }

    get(key, timestamp) {
        if (!this.store.has(key)) {
            return "";
        }

        const values = this.store.get(key);

        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i][0] <= timestamp) {
                return values[i][1];
            }
        }

        return "";
    }
}
```

<strong>get: O(n), set: O(1) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class TimeMap:

    def __init__(self):
        self.store = {}

    def set(self, key, value, timestamp):

        if key not in self.store:
            self.store[key] = []

        self.store[key].append(
            (timestamp, value)
        )

    def get(self, key, timestamp):

        if key not in self.store:
            return ""

        values = self.store[key]

        left = 0
        right = len(values) - 1

        answer = ""

        while left <= right:

            mid = left + (right - left) // 2

            if values[mid][0] <= timestamp:
                answer = values[mid][1]
                left = mid + 1
            else:
                right = mid - 1

        return answer
```

```cpp filename:C%2B%2B
class TimeMap {
    unordered_map<string, vector<pair<int, string>>> store;

public:
    TimeMap() {}

    void set(string key, string value, int timestamp) {
        store[key].push_back({timestamp, value});
    }

    string get(string key, int timestamp) {
        auto it = store.find(key);
        if (it == store.end()) {
            return "";
        }

        const auto& values = it->second;

        int left = 0;
        int right = values.size() - 1;

        string answer = "";

        while (left <= right) {
            int mid = left + (right - left) / 2;

            if (values[mid].first <= timestamp) {
                answer = values[mid].second;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return answer;
    }
};
```

```java filename:Java
class TimeMap {
    private Map<String, List<Pair>> store;

    private static class Pair {
        int time;
        String value;

        Pair(int time, String value) {
            this.time = time;
            this.value = value;
        }
    }

    public TimeMap() {
        store = new HashMap<>();
    }

    public void set(String key, String value, int timestamp) {
        store.computeIfAbsent(key, k -> new ArrayList<>()).add(new Pair(timestamp, value));
    }

    public String get(String key, int timestamp) {
        if (!store.containsKey(key)) {
            return "";
        }

        List<Pair> values = store.get(key);

        int left = 0;
        int right = values.size() - 1;

        String answer = "";

        while (left <= right) {
            int mid = left + (right - left) / 2;

            if (values.get(mid).time <= timestamp) {
                answer = values.get(mid).value;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
class TimeMap {
    constructor() {
        this.store = new Map();
    }

    set(key, value, timestamp) {
        if (!this.store.has(key)) {
            this.store.set(key, []);
        }

        this.store.get(key).push([timestamp, value]);
    }

    get(key, timestamp) {
        if (!this.store.has(key)) {
            return "";
        }

        const values = this.store.get(key);

        let left = 0;
        let right = values.length - 1;

        let answer = "";

        while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);

            if (values[mid][0] <= timestamp) {
                answer = values[mid][1];
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return answer;
    }
}
```

<strong>get: O(log n), set: O(1) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Sorted timestamps → Rightmost valid binary search
