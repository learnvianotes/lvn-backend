---
id: d3209d54-ec11-7a12-bf6a-986f5f9b398e
key: topic:dsa-basics/singly_linked
subject: dsa-basics
topic: singly_linked
title: Linked List
slug: linked-list
order: 1
---

A linked list is a linear collection whose elements are <strong>not</strong> stored next to each other in memory: every node holds a value and a pointer to the next node. Insertion and deletion at a known position are O(1), at the price of O(n) access by index.

> [!INFO]
>
> <strong>Singly linked list</strong> — a sequence of <strong>nodes</strong>, each containing a `data` field and a `next` reference to the following node. The first node is the <strong>head</strong>; the list ends at the node whose `next` is `None`/`null`. Only the head is stored — everything else is reached by following `next` pointers.

```text filename:A%20singly%20linked%20list%20with%20three%20nodes%20%E2%80%94%20only%20the%20head%20reference%20is%20stored%20by%20the%20program
head
 ↓
┌──────┬──────┐    ┌──────┬──────┐    ┌──────┬──────┐
│  10  │  ●───┼───▶│  20  │  ●───┼───▶│  30  │  ∅   │
└──────┴──────┘    └──────┴──────┘    └──────┴──────┘
  data   next        data   next        data   next = None (end of list)
```

# Structure of a node

A node is a tiny object (or struct) with two fields. Nodes are allocated one at a time, so the list grows and shrinks without ever copying or resizing an array. Traversal starts at the head and follows `next` until it becomes `None`.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None             # no next node yet

def show(head):
    parts = []
    curr = head
    while curr is not None:          # traversal: follow next until the end
        parts.append(str(curr.data))
        curr = curr.next
    print(" -> ".join(parts))

def length(head):
    n, curr = 0, head
    while curr:
        n += 1
        curr = curr.next
    return n

head = Node(10)                      # build by hand: 10 -> 20 -> 30
head.next = Node(20)
head.next.next = Node(30)
show(head)
print("length:", length(head))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
    Node(int d) : data(d), next(nullptr) {}   // no next node yet
};

void show(Node* head) {
    for (Node* curr = head; curr; curr = curr->next) {   // traversal: follow next until null
        cout << curr->data;
        if (curr->next) cout << " -> ";
    }
    cout << "\n";
}

int length(Node* head) {
    int n = 0;
    for (Node* curr = head; curr; curr = curr->next) n++;
    return n;
}

int main() {
    Node* head = new Node(10);           // build by hand: 10 -> 20 -> 30
    head->next = new Node(20);
    head->next->next = new Node(30);
    show(head);
    cout << "length: " << length(head) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;              // next stays null until linked
        Node(int d) { data = d; }
    }

    static void show(Node head) {
        StringBuilder sb = new StringBuilder();
        for (Node curr = head; curr != null; curr = curr.next) {   // traversal
            sb.append(curr.data);
            if (curr.next != null) sb.append(" -> ");
        }
        System.out.println(sb);
    }

    static int length(Node head) {
        int n = 0;
        for (Node curr = head; curr != null; curr = curr.next) n++;
        return n;
    }

    public static void main(String[] args) {
        Node head = new Node(10);         // build by hand: 10 -> 20 -> 30
        head.next = new Node(20);
        head.next.next = new Node(30);
        show(head);
        System.out.println("length: " + length(head));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }   // no next node yet
}

function show(head) {
    const parts = [];
    for (let curr = head; curr !== null; curr = curr.next)     // traversal
        parts.push(curr.data);
    console.log(parts.join(" -> "));
}

function length(head) {
    let n = 0;
    for (let curr = head; curr !== null; curr = curr.next) n++;
    return n;
}

