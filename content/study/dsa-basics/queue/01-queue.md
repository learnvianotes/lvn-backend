---
id: 9c379d89-f564-75e3-871b-fe94596f910a
key: topic:dsa-basics/queue
subject: dsa-basics
topic: queue
title: Queue
slug: queue
order: 1
---

A queue is a <strong>First In, First Out</strong> (FIFO) collection: elements enter at the <em>rear</em> and leave from the <em>front</em>, exactly like a line at a ticket counter. It is the data structure behind scheduling, buffering and breadth-first search.

> [!INFO]
>
> <strong>Queue</strong> — a linear data structure where insertion (`enqueue`) happens at one end, the rear, and deletion (`dequeue`) happens at the other end, the front. The element that has waited longest is served first.

```text filename:A%20queue%20after%20enqueue(10)%2C%20enqueue(15)%2C%20enqueue(20)%2C%20enqueue(30)%2C%20enqueue(40)%20%E2%80%94%2010%20leaves%20first
dequeue()  ◀──  ┌────┬────┬────┬────┬────┐  ◀──  enqueue(x)
                │ 10 │ 15 │ 20 │ 30 │ 40 │
                └────┴────┴────┴────┴────┘
                  ↑                   ↑
                front               rear
```

# Operations

| Operation | What it does | Time |
| --- | --- | --- |
| `enqueue(x)` | Insert `x` at the rear | O(1) |
| `dequeue()` | Remove and return the front element | O(1) |
| `front()` / `getFront()` | Return the front element without removing it | O(1) |
| `rear()` / `getRear()` | Return the rear element without removing it | O(1) |
| `isEmpty()` | `true` when the queue has no elements | O(1) |
| `size()` | Number of elements | O(1) |

Every operation is O(1) — <em>provided the implementation is right</em>. A plain array where `dequeue` removes index 0 is the classic way to get this wrong: every remaining element shifts one slot left, so `dequeue` becomes O(n). The circular-array section below fixes that.

> [!WARNING] Watch out
>
> <strong>Underflow</strong> — `dequeue()` or `front()` on an empty queue. <strong>Overflow</strong> — `enqueue()` on a fixed-capacity queue that is full. Check `isEmpty()` / `isFull()` first; the built-in containers raise (Python/C++ UB/Java `remove`) or return `null`/`undefined` (Java `poll`, JavaScript `shift`).

# Where queues are used

> [!NOTE] One resource, many consumers
>
> Ticket counters, printer spooling, a single CPU shared by many processes — whoever asked first is served first.

> [!NOTE] Buffers between fast and slow devices
>
> The keyboard buffer, network sockets and audio/video pipelines queue data produced faster than it is consumed.

> [!NOTE] Operating systems
>
> FCFS (first-come, first-served) scheduling, semaphore wait lists, I/O request queues, spooling.

> [!NOTE] Networks and messaging
>
> Routers and switches queue packets; mail servers and message brokers (RabbitMQ, Kafka) queue jobs.

> [!NOTE] Breadth-first search
>
> BFS on graphs and level-order traversal of trees visit nodes in the order they were discovered — a queue (see Trees and Graphs).

> [!NOTE] Variations
>
> <strong>Deque</strong> (both ends), <strong>priority queue</strong> (served by priority, not arrival), <strong>double-ended priority queue</strong> (min and max).

# Using the built-in containers

Every language ships a ready-made queue. The rule is the same everywhere: add at the back, remove at the front, and make sure removing at the front is O(1).

```python filename:Python
from collections import deque

q = deque()                       # O(1) at both ends
q.append(10)                      # enqueue at the rear
q.append(20)
q.append(30)
print("front:", q[0])
print("rear:", q[-1])
print("dequeued:", q.popleft())   # dequeue from the front
print("dequeued:", q.popleft())
print("size:", len(q))
print("empty:", len(q) == 0)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <queue>
using namespace std;

int main() {
    queue<int> q;                 // std::queue adapts a std::deque
    q.push(10);                   // enqueue at the back
    q.push(20);
    q.push(30);
    cout << "front: " << q.front() << "\n";
    cout << "rear: " << q.back() << "\n";
    cout << "dequeued: " << q.front() << "\n"; q.pop();   // pop() returns nothing in C++
    cout << "dequeued: " << q.front() << "\n"; q.pop();
    cout << "size: " << q.size() << "\n";
    cout << "empty: " << (q.empty() ? "True" : "False") << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;

public class Main {
    public static void main(String[] args) {
        ArrayDeque<Integer> q = new ArrayDeque<>();   // implements Queue (and Deque)
        q.offer(10);                                  // enqueue at the tail
        q.offer(20);
        q.offer(30);
        System.out.println("front: " + q.peek());
        System.out.println("rear: " + q.peekLast());  // a Deque extra — Queue alone has no rear access
        System.out.println("dequeued: " + q.poll());  // dequeue from the head
        System.out.println("dequeued: " + q.poll());
        System.out.println("size: " + q.size());
        System.out.println("empty: " + (q.isEmpty() ? "True" : "False"));
    }
}
```

