---
id: 7b84cd83-04f5-773d-a977-3e16c4217add
key: topic:dsa-basics/deque
subject: dsa-basics
topic: deque
title: Deque
slug: deque
order: 1
---

A deque (<em>double-ended queue</em>, pronounced “deck”) lets you insert and delete at <strong>both</strong> ends in O(1). It is a stack and a queue in one container, and the workhorse behind sliding-window problems, undo histories and work-stealing schedulers.

> [!INFO]
>
> <strong>Deque</strong> — a linear data structure that generalises the stack and the queue: elements can be added or removed at the front and at the rear, all in O(1). Access to the middle may or may not be supported depending on the implementation.

```text filename:A%20deque%20is%20a%20queue%20whose%20both%20ends%20are%20open%20%E2%80%94%20restrict%20yourself%20to%20one%20pattern%20and%20you%20get%20a%20stack%20or%20a%20queue
insertFront(x) ──▶  ┌────┬────┬────┬────┐  ◀── insertRear(x)
deleteFront()  ◀──  │ 10 │ 20 │ 30 │ 40 │  ──▶ deleteRear()
                    └────┴────┴────┴────┘
                      ↑              ↑
                    front           rear

use only the rear  →  a stack   (push = insertRear, pop = deleteRear)
rear in, front out →  a queue   (enqueue = insertRear, dequeue = deleteFront)
```

# Operations

| Operation | What it does | Time |
| --- | --- | --- |
| `insertFront(x)` | Add `x` before the current front | O(1) |
| `insertRear(x)` | Add `x` after the current rear | O(1) |
| `deleteFront()` | Remove and return the front element | O(1) |
| `deleteRear()` | Remove and return the rear element | O(1) |
| `getFront()` / `getRear()` | Peek at either end | O(1) |
| `isEmpty()` / `isFull()` | Empty check; `isFull()` only for fixed-capacity deques | O(1) |
| `size()` | Number of elements | O(1) |

The same operations have different names in every library — this table is worth memorising, because it is also the stack and queue API of each language:

|  | Python `collections.deque` | C++ `std::deque` | Java `ArrayDeque` (`Deque<T>`) | JavaScript `Array` |
| --- | --- | --- | --- | --- |
| insertFront | `appendleft(x)` | `push_front(x)` | `offerFirst(x)` / `addFirst(x)` / `push(x)` | `unshift(x)` — O(n) |
| insertRear | `append(x)` | `push_back(x)` | `offerLast(x)` / `addLast(x)` / `offer(x)` | `push(x)` |
| deleteFront | `popleft()` | `pop_front()` | `pollFirst()` / `removeFirst()` / `pop()` / `poll()` | `shift()` — O(n) |
| deleteRear | `pop()` | `pop_back()` | `pollLast()` / `removeLast()` | `pop()` |
| getFront / getRear | `d[0]` / `d[-1]` | `front()` / `back()` | `peekFirst()` / `peekLast()` | `a[0]` / `a[a.length - 1]` |

> [!WARNING] Watch out
>
> JavaScript has no built-in deque. `unshift()` and `shift()` re-index the whole array, so they are O(n). For small inputs that is fine; for sliding windows over large arrays, implement a deque yourself (circular array or doubly linked list — both below) or keep two indices into a plain array.

# Where deques are used

> [!NOTE] Stack and queue in one
>
> A deque does everything both do, so one implementation (Python's `deque`, Java's `ArrayDeque`) serves as the standard stack <em>and</em> the standard queue.

> [!NOTE] History of actions
>
> Browser history, undo buffers, “recently used” lists: push new actions at one end, drop the oldest from the other when the history is full (`deque(maxlen=n)` does this automatically).

> [!NOTE] Work-stealing schedulers
>
> Each worker thread keeps its tasks in a deque: it pushes and pops at the rear (LIFO, cache-warm); idle threads <em>steal</em> from the front (the oldest, largest tasks). Used by Java's ForkJoinPool and Go's runtime.

> [!NOTE] Two-level priority queue
>
> Urgent items go to the front, normal items to the rear, always serve the front — a priority queue with exactly two priorities, as in 0-1 BFS on graphs with edge weights 0 and 1.

> [!NOTE] Sliding window maximum / minimum
>
> Maximum of every subarray of size `k` in O(n): the deque keeps candidate indices in decreasing order of value — see <strong>DSA Advanced → Sliding Window</strong>.

> [!NOTE] Palindromes and symmetry checks
>
> Compare the two ends and remove both until the middle is reached — solved below.

# Using the built-in containers

```python filename:Python
from collections import deque

def show(d):
    print(*d)

d = deque()
d.append(10)            # insert at the rear
d.append(20)
d.append(30)
show(d)
d.appendleft(100)       # insert at the front
show(d)
d.pop()                 # delete from the rear
show(d)
d.popleft()             # delete from the front
show(d)
print("front:", d[0], "rear:", d[-1])
```

