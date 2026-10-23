---
id: e63adfda-4521-7259-855c-0d79d84eb283
key: problem:sheet-150/lc-155
subject: sheet-150
topic: stack
title: Min Stack
slug: min-stack
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 155](https://leetcode.com/problems/min-stack/)

# Problem

Design a stack that supports `push`, `pop`, `top`, and retrieving the minimum element `getMin` in <strong>O(1)</strong> time.

# Understanding the problem

All 4 operations must execute in constant time $O(1)$.

# Intuition

Maintain an auxiliary stack `minimum` that tracks the minimum element at each depth of the stack.

# Approach

1. Maintain main `stack` and parallel `minimum` stack.
2. On `push(val)`: append `val` to main stack, and append `min(val, minimum[-1])` to minimum stack.
3. On `pop()`: pop from both main and minimum stacks simultaneously.
4. `getMin()` simply returns `minimum[-1]` in O(1) time.

# Naive Solution — Brute Force

Use a normal stack and compute `min(self.stack)` dynamically inside `getMin()`.

```python filename:Python
class MinStack:

    def __init__(self):
        self.stack = []

    def push(self, val):
        self.stack.append(val)

    def pop(self):
        return self.stack.pop()

    def top(self):
        return self.stack[-1]

    def getMin(self):
        return min(self.stack)
```

```cpp filename:C%2B%2B
class MinStack {
    vector<int> stack;
public:
    MinStack() {}

    void push(int val) { stack.push_back(val); }

    void pop() { stack.pop_back(); }

    int top() { return stack.back(); }

    int getMin() { return *min_element(stack.begin(), stack.end()); }
};
```

```java filename:Java
class MinStack {
    private List<Integer> stack = new ArrayList<>();

    public MinStack() {}

    public void push(int val) { stack.add(val); }

    public void pop() { stack.remove(stack.size() - 1); }

    public int top() { return stack.get(stack.size() - 1); }

    public int getMin() { return Collections.min(stack); }
}
```

```javascript filename:JavaScript
class MinStack {
    constructor() {
        this.stack = [];
    }

    push(val) { this.stack.push(val); }

    pop() { this.stack.pop(); }

    top() { return this.stack[this.stack.length - 1]; }

    getMin() { return Math.min(...this.stack); }
}
```

<strong>getMin: O(n), Others: O(1) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class MinStack:

    def __init__(self):
        self.stack = []
        self.minimum = []

    def push(self, val):
        self.stack.append(val)

        if not self.minimum:
            self.minimum.append(val)
        else:
            self.minimum.append(
                min(val, self.minimum[-1])
            )

    def pop(self):
        self.minimum.pop()
        return self.stack.pop()

    def top(self):
        return self.stack[-1]

    def getMin(self):
        return self.minimum[-1]
```

```cpp filename:C%2B%2B
class MinStack {
    vector<int> stack, minimum;
public:
    MinStack() {}

    void push(int val) {
        stack.push_back(val);
        if (minimum.empty()) minimum.push_back(val);
        else minimum.push_back(min(val, minimum.back()));
    }

    void pop() {
        minimum.pop_back();
        stack.pop_back();
    }

    int top() { return stack.back(); }

    int getMin() { return minimum.back(); }
};
```

```java filename:Java
class MinStack {
    private Deque<Integer> stack = new ArrayDeque<>();
    private Deque<Integer> minimum = new ArrayDeque<>();

    public MinStack() {}

    public void push(int val) {
        stack.push(val);
        if (minimum.isEmpty()) minimum.push(val);
        else minimum.push(Math.min(val, minimum.peek()));
    }

    public void pop() {
        minimum.pop();
        stack.pop();
    }

    public int top() { return stack.peek(); }

    public int getMin() { return minimum.peek(); }
}
```

```javascript filename:JavaScript
class MinStack {
    constructor() {
        this.stack = [];
        this.minimum = [];
    }

    push(val) {
        this.stack.push(val);
        if (!this.minimum.length) this.minimum.push(val);
        else this.minimum.push(Math.min(val, this.minimum[this.minimum.length - 1]));
    }

    pop() {
        this.minimum.pop();
        this.stack.pop();
    }

    top() { return this.stack[this.stack.length - 1]; }

    getMin() { return this.minimum[this.minimum.length - 1]; }
}
```

<strong>All operations: O(1) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Auxiliary stack tracking answer query at each stack depth