```javascript filename:JavaScript
const q = [];                       // an array used as a queue
q.push(10);                         // enqueue at the end
q.push(20);
q.push(30);
console.log("front:", q[0]);
console.log("rear:", q[q.length - 1]);
console.log("dequeued:", q.shift());   // O(n): every element moves one slot left
console.log("dequeued:", q.shift());
console.log("size:", q.length);
console.log("empty:", q.length === 0 ? "True" : "False");
```

```text filename:Output
front: 10
rear: 30
dequeued: 10
dequeued: 20
size: 1
empty: False
```

| Language | Container | enqueue | dequeue | front | Notes |
| --- | --- | --- | --- | --- | --- |
| Python | `collections.deque` | `append(x)` | `popleft()` | `q[0]` | O(1) at both ends; `q[-1]` is the rear |
| Python | `queue.Queue` | `put(x)` | `get()` | — | thread-safe, blocking — for producer/consumer code, not algorithms |
| C++ | `std::queue<T>` | `push(x)` | `pop()` (returns nothing) | `front()` | `back()` is the rear; adapts `std::deque` |
| Java | `ArrayDeque<T>` / `LinkedList<T>` as `Queue<T>` | `offer(x)` / `add(x)` | `poll()` / `remove()` | `peek()` / `element()` | `offer/poll/peek` return `false`/`null` on failure, `add/remove/element` throw |
| JavaScript | `Array` | `push(x)` | `shift()` | `q[0]` | `shift()` is O(n) — fine for small queues, a trap in BFS on large graphs |

> [!WARNING] Pitfall
>
> Using a Python <strong>list</strong> as a queue. `q.pop(0)` shifts every remaining element, so a loop that dequeues `n` items costs O(n²). The notes' original list version is shown below only to make the point — reach for `collections.deque`.

```python filename:Python
q = []
q.append(10)
q.append(20)
q.append(30)
print(q)          # [10, 20, 30]
print(q.pop(0))   # 10   ← removes the front, but shifts 20 and 30 left: O(n)
print(q)          # [20, 30]
q.pop(0)
print(q)          # [30]
```

> [!NOTE] Key point
>
> `queue.Queue` is for threads: `get()` <strong>blocks</strong> until an item arrives, so calling it on an empty queue in single-threaded code hangs the program. Use `get_nowait()` / `put_nowait()` if you must use it outside a producer/consumer setting.

```python filename:Python
from queue import Queue

q = Queue()
q.put(10)
q.put(20)
print(q.get())            # 10
print(q.qsize())          # 1
print(q.empty())          # False
print(q.get_nowait())     # 20
```

# Implementing a queue with a linked list

Keep two pointers: `front` (the head, where we dequeue) and `rear` (the tail, where we enqueue). Appending at the tail and removing at the head of a singly linked list are both O(1), and the queue never needs resizing.

```text filename:enqueue(10)%2C%20enqueue(20)%2C%20enqueue(30)%20%E2%80%94%20the%20oldest%20node%20is%20the%20head
front                                   rear
 ↓                                       ↓
┌────┬───┐   ┌────┬───┐   ┌────┬───┐
│ 10 │ ●─┼──▶│ 20 │ ●─┼──▶│ 30 │ ∅ │   enqueue(40): rear.next = node, rear = node
└────┴───┘   └────┴───┘   └────┴───┘   dequeue():   front = front.next
```

1. <strong>enqueue(x)</strong>

   Create a node. If the queue is empty, `front = rear = node`; otherwise `rear.next = node` and `rear = node`.

2. <strong>dequeue()</strong>

   Save `front.value`, move `front = front.next`. If `front` became `null`, also set `rear = null` — the classic bug is leaving `rear` pointing at the freed node.

3. <strong>getFront / getRear</strong>

   Read `front.value` / `rear.value` — O(1) because we keep both pointers.