```cpp filename:C%2B%2B
#include <deque>
#include <iostream>
using namespace std;

void show(const deque<int>& d) {
    for (size_t i = 0; i < d.size(); i++) cout << (i ? " " : "") << d[i];   // deque allows d[i]
    cout << "\n";
}

int main() {
    deque<int> d;
    d.push_back(10);        // insert at the rear
    d.push_back(20);
    d.push_back(30);
    show(d);
    d.push_front(100);      // insert at the front
    show(d);
    d.pop_back();           // delete from the rear
    show(d);
    d.pop_front();          // delete from the front
    show(d);
    cout << "front: " << d.front() << " rear: " << d.back() << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static void show(Deque<Integer> d) {
        StringBuilder sb = new StringBuilder();
        for (int v : d) sb.append(sb.length() == 0 ? "" : " ").append(v);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Deque<Integer> d = new ArrayDeque<>();   // preferred over LinkedList
        d.addLast(10);          // insert at the rear
        d.addLast(20);
        d.addLast(30);
        show(d);
        d.addFirst(100);        // insert at the front
        show(d);
        d.removeLast();         // delete from the rear
        show(d);
        d.removeFirst();        // delete from the front
        show(d);
        System.out.println("front: " + d.peekFirst() + " rear: " + d.peekLast());
    }
}
```

```javascript filename:JavaScript
const show = (d) => console.log(d.join(" "));

const d = [];               // an array used as a deque
d.push(10);                 // insert at the rear
d.push(20);
d.push(30);
show(d);
d.unshift(100);             // insert at the front — O(n) on an array
show(d);
d.pop();                    // delete from the rear
show(d);
d.shift();                  // delete from the front — O(n) on an array
show(d);
console.log("front:", d[0], "rear:", d[d.length - 1]);
```

```text filename:Output
10 20 30
100 10 20 30
100 10 20
10 20
front: 10 rear: 20
```

Python's `deque` also has a handful of list-like extras. They are convenient, but note which of them walk the whole structure (next section).

```python filename:Python
from collections import deque

d = deque([10, 20, 30, 40])
d.insert(2, 15)
print(list(d))          # [10, 20, 15, 30, 40]
print(d.count(10))      # 1
d.remove(10)            # removes the first occurrence
print(list(d))          # [20, 15, 30, 40]
d.extend([50, 60])
print(list(d))          # [20, 15, 30, 40, 50, 60]
d.extendleft([10, 20])
print(list(d))          # [20, 10, 20, 15, 30, 40, 50, 60]   ← appendleft one by one, so the order flips
d.reverse()
print(list(d))          # [60, 50, 40, 30, 15, 20, 10, 20]
```

```python filename:Python
from collections import deque

d = deque([10, 20, 30, 40, 50])
d.rotate(2)             # positive: the last 2 elements move to the front
print(list(d))          # [40, 50, 10, 20, 30]
d.rotate(-2)            # negative: the first 2 elements move to the back
print(list(d))          # [10, 20, 30, 40, 50]
print(d[2])             # 30   ← indexing works, but the middle is O(n)
d[2] = 100
print(list(d))          # [10, 20, 100, 40, 50]
print(d[0], d[-1])      # 10 50

history = deque(maxlen=3)        # bounded: a full deque drops the opposite end
for x in (1, 2, 3, 4):
    history.append(x)
print(list(history))    # [2, 3, 4]   ← 1 fell off the front
```

> [!WARNING] Pitfall
>
> `extendleft([10, 20])` produces `20, 10, …` — it calls `appendleft` for each element in turn, so the sequence appears reversed. Pass `reversed(items)` if you want to keep their order.

# Time complexities and internal working

| Complexity | Python `deque` operations | Why |
| --- | --- | --- |
| O(1) | `append`, `appendleft`, `pop`, `popleft`, `len`, `d[0]`, `d[-1]` | both ends are directly reachable |
| O(n) | `d[i]` in the middle, `count(x)`, `insert(i, x)`, `remove(x)`, `x in d`, `reverse()` | must walk the blocks from one end |
| O(min(k, n − k)) | `rotate(k)` | moves `k` elements one by one, going the shorter way round |
| O(len(l)) | `extend(l)`, `extendleft(l)` | one `append` / `appendleft` per element |

CPython's `deque` is a <strong>doubly linked list of fixed-size blocks</strong> (64 slots each). The ends live in the leftmost and rightmost blocks, so pushing or popping at either end touches one slot and occasionally allocates or frees one block; walking to `d[i]` means hopping `i // 64` blocks, hence O(n) in the middle.