const head = new Node(10);               // build by hand: 10 -> 20 -> 30
head.next = new Node(20);
head.next.next = new Node(30);
show(head);
console.log("length:", length(head));
```

```text filename:Output
10 -> 20 -> 30
length: 3
```

Time O(n) traversal · Space O(n) for n nodes

> [!NOTE] Key point
>
> The list has no `size` unless you maintain a counter: `length` walks all nodes in O(n). Real implementations wrap the head in a `LinkedList` class that also stores `size` (and often a `tail`).

# Why — and why not — a linked list

> [!NOTE] Dynamic size
>
> Grows one node at a time; no capacity to guess, no O(n) resize copy.

> [!NOTE] O(1) insert / delete at a known node
>
> Re-link two pointers. An array must shift every later element.

> [!NOTE] No contiguous block needed
>
> Nodes can live anywhere in memory — useful when large arrays cannot be allocated.

> [!NOTE] No random access
>
> `list[i]` means walking `i` nodes: O(n). Binary search is impossible.

> [!NOTE] Extra memory
>
> One pointer per element (8 bytes on 64-bit) — a list of small ints doubles its footprint.

> [!NOTE] Cache unfriendly
>
> Nodes are scattered; each `next` is a potential cache miss, so traversals are slower than over an array of the same size.

Linked lists are the building block of other structures: stacks and queues (O(1) at the ends), hash-table chains, adjacency lists in graphs, and the LRU cache (a doubly linked list plus a hash map).

# Operations and their cost

| Operation | Time | Why |
| --- | --- | --- |
| Insert at beginning | O(1) | New node points at the old head; the head reference moves. No traversal. |
| Insert at end | O(n) — O(1) with a tail pointer | Without a tail you must walk to the last node first. |
| Delete head | O(1) | Head moves to `head.next`. |
| Delete last | O(n) | Need the <em>second-to-last</em> node to clear its `next`; a singly linked list cannot go backwards. |
| Insert / delete after a given node | O(1) | Only pointers of the given node and its neighbour change. |
| Search | O(n) | Sequential scan; nothing better is possible without random access. |
| Access by index | O(n) | Walk `i` links. |

# Insert at the beginning

> [!TIP] Example
>
> <strong>Input:</strong> `list = 20 -> 30, insert 10 at the beginning`<br><strong>Output:</strong> `10 -> 20 -> 30`

> [!NOTE] Idea
>
> Create the node, make it point at the current head, and return it as the new head. No node is visited, so it is O(1) regardless of the list length — the one place where a linked list beats an array outright.

```text filename:Insert%20at%20the%20beginning%3A%20two%20pointer%20assignments
before:   head ──▶ [20] ──▶ [30] ──▶ ∅

step 1:   new = [10]           new.next = head        [10] ──▶ [20] ──▶ [30] ──▶ ∅
step 2:   head = new                                   head ──▶ [10] ──▶ [20] ──▶ [30] ──▶ ∅
```

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def insert_at_beginning(head, data):
    new_node = Node(data)
    new_node.next = head         # new node points at the old head
    return new_node              # it is the new head — caller must store it

def show(head):
    parts = []
    while head:
        parts.append(str(head.data))
        head = head.next
    print(" -> ".join(parts))

head = None
for x in (30, 20, 10):           # insert in reverse to get 10 -> 20 -> 30
    head = insert_at_beginning(head, x)
    show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* insertAtBeginning(Node* head, int data) {
    Node* newNode = new Node(data);
    newNode->next = head;        // new node points at the old head
    return newNode;              // it is the new head — caller must store it
}

void show(Node* head) {
    for (; head; head = head->next) cout << head->data << (head->next ? " -> " : "\n");
}

int main() {
    Node* head = nullptr;
    for (int x : {30, 20, 10}) {     // insert in reverse to get 10 -> 20 -> 30
        head = insertAtBeginning(head, x);
        show(head);
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static Node insertAtBeginning(Node head, int data) {
        Node newNode = new Node(data);
        newNode.next = head;         // new node points at the old head
        return newNode;              // it is the new head — caller must store it
    }

    static void show(Node head) {
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " -> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = null;
        for (int x : new int[]{30, 20, 10}) {   // insert in reverse to get 10 -> 20 -> 30
            head = insertAtBeginning(head, x);
            show(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function insertAtBeginning(head, data) {
    const newNode = new Node(data);
    newNode.next = head;             // new node points at the old head
    return newNode;                  // it is the new head — caller must store it
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.join(" -> "));
}

let head = null;
for (const x of [30, 20, 10]) {      // insert in reverse to get 10 -> 20 -> 30
    head = insertAtBeginning(head, x);
    show(head);
}
```

```text filename:Output
30
20 -> 30
10 -> 20 -> 30
```

Time O(1) · Space O(1)

> [!WARNING] Pitfall
>
> Functions that change the head must <strong>return the new head</strong> (or work on a wrapper object). Writing `insert_at_beginning(head, 10)` without `head = …` leaves the caller pointing at the old second node — the new node is lost.