```python filename:Python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None

class Queue:
    def __init__(self):
        self.front = None        # dequeue here (head)
        self.rear = None         # enqueue here (tail)
        self.size = 0

    def enqueue(self, value):
        node = Node(value)
        if self.rear is None:            # empty: the node is both front and rear
            self.front = self.rear = node
        else:
            self.rear.next = node        # link after the old tail
            self.rear = node
        self.size += 1

    def dequeue(self):
        if self.front is None:
            raise IndexError("dequeue from empty queue")
        node = self.front
        self.front = node.next
        if self.front is None:           # became empty: rear must not dangle
            self.rear = None
        self.size -= 1
        return node.value

    def get_front(self):
        return None if self.front is None else self.front.value

    def get_rear(self):
        return None if self.rear is None else self.rear.value

    def is_empty(self):
        return self.size == 0

q = Queue()
for x in (10, 20, 30):
    q.enqueue(x)
print("front:", q.get_front())
print("rear:", q.get_rear())
print("dequeued:", q.dequeue())
print("front:", q.get_front())
print("rear:", q.get_rear())
print("size:", q.size)
print("empty:", q.is_empty())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
using namespace std;

struct Node {
    int value;
    Node* next;
    Node(int v) : value(v), next(nullptr) {}
};

class Queue {
    Node* front = nullptr;     // dequeue here (head)
    Node* rear = nullptr;      // enqueue here (tail)
    int count = 0;
public:
    ~Queue() { while (front) dequeue(); }
    void enqueue(int v) {
        Node* node = new Node(v);
        if (!rear) front = rear = node;          // empty: the node is both front and rear
        else { rear->next = node; rear = node; } // link after the old tail
        count++;
    }
    int dequeue() {
        if (!front) throw runtime_error("dequeue from empty queue");
        Node* node = front;
        int v = node->value;
        front = node->next;
        if (!front) rear = nullptr;              // became empty: rear must not dangle
        delete node;
        count--;
        return v;
    }
    int getFront() const { return front->value; }
    int getRear() const { return rear->value; }
    bool isEmpty() const { return count == 0; }
    int size() const { return count; }
};

int main() {
    Queue q;
    for (int x : {10, 20, 30}) q.enqueue(x);
    cout << "front: " << q.getFront() << "\n";
    cout << "rear: " << q.getRear() << "\n";
    cout << "dequeued: " << q.dequeue() << "\n";
    cout << "front: " << q.getFront() << "\n";
    cout << "rear: " << q.getRear() << "\n";
    cout << "size: " << q.size() << "\n";
    cout << "empty: " << (q.isEmpty() ? "True" : "False") << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int value; Node next;
        Node(int v) { value = v; }
    }

    static class Queue {
        Node front, rear;          // dequeue at front (head), enqueue at rear (tail)
        int size;
        void enqueue(int v) {
            Node node = new Node(v);
            if (rear == null) front = rear = node;      // empty: the node is both front and rear
            else { rear.next = node; rear = node; }     // link after the old tail
            size++;
        }
        int dequeue() {
            if (front == null) throw new RuntimeException("dequeue from empty queue");
            int v = front.value;
            front = front.next;
            if (front == null) rear = null;             // became empty: rear must not dangle
            size--;
            return v;
        }
        Integer getFront() { return front == null ? null : front.value; }
        Integer getRear() { return rear == null ? null : rear.value; }
        boolean isEmpty() { return size == 0; }
    }

    public static void main(String[] args) {
        Queue q = new Queue();
        for (int x : new int[]{10, 20, 30}) q.enqueue(x);
        System.out.println("front: " + q.getFront());
        System.out.println("rear: " + q.getRear());
        System.out.println("dequeued: " + q.dequeue());
        System.out.println("front: " + q.getFront());
        System.out.println("rear: " + q.getRear());
        System.out.println("size: " + q.size);
        System.out.println("empty: " + (q.isEmpty() ? "True" : "False"));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(value) { this.value = value; this.next = null; }
}

class Queue {
    constructor() { this.front = null; this.rear = null; this.size = 0; }
    enqueue(value) {
        const node = new Node(value);
        if (this.rear === null) this.front = this.rear = node;   // empty: both ends
        else { this.rear.next = node; this.rear = node; }        // link after the old tail
        this.size++;
    }
    dequeue() {
        if (this.front === null) throw new Error("dequeue from empty queue");
        const node = this.front;
        this.front = node.next;
        if (this.front === null) this.rear = null;               // became empty: rear must not dangle
        this.size--;
        return node.value;
    }
    getFront() { return this.front ? this.front.value : null; }
    getRear() { return this.rear ? this.rear.value : null; }
    isEmpty() { return this.size === 0; }
}

const q = new Queue();
for (const x of [10, 20, 30]) q.enqueue(x);
console.log("front:", q.getFront());
console.log("rear:", q.getRear());
console.log("dequeued:", q.dequeue());
console.log("front:", q.getFront());
console.log("rear:", q.getRear());
console.log("size:", q.size);
console.log("empty:", q.isEmpty() ? "True" : "False");
```

```text filename:Output
front: 10
rear: 30
dequeued: 10
front: 20
rear: 30
size: 2
empty: False
```