```text filename:Why%20both%20ends%20are%20O(1)%20but%20the%20middle%20is%20not
collections.deque — a doubly linked list of 64-slot blocks

   leftblock               ...                 rightblock
  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
  │ · · · 10 20 30│◀──▶│ 40 50 … … 90  │◀──▶│ 100 110 · · · │
  └───────────────┘    └───────────────┘    └───────────────┘
         ↑ leftindex                             ↑ rightindex

  appendleft / popleft move leftindex   → O(1)
  append / pop move rightindex          → O(1)
  d[i] hops i // 64 blocks              → O(n) in the middle
```

| Library | Internal structure | Both ends | Random access `d[i]` |
| --- | --- | --- | --- |
| Python `collections.deque` | doubly linked list of 64-slot blocks | O(1) | O(n) in the middle, O(1) near the ends |
| C++ `std::deque` | array of pointers to fixed-size chunks (“map of blocks”) | O(1) | O(1) — two lookups |
| Java `ArrayDeque` | circular, growable array (doubles when full) | amortised O(1) | not supported (no `get(i)`) |
| Java `LinkedList` | doubly linked list of nodes | O(1) | O(n) |

> [!NOTE] Key point
>
> `std::deque` is the one standard deque with O(1) indexing, which is why `std::stack` and `std::queue` adapt it by default. Java's `ArrayDeque` is faster and leaner than `LinkedList` for stack/queue work (one array, no per-node objects) but refuses `null` elements.

# Implementing a deque with a doubly linked list

A <strong>singly</strong> linked list gives O(1) at the head and, with a tail pointer, O(1) `insertRear` — but `deleteRear` needs the node <em>before</em> the tail, which only a walk from the head can find: O(n). A <strong>doubly</strong> linked list stores a `prev` pointer in every node, so `tail = tail.prev` is one step and every deque operation is O(1).

```text filename:Each%20node%20knows%20both%20neighbours%2C%20so%20either%20end%20can%20be%20removed%20without%20a%20search
head (front)                                        tail (rear)
 ↓                                                   ↓
┌───┬────┬───┐     ┌───┬────┬───┐     ┌───┬────┬───┐
│ ∅ │ 10 │ ●─┼────▶│ ● │ 20 │ ●─┼────▶│ ● │ 30 │ ∅ │
│   │    │   │◀────┼─● │    │   │◀────┼─● │    │   │
└───┴────┴───┘     └───┴────┴───┘     └───┴────┴───┘
prev value next

deleteRear(): tail = tail.prev; tail.next = ∅         ← O(1) thanks to prev
insertFront(x): node.next = head; head.prev = node; head = node
```

1. <strong>insertFront(x) / insertRear(x)</strong>

   Create a node. If empty, `head = tail = node`. Otherwise link it before `head` (set `node.next`, `head.prev`, `head`) or after `tail` (set `node.prev`, `tail.next`, `tail`).

2. <strong>deleteFront() / deleteRear()</strong>

   Advance `head = head.next` (or `tail = tail.prev`). If the deque became empty set the <em>other</em> pointer to `null` too; otherwise clear the new end's dangling `prev` (or `next`).

3. <strong>Both empty cases matter</strong>

   The original notes did `head = head.next; head.prev = None` without checking — deleting the last element then crashes on `None.prev`. Guard it.

> [!TIP] Example
>
> <strong>Input:</strong> `insertRear 10 20 30; deleteFront; deleteRear; insertFront 100, 1000`<br><strong>Output:</strong> `front/rear: 10/30 → 20/30 → 20/20; final order 1000 100 20`