# Insert at the end

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 20, insert 30 at the end`<br><strong>Output:</strong> `10 -> 20 -> 30`<br><strong>Input:</strong> `list = empty, insert 10`<br><strong>Output:</strong> `10`

> [!NOTE] Idea
>
> Walk to the last node (the one whose `next` is `None`) and hang the new node there. The walk makes it O(n); keeping a `tail` pointer in a wrapper class makes it O(1). The empty list is a special case: the new node simply becomes the head.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def insert_at_end(head, data):
    new_node = Node(data)
    if head is None:                 # empty list: the new node is the head
        return new_node
    current = head
    while current.next is not None:  # O(n) walk to the last node
        current = current.next
    current.next = new_node
    return head                      # head is unchanged

def show(head):
    parts = []
    while head:
        parts.append(str(head.data))
        head = head.next
    print(" -> ".join(parts))

head = None
for x in (10, 20, 30):
    head = insert_at_end(head, x)
    show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* insertAtEnd(Node* head, int data) {
    Node* newNode = new Node(data);
    if (!head) return newNode;           // empty list: the new node is the head
    Node* current = head;
    while (current->next) current = current->next;   // O(n) walk to the last node
    current->next = newNode;
    return head;                         // head is unchanged
}

void show(Node* head) {
    for (; head; head = head->next) cout << head->data << (head->next ? " -> " : "\n");
}

int main() {
    Node* head = nullptr;
    for (int x : {10, 20, 30}) {
        head = insertAtEnd(head, x);
        show(head);
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static Node insertAtEnd(Node head, int data) {
        Node newNode = new Node(data);
        if (head == null) return newNode;    // empty list: the new node is the head
        Node current = head;
        while (current.next != null) current = current.next;   // O(n) walk to the last node
        current.next = newNode;
        return head;                         // head is unchanged
    }

    static void show(Node head) {
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " -> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = null;
        for (int x : new int[]{10, 20, 30}) {
            head = insertAtEnd(head, x);
            show(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function insertAtEnd(head, data) {
    const newNode = new Node(data);
    if (head === null) return newNode;       // empty list: the new node is the head
    let current = head;
    while (current.next !== null) current = current.next;   // O(n) walk to the last node
    current.next = newNode;
    return head;                             // head is unchanged
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.join(" -> "));
}

let head = null;
for (const x of [10, 20, 30]) {
    head = insertAtEnd(head, x);
    show(head);
}
```

```text filename:Output
10
10 -> 20
10 -> 20 -> 30
```

Time O(n) — O(1) with a tail pointer · Space O(1)

> [!NOTE] Key point
>
> Building a list of `n` elements by repeated `insert_at_end` costs O(n²) without a tail pointer. Either keep a tail, or insert at the beginning and reverse once at the end.

# Delete the head

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 20 -> 30`<br><strong>Output:</strong> `20 -> 30`<br><strong>Input:</strong> `list = 10`<br><strong>Output:</strong> `empty`

> [!NOTE] Idea
>
> The second node becomes the head: return `head.next`. In C++ free the old node; in Python, Java and JavaScript the garbage collector reclaims it once nothing refers to it. An empty list stays empty.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def delete_head(head):
    if head is None:
        return None                  # nothing to delete
    return head.next                 # the old head is garbage-collected

def show(head):
    parts = []
    while head:
        parts.append(str(head.data))
        head = head.next
    print(" -> ".join(parts) if parts else "empty")

head = Node(10); head.next = Node(20); head.next.next = Node(30)
show(head)
for _ in range(4):
    head = delete_head(head)
    print("after delete head: ", end="")
    show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* deleteHead(Node* head) {
    if (!head) return nullptr;           // nothing to delete
    Node* next = head->next;
    delete head;                         // free the old head
    return next;
}

void show(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    for (; head; head = head->next) cout << head->data << (head->next ? " -> " : "\n");
}

int main() {
    Node* head = new Node(10); head->next = new Node(20); head->next->next = new Node(30);
    show(head);
    for (int i = 0; i < 4; i++) {
        head = deleteHead(head);
        cout << "after delete head: ";
        show(head);
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static Node deleteHead(Node head) {
        if (head == null) return null;       // nothing to delete
        return head.next;                    // the old head is garbage-collected
    }

    static void show(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " -> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(20); head.next.next = new Node(30);
        show(head);
        for (int i = 0; i < 4; i++) {
            head = deleteHead(head);
            System.out.print("after delete head: ");
            show(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function deleteHead(head) {
    if (head === null) return null;          // nothing to delete
    return head.next;                        // the old head is garbage-collected
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.length ? parts.join(" -> ") : "empty");
}

let head = new Node(10); head.next = new Node(20); head.next.next = new Node(30);
show(head);
for (let i = 0; i < 4; i++) {
    head = deleteHead(head);
    process.stdout.write("after delete head: ");
    show(head);
}
```