Time O(1) per operation · Space O(n) for n elements

> [!WARNING] Pitfall
>
> Enqueueing at the <strong>head</strong> and dequeueing at the tail would need the node <em>before</em> the tail, which a singly linked list cannot reach in O(1). Always enqueue at the tail and dequeue at the head.

# Implementing a queue with a circular array

A fixed array of capacity `cap` has two naive designs, and both are bad. If `dequeue` removes `slots[0]` and shifts everything, it is O(n). If instead it just advances a `front` index, each dequeue leaves a dead slot behind: after a few dequeues `rear` reaches the end and `enqueue` fails even though the array is half empty.

```text filename:Advancing%20front%20without%20wrapping%20wastes%20every%20slot%20that%20has%20been%20dequeued
Plain array, dequeue by advancing front (capacity 5):

  index:   0     1     2     3     4
        ┌─────┬─────┬─────┬─────┬─────┐
        │  ×  │  ×  │ 30  │ 40  │ 50  │   front = 2, rear = 5
        └─────┴─────┴─────┴─────┴─────┘
           ↑ dead slots              ↑ rear is past the end:
                                       enqueue(60) fails although two slots are free
```

The fix is to let both indices <strong>wrap around</strong> with the modulo operator: `rear = (rear + 1) % cap` and `front = (front + 1) % cap`. The array is treated as a ring, so a dequeued slot is reused by the next enqueue.

```text filename:The%20ring%20reuses%20the%20slots%20freed%20by%20dequeue%3B%20the%20logical%20order%20is%20read%20from%20front%2C%20wrapping%20with%20%25%20cap
Circular array — same state, then enqueue(60), enqueue(70):

  index:   0     1     2     3     4
        ┌─────┬─────┬─────┬─────┬─────┐
        │ 60  │ 70  │ 30  │ 40  │ 50  │   rear wrapped: 5 % 5 = 0, then 1
        └─────┴─────┴─────┴─────┴─────┘
                       ↑ front = 2
           ↑ rear = 2 (next free slot) — equal to front, so size tells us: full

  logical order (front → rear):  30  40  50  60  70
```

> [!NOTE] Key point
>
> When `front == rear` the ring is either <strong>empty or full</strong> — the indices alone cannot tell. Either keep a `size` counter (done below) or deliberately leave one slot unused and treat `(rear + 1) % cap == front` as full.

> [!TIP] Example
>
> <strong>Input:</strong> `capacity = 5; enqueue 10 20 30 40 50; dequeue ×2; enqueue 60 70`<br><strong>Output:</strong> `slots: 60 70 30 40 50 — logical order 30 40 50 60 70`