```python filename:Python
class Node:
    def __init__(self, value):
        self.value = value
        self.prev = None
        self.next = None

class Deque:
    def __init__(self):
        self.head = None       # front
        self.tail = None       # rear
        self.size = 0

    def is_empty(self):
        return self.size == 0

    def insert_front(self, value):
        node = Node(value)
        if self.is_empty():
            self.head = self.tail = node
        else:
            node.next = self.head
            self.head.prev = node
            self.head = node
        self.size += 1

    def insert_rear(self, value):
        node = Node(value)
        if self.is_empty():
            self.head = self.tail = node
        else:
            node.prev = self.tail
            self.tail.next = node
            self.tail = node
        self.size += 1

    def delete_front(self):
        if self.is_empty():
            raise IndexError("deque is empty")
        value = self.head.value
        self.head = self.head.next
        if self.head is None:          # became empty
            self.tail = None
        else:
            self.head.prev = None
        self.size -= 1
        return value

    def delete_rear(self):
        if self.is_empty():
            raise IndexError("deque is empty")
        value = self.tail.value
        self.tail = self.tail.prev     # O(1) thanks to prev
        if self.tail is None:          # became empty
            self.head = None
        else:
            self.tail.next = None
        self.size -= 1
        return value

    def get_front(self):
        return None if self.is_empty() else self.head.value

    def get_rear(self):
        return None if self.is_empty() else self.tail.value

    def display(self):
        node, parts = self.head, []
        while node:
            parts.append(str(node.value))
            node = node.next
        print(" ".join(parts))

d = Deque()
for x in (10, 20, 30):
    d.insert_rear(x)
print("front:", d.get_front(), "rear:", d.get_rear())
d.delete_front()
print("deleteFront → front:", d.get_front(), "rear:", d.get_rear())
d.delete_rear()
print("deleteRear → front:", d.get_front(), "rear:", d.get_rear())
print("size:", d.size, "empty:", d.is_empty())
d.insert_front(100)
d.insert_front(1000)
d.display()
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
using namespace std;

struct Node {
    int value;
    Node* prev;
    Node* next;
    Node(int v) : value(v), prev(nullptr), next(nullptr) {}
};

class Deque {
    Node* head = nullptr;      // front
    Node* tail = nullptr;      // rear
    int count = 0;
public:
    ~Deque() { while (head) deleteFront(); }
    bool isEmpty() const { return count == 0; }
    int size() const { return count; }
    void insertFront(int v) {
        Node* node = new Node(v);
        if (isEmpty()) head = tail = node;
        else { node->next = head; head->prev = node; head = node; }
        count++;
    }
    void insertRear(int v) {
        Node* node = new Node(v);
        if (isEmpty()) head = tail = node;
        else { node->prev = tail; tail->next = node; tail = node; }
        count++;
    }
    int deleteFront() {
        if (isEmpty()) throw runtime_error("deque is empty");
        Node* node = head;
        int v = node->value;
        head = head->next;
        if (!head) tail = nullptr;             // became empty
        else head->prev = nullptr;
        delete node;
        count--;
        return v;
    }
    int deleteRear() {
        if (isEmpty()) throw runtime_error("deque is empty");
        Node* node = tail;
        int v = node->value;
        tail = tail->prev;                     // O(1) thanks to prev
        if (!tail) head = nullptr;             // became empty
        else tail->next = nullptr;
        delete node;
        count--;
        return v;
    }
    int getFront() const { return head->value; }
    int getRear() const { return tail->value; }
    void display() const {
        for (Node* n = head; n; n = n->next) cout << n->value << (n->next ? " " : "");
        cout << "\n";
    }
};

int main() {
    Deque d;
    for (int x : {10, 20, 30}) d.insertRear(x);
    cout << "front: " << d.getFront() << " rear: " << d.getRear() << "\n";
    d.deleteFront();
    cout << "deleteFront → front: " << d.getFront() << " rear: " << d.getRear() << "\n";
    d.deleteRear();
    cout << "deleteRear → front: " << d.getFront() << " rear: " << d.getRear() << "\n";
    cout << "size: " << d.size() << " empty: " << (d.isEmpty() ? "True" : "False") << "\n";
    d.insertFront(100);
    d.insertFront(1000);
    d.display();
}
```

```java filename:Java
public class Main {
    static class Node {
        int value; Node prev, next;
        Node(int v) { value = v; }
    }

    static class Deque {
        Node head, tail;           // front, rear
        int size;
        boolean isEmpty() { return size == 0; }
        void insertFront(int v) {
            Node node = new Node(v);
            if (isEmpty()) head = tail = node;
            else { node.next = head; head.prev = node; head = node; }
            size++;
        }
        void insertRear(int v) {
            Node node = new Node(v);
            if (isEmpty()) head = tail = node;
            else { node.prev = tail; tail.next = node; tail = node; }
            size++;
        }
        int deleteFront() {
            if (isEmpty()) throw new RuntimeException("deque is empty");
            int v = head.value;
            head = head.next;
            if (head == null) tail = null;         // became empty
            else head.prev = null;
            size--;
            return v;
        }
        int deleteRear() {
            if (isEmpty()) throw new RuntimeException("deque is empty");
            int v = tail.value;
            tail = tail.prev;                      // O(1) thanks to prev
            if (tail == null) head = null;         // became empty
            else tail.next = null;
            size--;
            return v;
        }
        Integer getFront() { return isEmpty() ? null : head.value; }
        Integer getRear() { return isEmpty() ? null : tail.value; }
        void display() {
            StringBuilder sb = new StringBuilder();
            for (Node n = head; n != null; n = n.next) sb.append(n.value).append(n.next != null ? " " : "");
            System.out.println(sb);
        }
    }

    public static void main(String[] args) {
        Deque d = new Deque();
        for (int x : new int[]{10, 20, 30}) d.insertRear(x);
        System.out.println("front: " + d.getFront() + " rear: " + d.getRear());
        d.deleteFront();
        System.out.println("deleteFront → front: " + d.getFront() + " rear: " + d.getRear());
        d.deleteRear();
        System.out.println("deleteRear → front: " + d.getFront() + " rear: " + d.getRear());
        System.out.println("size: " + d.size + " empty: " + (d.isEmpty() ? "True" : "False"));
        d.insertFront(100);
        d.insertFront(1000);
        d.display();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(value) { this.value = value; this.prev = null; this.next = null; }
}

class Deque {
    constructor() { this.head = null; this.tail = null; this.size = 0; }   // front, rear
    isEmpty() { return this.size === 0; }
    insertFront(value) {
        const node = new Node(value);
        if (this.isEmpty()) this.head = this.tail = node;
        else { node.next = this.head; this.head.prev = node; this.head = node; }
        this.size++;
    }
    insertRear(value) {
        const node = new Node(value);
        if (this.isEmpty()) this.head = this.tail = node;
        else { node.prev = this.tail; this.tail.next = node; this.tail = node; }
        this.size++;
    }
    deleteFront() {
        if (this.isEmpty()) throw new Error("deque is empty");
        const value = this.head.value;
        this.head = this.head.next;
        if (this.head === null) this.tail = null;      // became empty
        else this.head.prev = null;
        this.size--;
        return value;
    }
    deleteRear() {
        if (this.isEmpty()) throw new Error("deque is empty");
        const value = this.tail.value;
        this.tail = this.tail.prev;                    // O(1) thanks to prev
        if (this.tail === null) this.head = null;      // became empty
        else this.tail.next = null;
        this.size--;
        return value;
    }
    getFront() { return this.isEmpty() ? null : this.head.value; }
    getRear() { return this.isEmpty() ? null : this.tail.value; }
    display() {
        const parts = [];
        for (let n = this.head; n; n = n.next) parts.push(n.value);
        console.log(parts.join(" "));
    }
}

const d = new Deque();
for (const x of [10, 20, 30]) d.insertRear(x);
console.log("front:", d.getFront(), "rear:", d.getRear());
d.deleteFront();
console.log("deleteFront → front:", d.getFront(), "rear:", d.getRear());
d.deleteRear();
console.log("deleteRear → front:", d.getFront(), "rear:", d.getRear());
console.log("size:", d.size, "empty:", d.isEmpty() ? "True" : "False");
d.insertFront(100);
d.insertFront(1000);
d.display();
```

