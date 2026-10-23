---
id: 5bbd8a4c-88c0-7406-85d8-2fbc62938478
key: problem:sheet-150/lc-621
subject: sheet-150
topic: heap
title: Task Scheduler
slug: task-scheduler
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 621](https://leetcode.com/problems/task-scheduler/)

# Problem

Given CPU tasks represented by letters and cooldown `n` between identical tasks, return minimum CPU units of time to finish all tasks.

# Understanding the problem

Prioritize tasks with highest remaining frequency to minimize idle CPU slots.

# Intuition

Max Heap stores available task frequencies; Dequeue stores tasks in cooldown `(freq, available_time)`.

# Approach

1. Count frequencies using `Counter(tasks)`.
2. Push negated frequencies into max heap.
3. Use a queue `cooldown = deque()` storing `(remaining_freq, ready_time)`.
4. Increment `time`. Re-add ready tasks from queue to max heap.
5. Pop most frequent task, decrement frequency, and push to `cooldown` queue with `ready_time = time + n + 1`.

# Naive Solution — Brute Force

Simulate CPU cycles by re-sorting task frequency count every round.

```python filename:Python
from collections import Counter

class Solution:
    def leastInterval(self, tasks, n):

        count = Counter(tasks)
        time = 0

        while count:

            executed = 0

            # Sort by frequency each round
            available = sorted(
                count,
                key=count.get,
                reverse=True
            )

            for task in available[:n + 1]:

                if task in count:
                    count[task] -= 1
                    executed += 1

                    if count[task] == 0:
                        del count[task]

            if count:
                time += n + 1
            else:
                time += executed

        return time
```

```cpp filename:C%2B%2B
class Solution {
public:
    int leastInterval(vector<char>& tasks, int n) {
        unordered_map<char, int> count;
        for (char task : tasks) count[task]++;

        int time = 0;

        while (!count.empty()) {
            int executed = 0;

            // Sort by frequency each round
            vector<char> available;
            for (auto& [task, freq] : count) available.push_back(task);
            sort(available.begin(), available.end(), [&](char a, char b) {
                return count[a] > count[b];
            });

            for (int i = 0; i < (int)available.size() && i < n + 1; i++) {
                char task = available[i];
                count[task]--;
                executed++;

                if (count[task] == 0) count.erase(task);
            }

            if (!count.empty()) time += n + 1;
            else time += executed;
        }

        return time;
    }
};
```

```java filename:Java
class Solution {
    public int leastInterval(char[] tasks, int n) {
        Map<Character, Integer> count = new HashMap<>();
        for (char task : tasks) count.merge(task, 1, Integer::sum);

        int time = 0;

        while (!count.isEmpty()) {
            int executed = 0;

            // Sort by frequency each round
            List<Character> available = new ArrayList<>(count.keySet());
            available.sort((a, b) -> Integer.compare(count.get(b), count.get(a)));

            for (int i = 0; i < available.size() && i < n + 1; i++) {
                char task = available.get(i);
                int freq = count.get(task) - 1;
                executed++;

                if (freq == 0) count.remove(task);
                else count.put(task, freq);
            }

            if (!count.isEmpty()) time += n + 1;
            else time += executed;
        }

        return time;
    }
}
```

```javascript filename:JavaScript
var leastInterval = function(tasks, n) {
    const count = new Map();
    for (const task of tasks) count.set(task, (count.get(task) || 0) + 1);

    let time = 0;

    while (count.size > 0) {
        let executed = 0;

        // Sort by frequency each round
        const available = [...count.keys()].sort((a, b) => count.get(b) - count.get(a));

        for (const task of available.slice(0, n + 1)) {
            count.set(task, count.get(task) - 1);
            executed++;

            if (count.get(task) === 0) count.delete(task);
        }

        if (count.size > 0) time += n + 1;
        else time += executed;
    }

    return time;
};
```

<strong>Time: O(T × m log m) · Space: O(m)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq
from collections import Counter, deque

class Solution:
    def leastInterval(self, tasks, n):

        count = Counter(tasks)

        heap = [
            -freq
            for freq in count.values()
        ]

        heapq.heapify(heap)

        cooldown = deque()

        time = 0

        while heap or cooldown:
            time += 1

            # Add tasks whose cooldown is over
            while (
                cooldown
                and cooldown[0][1] == time
            ):
                freq, _ = cooldown.popleft()
                heapq.heappush(heap, freq)

            if heap:
                freq = heapq.heappop(heap)
                freq += 1

                if freq != 0:
                    cooldown.append(
                        (freq, time + n + 1)
                    )

        return time
```

```cpp filename:C%2B%2B
class Solution {
public:
    int leastInterval(vector<char>& tasks, int n) {
        unordered_map<char, int> count;
        for (char task : tasks) count[task]++;

        priority_queue<int> heap;  // max-heap of remaining counts
        for (auto& [task, freq] : count) heap.push(freq);

        queue<pair<int, int>> cooldown;  // {remaining, time it becomes available}

        int time = 0;

        while (!heap.empty() || !cooldown.empty()) {
            time++;

            // Add tasks whose cooldown is over
            while (!cooldown.empty() && cooldown.front().second == time) {
                heap.push(cooldown.front().first);
                cooldown.pop();
            }

            if (!heap.empty()) {
                int freq = heap.top() - 1;
                heap.pop();

                if (freq != 0) cooldown.push({freq, time + n + 1});
            }
        }

        return time;
    }
};
```

```java filename:Java
class Solution {
    public int leastInterval(char[] tasks, int n) {
        Map<Character, Integer> count = new HashMap<>();
        for (char task : tasks) count.merge(task, 1, Integer::sum);

        // max-heap of remaining counts
        PriorityQueue<Integer> heap = new PriorityQueue<>(Collections.reverseOrder());
        heap.addAll(count.values());

        Deque<int[]> cooldown = new ArrayDeque<>();  // {remaining, time it becomes available}

        int time = 0;

        while (!heap.isEmpty() || !cooldown.isEmpty()) {
            time++;

            // Add tasks whose cooldown is over
            while (!cooldown.isEmpty() && cooldown.peekFirst()[1] == time) {
                heap.offer(cooldown.pollFirst()[0]);
            }

            if (!heap.isEmpty()) {
                int freq = heap.poll() - 1;

                if (freq != 0) cooldown.offerLast(new int[]{freq, time + n + 1});
            }
        }

        return time;
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor(compare = (a, b) => a - b, items = []) {
        this.compare = compare;
        this.data = items;
        for (let i = (items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
    }

    size() { return this.data.length; }

    peek() { return this.data[0]; }

    push(value) {
        const data = this.data;
        data.push(value);
        let i = data.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.compare(data[i], data[parent]) >= 0) break;
            [data[i], data[parent]] = [data[parent], data[i]];
            i = parent;
        }
    }

    pop() {
        const data = this.data;
        const top = data[0];
        const last = data.pop();
        if (data.length > 0) {
            data[0] = last;
            this.siftDown(0);
        }
        return top;
    }

    siftDown(i) {
        const data = this.data;
        while (true) {
            const left = 2 * i + 1, right = left + 1;
            let smallest = i;
            if (left < data.length && this.compare(data[left], data[smallest]) < 0) smallest = left;
            if (right < data.length && this.compare(data[right], data[smallest]) < 0) smallest = right;
            if (smallest === i) return;
            [data[i], data[smallest]] = [data[smallest], data[i]];
            i = smallest;
        }
    }
}

var leastInterval = function(tasks, n) {
    const count = new Map();
    for (const task of tasks) count.set(task, (count.get(task) || 0) + 1);

    const heap = new MinHeap((a, b) => b - a, [...count.values()]);  // max-heap

    const cooldown = [];  // [remaining, time it becomes available]
    let head = 0;

    let time = 0;

    while (heap.size() > 0 || head < cooldown.length) {
        time++;

        // Add tasks whose cooldown is over
        while (head < cooldown.length && cooldown[head][1] === time) {
            heap.push(cooldown[head][0]);
            head++;
        }

        if (heap.size() > 0) {
            const freq = heap.pop() - 1;

            if (freq !== 0) cooldown.push([freq, time + n + 1]);
        }
    }

    return time;
};
```

<strong>Time: O(T log m) · Space: O(m)</strong>

# Takeaway

<strong>Pattern</strong> — Frequency + Max Heap + Cooldown Queue