```python filename:Python
class CircularQueue:
    def __init__(self, capacity):
        self.slots = [None] * capacity
        self.cap = capacity
        self.front = 0          # index of the first element
        self.rear = 0           # index where the next element goes
        self.size = 0           # needed: front == rear for both empty and full

    def is_empty(self):
        return self.size == 0

    def is_full(self):
        return self.size == self.cap

    def enqueue(self, value):
        if self.is_full():
            raise OverflowError("queue is full")
        slot = self.rear
        self.slots[slot] = value
        self.rear = (self.rear + 1) % self.cap     # wrap around
        self.size += 1
        return slot

    def dequeue(self):
        if self.is_empty():
            raise IndexError("queue is empty")
        value = self.slots[self.front]
        self.front = (self.front + 1) % self.cap   # wrap around
        self.size -= 1
        return value

    def get_front(self):
        return self.slots[self.front]

    def get_rear(self):
        return self.slots[(self.rear - 1 + self.cap) % self.cap]

q = CircularQueue(5)
for x in (10, 20, 30, 40, 50):
    q.enqueue(x)
print("front:", q.get_front())
print("rear:", q.get_rear())
print("full:", q.is_full())
print("dequeued:", q.dequeue())
print("dequeued:", q.dequeue())
print("enqueue 60 → slot", q.enqueue(60))
print("enqueue 70 → slot", q.enqueue(70))
print("slots:", *q.slots)
print("front =", q.front, "rear =", q.rear, "size =", q.size)
print("in order:", *(q.slots[(q.front + i) % q.cap] for i in range(q.size)))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <vector>
using namespace std;

class CircularQueue {
public:
    vector<int> slots;
    int cap, front = 0, rear = 0, size = 0;   // size: front == rear for both empty and full
    CircularQueue(int capacity) : slots(capacity, 0), cap(capacity) {}
    bool isEmpty() const { return size == 0; }
    bool isFull() const { return size == cap; }
    int enqueue(int value) {
        if (isFull()) throw runtime_error("queue is full");
        int slot = rear;
        slots[slot] = value;
        rear = (rear + 1) % cap;              // wrap around
        size++;
        return slot;
    }
    int dequeue() {
        if (isEmpty()) throw runtime_error("queue is empty");
        int value = slots[front];
        front = (front + 1) % cap;            // wrap around
        size--;
        return value;
    }
    int getFront() const { return slots[front]; }
    int getRear() const { return slots[(rear - 1 + cap) % cap]; }
};

int main() {
    CircularQueue q(5);
    for (int x : {10, 20, 30, 40, 50}) q.enqueue(x);
    cout << "front: " << q.getFront() << "\n";
    cout << "rear: " << q.getRear() << "\n";
    cout << "full: " << (q.isFull() ? "True" : "False") << "\n";
    cout << "dequeued: " << q.dequeue() << "\n";
    cout << "dequeued: " << q.dequeue() << "\n";
    cout << "enqueue 60 → slot " << q.enqueue(60) << "\n";
    cout << "enqueue 70 → slot " << q.enqueue(70) << "\n";
    cout << "slots:";
    for (int v : q.slots) cout << " " << v;
    cout << "\n";
    cout << "front = " << q.front << " rear = " << q.rear << " size = " << q.size << "\n";
    cout << "in order:";
    for (int i = 0; i < q.size; i++) cout << " " << q.slots[(q.front + i) % q.cap];
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static class CircularQueue {
        int[] slots;
        int cap, front = 0, rear = 0, size = 0;   // size: front == rear for both empty and full
        CircularQueue(int capacity) { slots = new int[capacity]; cap = capacity; }
        boolean isEmpty() { return size == 0; }
        boolean isFull() { return size == cap; }
        int enqueue(int value) {
            if (isFull()) throw new RuntimeException("queue is full");
            int slot = rear;
            slots[slot] = value;
            rear = (rear + 1) % cap;              // wrap around
            size++;
            return slot;
        }
        int dequeue() {
            if (isEmpty()) throw new RuntimeException("queue is empty");
            int value = slots[front];
            front = (front + 1) % cap;            // wrap around
            size--;
            return value;
        }
        int getFront() { return slots[front]; }
        int getRear() { return slots[(rear - 1 + cap) % cap]; }
    }

    public static void main(String[] args) {
        CircularQueue q = new CircularQueue(5);
        for (int x : new int[]{10, 20, 30, 40, 50}) q.enqueue(x);
        System.out.println("front: " + q.getFront());
        System.out.println("rear: " + q.getRear());
        System.out.println("full: " + (q.isFull() ? "True" : "False"));
        System.out.println("dequeued: " + q.dequeue());
        System.out.println("dequeued: " + q.dequeue());
        System.out.println("enqueue 60 → slot " + q.enqueue(60));
        System.out.println("enqueue 70 → slot " + q.enqueue(70));
        StringBuilder sb = new StringBuilder("slots:");
        for (int v : q.slots) sb.append(' ').append(v);
        System.out.println(sb);
        System.out.println("front = " + q.front + " rear = " + q.rear + " size = " + q.size);
        sb = new StringBuilder("in order:");
        for (int i = 0; i < q.size; i++) sb.append(' ').append(q.slots[(q.front + i) % q.cap]);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
class CircularQueue {
    constructor(capacity) {
        this.slots = new Array(capacity).fill(null);
        this.cap = capacity;
        this.front = 0;        // index of the first element
        this.rear = 0;         // index where the next element goes
        this.size = 0;         // needed: front == rear for both empty and full
    }
    isEmpty() { return this.size === 0; }
    isFull() { return this.size === this.cap; }
    enqueue(value) {
        if (this.isFull()) throw new Error("queue is full");
        const slot = this.rear;
        this.slots[slot] = value;
        this.rear = (this.rear + 1) % this.cap;      // wrap around
        this.size++;
        return slot;
    }
    dequeue() {
        if (this.isEmpty()) throw new Error("queue is empty");
        const value = this.slots[this.front];
        this.front = (this.front + 1) % this.cap;    // wrap around
        this.size--;
        return value;
    }
    getFront() { return this.slots[this.front]; }
    getRear() { return this.slots[(this.rear - 1 + this.cap) % this.cap]; }
}

const q = new CircularQueue(5);
for (const x of [10, 20, 30, 40, 50]) q.enqueue(x);
console.log("front:", q.getFront());
console.log("rear:", q.getRear());
console.log("full:", q.isFull() ? "True" : "False");
console.log("dequeued:", q.dequeue());
console.log("dequeued:", q.dequeue());
console.log("enqueue 60 → slot", q.enqueue(60));
console.log("enqueue 70 → slot", q.enqueue(70));
console.log("slots:", q.slots.join(" "));
console.log("front =", q.front, "rear =", q.rear, "size =", q.size);
const order = [];
for (let i = 0; i < q.size; i++) order.push(q.slots[(q.front + i) % q.cap]);
console.log("in order:", order.join(" "));
```