```text filename:Output
front: 10 rear: 30
deleteFront → front: 20 rear: 30
deleteRear → front: 20 rear: 20
size: 1 empty: False
1000 100 20
```

Time O(1) per operation · Space O(n) for n elements

# Implementing a deque with a circular array

The circular-array queue extends naturally: `insertFront` steps `front` <strong>backwards</strong> (wrapping from 0 to `cap − 1`), `insertRear` fills the slot after the rear (wrapping from `cap − 1` to 0). Keeping `front` and `size` is enough — the rear index is always `(front + size − 1) % cap`, and `size` disambiguates empty from full.

```text filename:Both%20ends%20wrap%3B%20the%20physical%20array%20order%20differs%20from%20the%20logical%20order
capacity 5: insertFront(10), insertFront(20), insertFront(30), insertRear(40), insertRear(50)

  index:   0     1     2     3     4
        ┌─────┬─────┬─────┬─────┬─────┐
        │ 40  │ 50  │ 30  │ 20  │ 10  │
        └─────┴─────┴─────┴─────┴─────┘
                       ↑ front = 2        rear = (front + size − 1) % 5 = 1

  insertFront moves front backwards:  0 → 4 (10) → 3 (20) → 2 (30)   wraps to the end
  insertRear fills the slot after rear: 4 → 0 (40) → 1 (50)          wraps to the start
  logical order (front → rear):  30  20  10  40  50
```

> [!TIP] Example
>
> <strong>Input:</strong> `capacity = 5; insertFront 10 20 30; insertRear 40 50; deleteFront; deleteRear`<br><strong>Output:</strong> `order 30 20 10 40 50 → after deletes 20 10 40`