```text filename:Output
10 -> 20 -> 30
after delete head: 20 -> 30
after delete head: 30
after delete head: empty
after delete head: empty
```

Time O(1) · Space O(1)

# Delete the last node

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 20 -> 30`<br><strong>Output:</strong> `10 -> 20`<br><strong>Input:</strong> `list = 10`<br><strong>Output:</strong> `empty`

> [!NOTE] Idea
>
> A singly linked list cannot step backwards, so to drop the last node we must stop at the <strong>second-to-last</strong> one (`current.next.next is None`) and clear its `next`. That walk is what makes the operation O(n), while deleting the head is O(1).

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def delete_last(head):
    if head is None or head.next is None:
        return None                          # 0 or 1 node → empty list
    current = head
    while current.next.next is not None:     # stop at the second-to-last node
        current = current.next
    current.next = None
    return head

def show(head):
    parts = []
    while head:
        parts.append(str(head.data))
        head = head.next
    print(" -> ".join(parts) if parts else "empty")

head = Node(10); head.next = Node(20); head.next.next = Node(30)
show(head)
for _ in range(3):
    head = delete_last(head)
    print("after delete last: ", end="")
    show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* deleteLast(Node* head) {
    if (!head || !head->next) { delete head; return nullptr; }   // 0 or 1 node → empty list
    Node* current = head;
    while (current->next->next) current = current->next;        // stop at the second-to-last node
    delete current->next;
    current->next = nullptr;
    return head;
}

void show(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    for (; head; head = head->next) cout << head->data << (head->next ? " -> " : "\n");
}

int main() {
    Node* head = new Node(10); head->next = new Node(20); head->next->next = new Node(30);
    show(head);
    for (int i = 0; i < 3; i++) {
        head = deleteLast(head);
        cout << "after delete last: ";
        show(head);
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static Node deleteLast(Node head) {
        if (head == null || head.next == null) return null;       // 0 or 1 node → empty list
        Node current = head;
        while (current.next.next != null) current = current.next; // stop at the second-to-last node
        current.next = null;
        return head;
    }

    static void show(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " -> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(20); head.next.next = new Node(30);
        show(head);
        for (int i = 0; i < 3; i++) {
            head = deleteLast(head);
            System.out.print("after delete last: ");
            show(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function deleteLast(head) {
    if (head === null || head.next === null) return null;        // 0 or 1 node → empty list
    let current = head;
    while (current.next.next !== null) current = current.next;   // stop at the second-to-last node
    current.next = null;
    return head;
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.length ? parts.join(" -> ") : "empty");
}

let head = new Node(10); head.next = new Node(20); head.next.next = new Node(30);
show(head);
for (let i = 0; i < 3; i++) {
    head = deleteLast(head);
    process.stdout.write("after delete last: ");
    show(head);
}
```

```text filename:Output
10 -> 20 -> 30
after delete last: 10 -> 20
after delete last: 10
after delete last: empty
```

Time O(n) · Space O(1)