```text filename:Output
front: 10
rear: 50
full: True
dequeued: 10
dequeued: 20
enqueue 60 → slot 0
enqueue 70 → slot 1
slots: 60 70 30 40 50
front = 2 rear = 2 size = 5
in order: 30 40 50 60 70
```

Time O(1) per operation · Space O(cap)

> [!WARNING] Pitfall
>
> `getRear()` is <strong>not</strong> `slots[rear - 1]`: after a wrap `rear` can be 0, and index `-1` is out of bounds in C++/Java (and silently the last element in Python). Use `(rear - 1 + cap) % cap`. Also note that a dequeued slot is not cleared — printing the raw array shows stale values until they are overwritten.

> [!NOTE] Key point
>
> Dynamic-array queues (`std::deque`, Java `ArrayDeque`, Python `deque`) are circular buffers that double the capacity when full, so they never overflow: amortised O(1) enqueue.

# Problem: implement a stack using queues

> [!TIP] Example
>
> <strong>Input:</strong> `push(10), push(20), push(30), top(), pop(), top()`<br><strong>Output:</strong> `30, 30, 20`

> [!NOTE] Idea
>
> A queue gives you the <em>oldest</em> element; a stack needs the <em>newest</em>. Make `push` expensive: put the new element into an empty auxiliary queue, move everything else behind it, then swap the queues. The front of `q1` is now always the most recently pushed element, so `pop` and `top` are plain O(1) queue operations.

1. <strong>push(x) — version 1</strong>

   Move everything from `q1` to `q2`, enqueue `x` into `q1`, move everything back from `q2` to `q1`. Two full copies per push.

2. <strong>push(x) — optimised</strong>

   Enqueue `x` into `q2`, move everything from `q1` behind it, then <strong>swap</strong> `q1` and `q2`. One copy per push, same effect.

3. <strong>pop() / top()</strong>

   Dequeue / peek the front of `q1` — O(1).

4. <strong>size() / isEmpty()</strong>

   Delegate to `q1`; `isFull()` is always `false` for a dynamic queue.

```text filename:The%20optimised%20push%3A%20the%20new%20element%20goes%20in%20first%2C%20older%20elements%20queue%20behind%20it
push(10):  q2 = [10]                 swap → q1 = [10]        q2 = []
push(20):  q2 = [20] ← move 10 →     q2 = [20 10]   swap → q1 = [20 10]
push(30):  q2 = [30] ← move 20 10 →  q2 = [30 20 10] swap → q1 = [30 20 10]
                                                              ↑ front = top of stack
```

```python filename:Python
from collections import deque

class Stack:
    def __init__(self):
        self.q1 = deque()      # holds the items, newest at the front
        self.q2 = deque()      # auxiliary, empty between operations

    def push(self, x):
        self.q2.append(x)                      # a) x goes in first ...
        while self.q1:                         # b) ... then everything older behind it
            self.q2.append(self.q1.popleft())
        self.q1, self.q2 = self.q2, self.q1    # c) swap: q1 holds the items again

    def pop(self):
        return self.q1.popleft()               # front of q1 is the newest item

    def top(self):
        return self.q1[0]

    def size(self):
        return len(self.q1)

    def is_empty(self):
        return len(self.q1) == 0

s = Stack()
s.push(10)
s.push(20)
s.push(30)
print("top:", s.top())
print("popped:", s.pop())
print("top:", s.top())
print("size:", s.size())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <queue>
#include <utility>
using namespace std;

class Stack {
    queue<int> q1, q2;         // q1 holds the items, newest at the front
public:
    void push(int x) {
        q2.push(x);                                            // a) x goes in first ...
        while (!q1.empty()) { q2.push(q1.front()); q1.pop(); } // b) ... older items behind it
        swap(q1, q2);                                          // c) q1 holds the items again
    }
    int pop() { int x = q1.front(); q1.pop(); return x; }     // front of q1 is the newest item
    int top() const { return q1.front(); }
    int size() const { return (int)q1.size(); }
    bool isEmpty() const { return q1.empty(); }
};

int main() {
    Stack s;
    s.push(10);
    s.push(20);
    s.push(30);
    cout << "top: " << s.top() << "\n";
    cout << "popped: " << s.pop() << "\n";
    cout << "top: " << s.top() << "\n";
    cout << "size: " << s.size() << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Queue;

public class Main {
    static class Stack {
        Queue<Integer> q1 = new ArrayDeque<>();   // holds the items, newest at the front
        Queue<Integer> q2 = new ArrayDeque<>();   // auxiliary
        void push(int x) {
            q2.offer(x);                                   // a) x goes in first ...
            while (!q1.isEmpty()) q2.offer(q1.poll());     // b) ... older items behind it
            Queue<Integer> tmp = q1; q1 = q2; q2 = tmp;    // c) swap
        }
        int pop() { return q1.poll(); }                    // front of q1 is the newest item
        int top() { return q1.peek(); }
        int size() { return q1.size(); }
        boolean isEmpty() { return q1.isEmpty(); }
    }

    public static void main(String[] args) {
        Stack s = new Stack();
        s.push(10);
        s.push(20);
        s.push(30);
        System.out.println("top: " + s.top());
        System.out.println("popped: " + s.pop());
        System.out.println("top: " + s.top());
        System.out.println("size: " + s.size());
    }
}
```