```python filename:Python
class ArrayDeque:
    def __init__(self, capacity):
        self.slots = [None] * capacity
        self.cap = capacity
        self.front = 0        # index of the first element
        self.size = 0         # rear index is derived: (front + size - 1) % cap

    def is_empty(self):
        return self.size == 0

    def is_full(self):
        return self.size == self.cap

    def insert_front(self, value):
        if self.is_full():
            raise OverflowError("deque is full")
        self.front = (self.front - 1 + self.cap) % self.cap   # step back, wrapping to the end
        self.slots[self.front] = value
        self.size += 1

    def insert_rear(self, value):
        if self.is_full():
            raise OverflowError("deque is full")
        self.slots[(self.front + self.size) % self.cap] = value   # next free slot after rear
        self.size += 1

    def delete_front(self):
        if self.is_empty():
            raise IndexError("deque is empty")
        value = self.slots[self.front]
        self.front = (self.front + 1) % self.cap
        self.size -= 1
        return value

    def delete_rear(self):
        if self.is_empty():
            raise IndexError("deque is empty")
        value = self.slots[(self.front + self.size - 1) % self.cap]
        self.size -= 1                                # rear simply moves back by one
        return value

    def get_front(self):
        return self.slots[self.front]

    def get_rear(self):
        return self.slots[(self.front + self.size - 1) % self.cap]

    def in_order(self):
        return [self.slots[(self.front + i) % self.cap] for i in range(self.size)]

d = ArrayDeque(5)
for x in (10, 20, 30):
    d.insert_front(x)
for x in (40, 50):
    d.insert_rear(x)
print("in order:", *d.in_order())
print("slots:", *d.slots)
print("front =", d.front, "size =", d.size)
print("full:", d.is_full())
print("deleteFront →", d.delete_front())
print("deleteRear →", d.delete_rear())
print("in order:", *d.in_order())
print("front:", d.get_front(), "rear:", d.get_rear())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <vector>
using namespace std;

class ArrayDeque {
public:
    vector<int> slots;
    int cap, front = 0, size = 0;    // rear index is derived: (front + size - 1) % cap
    ArrayDeque(int capacity) : slots(capacity, 0), cap(capacity) {}
    bool isEmpty() const { return size == 0; }
    bool isFull() const { return size == cap; }
    void insertFront(int v) {
        if (isFull()) throw runtime_error("deque is full");
        front = (front - 1 + cap) % cap;              // step back, wrapping to the end
        slots[front] = v;
        size++;
    }
    void insertRear(int v) {
        if (isFull()) throw runtime_error("deque is full");
        slots[(front + size) % cap] = v;              // next free slot after rear
        size++;
    }
    int deleteFront() {
        if (isEmpty()) throw runtime_error("deque is empty");
        int v = slots[front];
        front = (front + 1) % cap;
        size--;
        return v;
    }
    int deleteRear() {
        if (isEmpty()) throw runtime_error("deque is empty");
        int v = slots[(front + size - 1) % cap];
        size--;                                       // rear simply moves back by one
        return v;
    }
    int getFront() const { return slots[front]; }
    int getRear() const { return slots[(front + size - 1) % cap]; }
    void printInOrder() const {
        cout << "in order:";
        for (int i = 0; i < size; i++) cout << " " << slots[(front + i) % cap];
        cout << "\n";
    }
};

int main() {
    ArrayDeque d(5);
    for (int x : {10, 20, 30}) d.insertFront(x);
    for (int x : {40, 50}) d.insertRear(x);
    d.printInOrder();
    cout << "slots:";
    for (int v : d.slots) cout << " " << v;
    cout << "\n";
    cout << "front = " << d.front << " size = " << d.size << "\n";
    cout << "full: " << (d.isFull() ? "True" : "False") << "\n";
    cout << "deleteFront → " << d.deleteFront() << "\n";
    cout << "deleteRear → " << d.deleteRear() << "\n";
    d.printInOrder();
    cout << "front: " << d.getFront() << " rear: " << d.getRear() << "\n";
}
```

```java filename:Java
public class Main {
    static class ArrayDeque {
        int[] slots;
        int cap, front = 0, size = 0;    // rear index is derived: (front + size - 1) % cap
        ArrayDeque(int capacity) { slots = new int[capacity]; cap = capacity; }
        boolean isEmpty() { return size == 0; }
        boolean isFull() { return size == cap; }
        void insertFront(int v) {
            if (isFull()) throw new RuntimeException("deque is full");
            front = (front - 1 + cap) % cap;          // step back, wrapping to the end
            slots[front] = v;
            size++;
        }
        void insertRear(int v) {
            if (isFull()) throw new RuntimeException("deque is full");
            slots[(front + size) % cap] = v;          // next free slot after rear
            size++;
        }
        int deleteFront() {
            if (isEmpty()) throw new RuntimeException("deque is empty");
            int v = slots[front];
            front = (front + 1) % cap;
            size--;
            return v;
        }
        int deleteRear() {
            if (isEmpty()) throw new RuntimeException("deque is empty");
            int v = slots[(front + size - 1) % cap];
            size--;                                   // rear simply moves back by one
            return v;
        }
        int getFront() { return slots[front]; }
        int getRear() { return slots[(front + size - 1) % cap]; }
        void printInOrder() {
            StringBuilder sb = new StringBuilder("in order:");
            for (int i = 0; i < size; i++) sb.append(' ').append(slots[(front + i) % cap]);
            System.out.println(sb);
        }
    }

    public static void main(String[] args) {
        ArrayDeque d = new ArrayDeque(5);
        for (int x : new int[]{10, 20, 30}) d.insertFront(x);
        for (int x : new int[]{40, 50}) d.insertRear(x);
        d.printInOrder();
        StringBuilder sb = new StringBuilder("slots:");
        for (int v : d.slots) sb.append(' ').append(v);
        System.out.println(sb);
        System.out.println("front = " + d.front + " size = " + d.size);
        System.out.println("full: " + (d.isFull() ? "True" : "False"));
        System.out.println("deleteFront → " + d.deleteFront());
        System.out.println("deleteRear → " + d.deleteRear());
        d.printInOrder();
        System.out.println("front: " + d.getFront() + " rear: " + d.getRear());
    }
}
```