# Search in a linked list

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 20 -> 30, target = 20`<br><strong>Output:</strong> `position 2`<br><strong>Input:</strong> `target = 40`<br><strong>Output:</strong> `-1`

> [!NOTE] Idea
>
> Walk from the head comparing each node's data with the target and counting positions (1-indexed). Return the position on a match, `-1` after falling off the end. Without random access, a linear scan is the only option — even on a sorted list.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def search_list(head, target):
    current, position = head, 1
    while current is not None:
        if current.data == target:
            return position
        current = current.next
        position += 1
    return -1                            # fell off the end

def report(head, x):
    pos = search_list(head, x)
    print(f"search {x}:", f"position {pos}" if pos != -1 else -1)

head = Node(10); head.next = Node(20); head.next.next = Node(30)
for x in (20, 10, 40):
    report(head, x)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

int searchList(Node* head, int target) {
    int position = 1;
    for (Node* current = head; current; current = current->next, position++)
        if (current->data == target) return position;
    return -1;                           // fell off the end
}

void report(Node* head, int x) {
    int pos = searchList(head, x);
    cout << "search " << x << ": ";
    if (pos != -1) cout << "position " << pos << "\n"; else cout << "-1\n";
}

int main() {
    Node* head = new Node(10); head->next = new Node(20); head->next->next = new Node(30);
    for (int x : {20, 10, 40}) report(head, x);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static int searchList(Node head, int target) {
        int position = 1;
        for (Node current = head; current != null; current = current.next, position++)
            if (current.data == target) return position;
        return -1;                           // fell off the end
    }

    static void report(Node head, int x) {
        int pos = searchList(head, x);
        System.out.println("search " + x + ": " + (pos != -1 ? "position " + pos : "-1"));
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(20); head.next.next = new Node(30);
        for (int x : new int[]{20, 10, 40}) report(head, x);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function searchList(head, target) {
    let position = 1;
    for (let current = head; current !== null; current = current.next, position++)
        if (current.data === target) return position;
    return -1;                               // fell off the end
}

function report(head, x) {
    const pos = searchList(head, x);
    console.log(`search ${x}:`, pos !== -1 ? `position ${pos}` : -1);
}

const head = new Node(10); head.next = new Node(20); head.next.next = new Node(30);
for (const x of [20, 10, 40]) report(head, x);
```

```text filename:Output
search 20: position 2
search 10: position 1
search 40: -1
```

Time O(n) · Space O(1)

# Array vs linked list

| Operation | Array / dynamic array (contiguous) | Linked list (pointers) |
| --- | --- | --- |
| Access by index | O(1) — address = base + i · size | O(n) — walk `i` links |
| Search (unsorted) | O(n) | O(n) |
| Search (sorted) | O(log n) binary search | O(n) — no random access, binary search impossible |
| Insert / delete at start | O(n) — shift every element | O(1) — re-link the head |
| Insert / delete at end | O(1) amortised (occasional resize copy) | O(n), or O(1) with a tail pointer (delete last stays O(n) for singly linked) |
| Insert / delete in the middle (position known) | O(n) — shift the tail | O(1) — once you hold the previous node |
| Extra memory | None per element; unused capacity in dynamic arrays | One `next` pointer per node |
| Memory layout | Contiguous — cache friendly, prefetchable | Scattered — pointer chasing, cache misses |
| Size | Fixed, or resized by copying | Grows node by node |

> [!TIP] Do
>
> Default to an array / dynamic array: random access and cache locality win most of the time. Reach for a linked list when you need many O(1) insertions or deletions at known nodes (queues, LRU caches, adjacency lists, splicing lists together) or cannot afford resize copies.

# Interview Q&amp;A

```question
Why is inserting at the front O(1) in a linked list but O(n) in an array?

---

An array keeps elements contiguous, so making room at index 0 means moving every existing element one slot right. A linked list has no positions — a new node just points at the old head and becomes the new head; nothing else moves.
```

```question
Why is binary search not possible on a linked list?

---

Binary search needs the middle element in O(1). In a linked list reaching the middle costs O(n/2) pointer hops, so every probe is O(n) and the search becomes O(n) overall — no better than a linear scan.
```

```question
How do you find the middle of a linked list in one pass?

---

Two pointers: `slow` moves one node per step, `fast` two. When `fast` reaches the end, `slow` is at the middle. The same trick (Floyd's algorithm) detects a cycle: if `fast` ever meets `slow`, the list loops.
```

```question
How would you reverse a singly linked list?

---

Iterate with three pointers `prev`, `curr`, `next`: save `next = curr.next`, redirect `curr.next = prev`, then advance `prev = curr`, `curr = next`. When `curr` is `None`, `prev` is the new head. O(n) time, O(1) space.
```

```question
When is a linked list a better choice than a dynamic array?

---

When the workload is dominated by inserts/deletes at the ends or at nodes you already hold (a queue, an LRU cache, merging sorted lists), when element moves are expensive, or when a guaranteed O(1) without occasional resize pauses matters. For index-heavy or cache-sensitive code, arrays win.
```