```javascript filename:JavaScript
class Stack {
    constructor() {
        this.q1 = [];          // holds the items, newest at the front
        this.q2 = [];          // auxiliary
    }
    push(x) {
        this.q2.push(x);                                   // a) x goes in first ...
        while (this.q1.length) this.q2.push(this.q1.shift()); // b) ... older items behind it
        [this.q1, this.q2] = [this.q2, this.q1];           // c) swap
    }
    pop() { return this.q1.shift(); }                      // front of q1 is the newest item
    top() { return this.q1[0]; }
    size() { return this.q1.length; }
    isEmpty() { return this.q1.length === 0; }
}

const s = new Stack();
s.push(10);
s.push(20);
s.push(30);
console.log("top:", s.top());
console.log("popped:", s.pop());
console.log("top:", s.top());
console.log("size:", s.size());
```

```text filename:Output
top: 30
popped: 30
top: 20
size: 2
```

Time push O(n), pop/top O(1) · Space O(n)

> [!NOTE] Key point
>
> <strong>One queue is enough</strong>: enqueue `x`, then dequeue-and-re-enqueue the other `size − 1` elements so `x` rotates to the front. Same O(n) push, no auxiliary queue. The mirror design — cheap push, O(n) pop that rotates all but the last element — is also valid; pick the one that matches which operation is more frequent.

# Problem: implement a queue using two stacks

> [!TIP] Example
>
> <strong>Input:</strong> `enqueue(10), enqueue(20), enqueue(30), dequeue(), dequeue(), enqueue(40), front()`<br><strong>Output:</strong> `10, 20, 30`

> [!NOTE] Idea
>
> Two LIFO reversals make a FIFO. Push every new element onto `inbox`. To dequeue, pop from `outbox`; when `outbox` is empty, pour all of `inbox` into it first — popping and pushing reverses the order, so the oldest element ends up on top of `outbox`.

1. <strong>enqueue(x)</strong>

   `inbox.push(x)` — O(1).

2. <strong>dequeue() / front()</strong>

   If `outbox` is empty, move every element from `inbox` to `outbox` (pop one, push the other). Then pop / peek `outbox`.

3. <strong>Why not pour every time?</strong>

   Only pour when `outbox` is empty. Elements already in `outbox` are older than anything in `inbox`, so the order stays correct, and each element is moved at most once.

```python filename:Python
class Queue:
    def __init__(self):
        self.inbox = []        # enqueue pushes here
        self.outbox = []       # dequeue pops from here (reversed = FIFO order)

    def enqueue(self, x):
        self.inbox.append(x)

    def _pour(self):
        if not self.outbox:                    # only when outbox is empty
            while self.inbox:
                self.outbox.append(self.inbox.pop())

    def dequeue(self):
        self._pour()
        return self.outbox.pop()

    def front(self):
        self._pour()
        return self.outbox[-1]

    def size(self):
        return len(self.inbox) + len(self.outbox)

q = Queue()
for x in (10, 20, 30):
    q.enqueue(x)
print("front:", q.front())
print("dequeued:", q.dequeue())
print("dequeued:", q.dequeue())
q.enqueue(40)
print("front:", q.front())
print("size:", q.size())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
using namespace std;

class Queue {
    stack<int> inbox, outbox;  // enqueue pushes to inbox; dequeue pops from outbox
    void pour() {
        if (outbox.empty())                              // only when outbox is empty
            while (!inbox.empty()) { outbox.push(inbox.top()); inbox.pop(); }
    }
public:
    void enqueue(int x) { inbox.push(x); }
    int dequeue() { pour(); int x = outbox.top(); outbox.pop(); return x; }
    int front() { pour(); return outbox.top(); }
    int size() const { return (int)(inbox.size() + outbox.size()); }
};

int main() {
    Queue q;
    for (int x : {10, 20, 30}) q.enqueue(x);
    cout << "front: " << q.front() << "\n";
    cout << "dequeued: " << q.dequeue() << "\n";
    cout << "dequeued: " << q.dequeue() << "\n";
    q.enqueue(40);
    cout << "front: " << q.front() << "\n";
    cout << "size: " << q.size() << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static class Queue {
        Deque<Integer> inbox = new ArrayDeque<>();    // enqueue pushes here
        Deque<Integer> outbox = new ArrayDeque<>();   // dequeue pops from here
        void enqueue(int x) { inbox.push(x); }
        void pour() {
            if (outbox.isEmpty())                     // only when outbox is empty
                while (!inbox.isEmpty()) outbox.push(inbox.pop());
        }
        int dequeue() { pour(); return outbox.pop(); }
        int front() { pour(); return outbox.peek(); }
        int size() { return inbox.size() + outbox.size(); }
    }

    public static void main(String[] args) {
        Queue q = new Queue();
        for (int x : new int[]{10, 20, 30}) q.enqueue(x);
        System.out.println("front: " + q.front());
        System.out.println("dequeued: " + q.dequeue());
        System.out.println("dequeued: " + q.dequeue());
        q.enqueue(40);
        System.out.println("front: " + q.front());
        System.out.println("size: " + q.size());
    }
}
```