```javascript filename:JavaScript
class ArrayDeque {
    constructor(capacity) {
        this.slots = new Array(capacity).fill(null);
        this.cap = capacity;
        this.front = 0;       // index of the first element
        this.size = 0;        // rear index is derived: (front + size - 1) % cap
    }
    isEmpty() { return this.size === 0; }
    isFull() { return this.size === this.cap; }
    insertFront(value) {
        if (this.isFull()) throw new Error("deque is full");
        this.front = (this.front - 1 + this.cap) % this.cap;   // step back, wrapping to the end
        this.slots[this.front] = value;
        this.size++;
    }
    insertRear(value) {
        if (this.isFull()) throw new Error("deque is full");
        this.slots[(this.front + this.size) % this.cap] = value;   // next free slot after rear
        this.size++;
    }
    deleteFront() {
        if (this.isEmpty()) throw new Error("deque is empty");
        const value = this.slots[this.front];
        this.front = (this.front + 1) % this.cap;
        this.size--;
        return value;
    }
    deleteRear() {
        if (this.isEmpty()) throw new Error("deque is empty");
        const value = this.slots[(this.front + this.size - 1) % this.cap];
        this.size--;                                  // rear simply moves back by one
        return value;
    }
    getFront() { return this.slots[this.front]; }
    getRear() { return this.slots[(this.front + this.size - 1) % this.cap]; }
    inOrder() {
        const out = [];
        for (let i = 0; i < this.size; i++) out.push(this.slots[(this.front + i) % this.cap]);
        return out;
    }
}

const d = new ArrayDeque(5);
for (const x of [10, 20, 30]) d.insertFront(x);
for (const x of [40, 50]) d.insertRear(x);
console.log("in order:", d.inOrder().join(" "));
console.log("slots:", d.slots.join(" "));
console.log("front =", d.front, "size =", d.size);
console.log("full:", d.isFull() ? "True" : "False");
console.log("deleteFront →", d.deleteFront());
console.log("deleteRear →", d.deleteRear());
console.log("in order:", d.inOrder().join(" "));
console.log("front:", d.getFront(), "rear:", d.getRear());
```

```text filename:Output
in order: 30 20 10 40 50
slots: 40 50 30 20 10
front = 2 size = 5
full: True
deleteFront → 30
deleteRear → 50
in order: 20 10 40
front: 20 rear: 40
```

Time O(1) per operation · Space O(cap)

> [!WARNING] Pitfall
>
> Stepping the front backwards as `front - 1` gives `-1` when `front == 0`. In C++/Java that is an out-of-bounds read; in Python `slots[-1]` silently hits the last slot <em>and</em> leaves `front` negative. Always write `(front - 1 + cap) % cap` — and avoid the `-1`-means-empty sentinel of the original notes, which needs four special cases per operation; a `size` counter needs none.

# Array or linked list?

The original notes list the array version's advantages as “random access, supports all operations, cache friendly, O(1) time”. Here is the full comparison:

|  | Circular array | Doubly linked list |
| --- | --- | --- |
| Insert / delete at both ends | O(1) (amortised O(1) if it grows by doubling) | O(1) |
| Random access `d[i]` | O(1) — `slots[(front + i) % cap]` | O(n) |
| Memory | one contiguous block, no per-element overhead; some unused capacity | two pointers per node, scattered allocations |
| Cache behaviour | friendly — neighbours are adjacent in memory | poor — every step is a pointer chase |
| Capacity | fixed, or resize by doubling (copy O(n), rarely) | unbounded, never copies |
| Used by | Java `ArrayDeque`, C++ `std::deque` (chunked), Python `deque` (blocks) | Java `LinkedList` |

> [!TIP] Do
>
> Default to the array-based deque of your language: it is faster in practice and supports indexing. Reach for a linked list only when you need stable node references (an element must keep its identity while others are added) or truly unbounded growth without copying.

# Problem: check whether a string is a palindrome

> [!TIP] Example
>
> <strong>Input:</strong> `s = "Nurses run"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s = "hello"`<br><strong>Output:</strong> `No`

> [!NOTE] Idea
>
> Load the cleaned characters into a deque, then repeatedly compare and remove the two ends. A palindrome reads the same from both directions, so every pair must match until at most one character is left.

```python filename:Python
from collections import deque

def is_palindrome(s):
    d = deque(ch.lower() for ch in s if ch.isalnum())   # ignore spaces, case, punctuation
    while len(d) > 1:
        if d.popleft() != d.pop():                        # compare both ends, O(1) each
            return False
    return True

for s in ["racecar", "Nurses run", "hello", "No lemon, no melon"]:
    print(s, "→", "Yes" if is_palindrome(s) else "No")
```

```cpp filename:C%2B%2B
#include <cctype>
#include <deque>
#include <iostream>
#include <string>
using namespace std;

bool isPalindrome(const string& s) {
    deque<char> d;
    for (char ch : s)                                         // ignore spaces, case, punctuation
        if (isalnum((unsigned char)ch)) d.push_back((char)tolower((unsigned char)ch));
    while (d.size() > 1) {
        if (d.front() != d.back()) return false;              // compare both ends, O(1) each
        d.pop_front();
        d.pop_back();
    }
    return true;
}

int main() {
    for (string s : {"racecar", "Nurses run", "hello", "No lemon, no melon"})
        cout << s << " → " << (isPalindrome(s) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static boolean isPalindrome(String s) {
        Deque<Character> d = new ArrayDeque<>();
        for (char ch : s.toCharArray())                       // ignore spaces, case, punctuation
            if (Character.isLetterOrDigit(ch)) d.addLast(Character.toLowerCase(ch));
        while (d.size() > 1) {
            char a = d.pollFirst(), b = d.pollLast();         // unbox before comparing!
            if (a != b) return false;                         // compare both ends, O(1) each
        }
        return true;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"racecar", "Nurses run", "hello", "No lemon, no melon"})
            System.out.println(s + " → " + (isPalindrome(s) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isPalindrome(s) {
    const d = [];
    for (const ch of s.toLowerCase())                         // ignore spaces, case, punctuation
        if (/[a-z0-9]/.test(ch)) d.push(ch);
    while (d.length > 1) {
        if (d.shift() !== d.pop()) return false;              // compare both ends (shift is O(n) on arrays)
    }
    return true;
}

for (const s of ["racecar", "Nurses run", "hello", "No lemon, no melon"])
    console.log(s, "→", isPalindrome(s) ? "Yes" : "No");
```

```text filename:Output
racecar → Yes
Nurses run → Yes
hello → No
No lemon, no melon → Yes
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> In Java, `d.pollFirst() != d.pollLast()` compares two `Character` <strong>objects by reference</strong>. It happens to work for ASCII because of the small-value cache, and silently fails beyond it — unbox to `char` (or use `.equals`) first. In JavaScript the array `shift()` makes this O(n²); two indices `i`, `j` walking inwards give the same answer in O(n) with no deque at all.

> [!NOTE] Key point
>
> The flagship deque problem — <strong>maximum of every window of size k</strong> in O(n) — keeps the deque sorted by value with indices, popping from the rear anything smaller than the new element and from the front anything that has left the window. It is worked through in <strong>DSA Advanced → Sliding Window</strong>.

# Interview Q&amp;A

```question
What is a deque, and how does it relate to stacks and queues?

---

A double-ended queue: insert and delete in O(1) at both the front and the rear. Use only one end and it is a stack; insert at the rear and delete at the front and it is a queue. That is why `collections.deque` and `ArrayDeque` are the recommended stack <em>and</em> queue in Python and Java.
```

```question
Why does a deque need a doubly linked list rather than a singly linked one?

---

`deleteRear()` must make the previous node the new tail. In a singly linked list that node is only reachable by walking from the head — O(n). A `prev` pointer makes it `tail = tail.prev`, O(1). Everything else (head operations, tail insert) a singly linked list with a tail pointer can already do in O(1).
```

```question
How does Python's deque give O(1) at both ends, and why is d\[i\] O(n)?

---

It is a doubly linked list of fixed-size blocks (64 slots). The two ends live in the leftmost and rightmost blocks, so pushing or popping there touches one slot. Indexing the middle has to hop block by block from the nearer end — O(n/64), i.e. O(n). Use a list when you need random access, a deque when you need both ends.
```

```question
ArrayDeque or LinkedList in Java?

---

`ArrayDeque` for stacks and queues: a circular growable array, cache-friendly, no per-element node objects, faster in practice. `LinkedList` only when you also need `List` operations (index-based insert/remove via an iterator) or must store `null`, which `ArrayDeque` rejects.
```

```question
How do you implement a deque with a fixed array, and how do you tell empty from full?

---

Treat the array as a ring. `insertFront` moves `front` to `(front − 1 + cap) % cap`; `insertRear` writes at `(front + size) % cap`. Keep a `size` counter: empty when `size == 0`, full when `size == cap`. Without the counter `front` and `rear` coincide in both states and you have to waste one slot to disambiguate.
```

```question
Name a problem where a deque beats both a stack and a queue.

---

Sliding window maximum: for each window of size `k`, the deque holds indices of candidates in decreasing value order. New elements evict smaller ones from the rear (they can never be a maximum again), and indices that fall out of the window are dropped from the front. Each index enters and leaves once — O(n) overall, versus O(nk) naively.
```