```javascript filename:JavaScript
class Queue {
    constructor() {
        this.inbox = [];       // enqueue pushes here
        this.outbox = [];      // dequeue pops from here (reversed = FIFO order)
    }
    enqueue(x) { this.inbox.push(x); }
    pour() {
        if (this.outbox.length === 0)                  // only when outbox is empty
            while (this.inbox.length) this.outbox.push(this.inbox.pop());
    }
    dequeue() { this.pour(); return this.outbox.pop(); }
    front() { this.pour(); return this.outbox[this.outbox.length - 1]; }
    size() { return this.inbox.length + this.outbox.length; }
}

const q = new Queue();
for (const x of [10, 20, 30]) q.enqueue(x);
console.log("front:", q.front());
console.log("dequeued:", q.dequeue());
console.log("dequeued:", q.dequeue());
q.enqueue(40);
console.log("front:", q.front());
console.log("size:", q.size());
```

```text filename:Output
front: 10
dequeued: 10
dequeued: 20
front: 30
size: 2
```

Time amortised O(1) per operation · Space O(n)

> [!WARNING] Pitfall
>
> Pouring `inbox` into `outbox` while `outbox` still has elements breaks the order: the poured (newer) elements would land on top of older ones. Pour <strong>only when </strong><strong>`outbox`</strong><strong> is empty</strong>. Each element is pushed and popped at most twice, which is why the amortised cost is O(1) even though one dequeue can be O(n).

# Interview Q&amp;A

```question
Stack vs queue — when do you use which?

---

A stack (LIFO) when the most recent thing matters: function calls, undo, bracket matching, DFS. A queue (FIFO) when arrival order matters: scheduling, buffering, BFS / level-order traversal. Both have O(1) insert and remove; the only difference is which end you remove from.
```

```question
Why is a circular array better than a plain array for a queue?

---

A plain array either shifts all elements on every dequeue (O(n)) or wastes every slot it has dequeued, failing with a <em>full</em> error while most of the array is empty. Wrapping `front` and `rear` with `% capacity` lets freed slots be reused, so every operation is O(1) and all `capacity` slots are usable.
```

```question
In a circular queue front == rear — is it empty or full?

---

Either, so the indices alone are ambiguous. Two standard fixes: keep a `size` counter (empty when `size == 0`, full when `size == capacity`), or sacrifice one slot and declare the queue full when `(rear + 1) % capacity == front`.
```

```question
Why not use a Python list or a JavaScript array as a queue?

---

`list.pop(0)` and `Array.shift()` remove the first element by shifting every other element left — O(n) per dequeue, O(n²) for a loop that drains the queue. Use `collections.deque` (O(1) `popleft`) in Python; in JavaScript write a small linked-list or two-pointer queue (or keep a `head` index into the array) for anything large, e.g. BFS over a big graph.
```

```question
How do you implement a queue with two stacks, and what is the complexity?

---

Push into `inbox`. To dequeue, if `outbox` is empty pour everything from `inbox` into `outbox` (which reverses it), then pop `outbox`. A single dequeue can cost O(n), but each element is moved at most once, so `n` operations cost O(n) in total — amortised O(1).
```

```question
What is a priority queue, and how does it differ from a queue?

---

A queue serves elements in arrival order; a priority queue serves the element with the highest (or lowest) priority first, regardless of arrival. It is normally built on a binary heap: O(log n) insert and remove-top, O(1) peek. A deque is a different variation — a queue that allows insertion and removal at <em>both</em> ends.
```
