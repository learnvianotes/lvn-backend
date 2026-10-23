---
id: 5a903e95-d6d6-74d6-a91d-ebc1ab4a364e
key: topic:dsa-basics/doubly_linked
subject: dsa-basics
topic: doubly_linked
title: Doubly Linked List
slug: doubly-linked-list
order: 1
---

A doubly linked list gives every node a <strong>`prev`</strong> pointer in addition to `next`, so the list can be walked in both directions and any node can be removed in O(1) given only a reference to it. It costs one extra pointer per node and a little more bookkeeping.

> [!INFO]
>
> <strong>Doubly linked list</strong> — a linked list whose nodes hold `data`, `next` (the following node) and `prev` (the preceding node). The head's `prev` and the tail's `next` are `None`. Every link is mirrored: `a.next == b` always implies `b.prev == a`.

```text filename:A%20doubly%20linked%20list%3A%20every%20node%20knows%20both%20its%20neighbours
         head                                                   tail
          ↓                                                       ↓
     ┌────┬──────┬────┐     ┌────┬──────┬────┐     ┌────┬──────┬────┐
∅ ◀──┼ ●  │  10  │ ●──┼────▶│ ●  │  20  │ ●──┼────▶│ ●  │  30  │ ●──┼──▶ ∅
     └────┴──────┴────┘◀────┼─●  │      │    │◀────┼─●  │      │    │
      prev  data  next      └────┴──────┴────┘     └────┴──────┴────┘

None <-> 10 <-> 20 <-> 30 <-> None
```

# Structure of a node and traversal in both directions

Linking two nodes now means setting <strong>two</strong> pointers: `a.next = b` <em>and</em> `b.prev = a`. Forgetting one of them is the classic doubly-linked bug — the list looks fine going forward and breaks going backward. Traversal backwards starts from the last node and follows `prev`.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def show(head):
    parts, curr, last = [], head, None
    while curr is not None:
        parts.append(str(curr.data))
        last = curr                          # remember the tail for the way back
        curr = curr.next
    print("forward:", " <-> ".join(parts))
    parts, curr = [], last
    while curr is not None:                  # walk back along prev
        parts.append(str(curr.data))
        curr = curr.prev
    print("backward:", " <-> ".join(parts))

head = Node(10); temp1 = Node(20); temp2 = Node(30)
head.next = temp1;  temp1.prev = head        # every link is set in both directions
temp1.next = temp2; temp2.prev = temp1
show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

void show(Node* head) {
    Node* last = nullptr;
    cout << "forward:";
    for (Node* curr = head; curr; curr = curr->next) {
        cout << (curr == head ? " " : " <-> ") << curr->data;
        last = curr;                             // remember the tail for the way back
    }
    cout << "\nbackward:";
    for (Node* curr = last; curr; curr = curr->prev)   // walk back along prev
        cout << (curr == last ? " " : " <-> ") << curr->data;
    cout << "\n";
}

int main() {
    Node* head = new Node(10); Node* temp1 = new Node(20); Node* temp2 = new Node(30);
    head->next = temp1;  temp1->prev = head;     // every link is set in both directions
    temp1->next = temp2; temp2->prev = temp1;
    show(head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static void show(Node head) {
        StringBuilder sb = new StringBuilder("forward:");
        Node last = null;
        for (Node curr = head; curr != null; curr = curr.next) {
            sb.append(curr == head ? " " : " <-> ").append(curr.data);
            last = curr;                             // remember the tail for the way back
        }
        System.out.println(sb);
        sb = new StringBuilder("backward:");
        for (Node curr = last; curr != null; curr = curr.prev)   // walk back along prev
            sb.append(curr == last ? " " : " <-> ").append(curr.data);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), temp1 = new Node(20), temp2 = new Node(30);
        head.next = temp1;  temp1.prev = head;       // every link is set in both directions
        temp1.next = temp2; temp2.prev = temp1;
        show(head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function show(head) {
    const parts = [];
    let last = null;
    for (let curr = head; curr !== null; curr = curr.next) {
        parts.push(curr.data);
        last = curr;                                 // remember the tail for the way back
    }
    console.log("forward:", parts.join(" <-> "));
    const back = [];
    for (let curr = last; curr !== null; curr = curr.prev)   // walk back along prev
        back.push(curr.data);
    console.log("backward:", back.join(" <-> "));
}

const head = new Node(10), temp1 = new Node(20), temp2 = new Node(30);
head.next = temp1;  temp1.prev = head;               // every link is set in both directions
temp1.next = temp2; temp2.prev = temp1;
show(head);
```

```text filename:Output
forward: 10 <-> 20 <-> 30
backward: 30 <-> 20 <-> 10
```

Time O(n) traversal · Space O(n) for n nodes

# Advantages and disadvantages

> [!NOTE] Traversal in both directions
>
> Walk forward with `next`, backward with `prev` — browsers' back/forward history, text editor cursors, undo/redo.

> [!NOTE] Delete a node in O(1) given its reference
>
> `node.prev.next = node.next; node.next.prev = node.prev`. A singly linked list would first need an O(n) walk to find the predecessor.

> [!NOTE] Insert / delete before a given node
>
> The predecessor is one pointer away, so inserting <em>before</em> is as cheap as inserting after.

> [!NOTE] O(1) at both ends with a tail
>
> Keeping `tail` makes insert and delete at <strong>both</strong> ends O(1) — the basis of `deque` and the LRU cache.

> [!NOTE] Extra space
>
> A second pointer per node: 16 bytes of links per element on a 64-bit machine.

> [!NOTE] More complex code
>
> Every operation updates up to four pointers and must keep `prev`/`next` consistent; more special cases for the head and tail.

| Operation | Singly linked | Doubly linked | Why the difference |
| --- | --- | --- | --- |
| Insert at beginning | O(1) | O(1) | Both just re-point the head; doubly also sets the old head's `prev`. |
| Insert at end | O(n) / O(1) with tail | O(n) / O(1) with tail | Same walk unless a tail is kept. |
| Delete head | O(1) | O(1) | Doubly also clears the new head's `prev`. |
| Delete last | O(n) even with tail | <strong>O(1) with tail</strong> | The tail's `prev` gives the new last node for free. |
| Delete a given node | O(n) | <strong>O(1)</strong> | The predecessor is `node.prev`; singly must search for it. |
| Insert before a given node | O(n) | <strong>O(1)</strong> | Same reason. |
| Reverse | O(n) | O(n) | Doubly: swap `prev` and `next` in every node. |

# Insert at the beginning

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 <-> 20 <-> 30, insert 5 at the beginning`<br><strong>Output:</strong> `5 <-> 10 <-> 20 <-> 30`

> [!NOTE] Idea
>
> Point the new node's `next` at the old head, point the old head's `prev` back at the new node, and return the new node as head. Two pointer writes — O(1). The empty list needs a guard: there is no old head whose `prev` could be set (the original notes crashed on this case).

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def insert_at_beginning(head, data):
    temp = Node(data)
    temp.next = head                 # new → old head
    if head is not None:
        head.prev = temp             # old head → new (guard the empty list)
    return temp

def show(head):
    parts = []
    while head:
        parts.append(str(head.data)); head = head.next
    print(" <-> ".join(parts))

head = Node(10); t1 = Node(20); t2 = Node(30)
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1
show(head)
head = insert_at_beginning(head, 5); show(head)
head = insert_at_beginning(head, 1); show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

Node* insertAtBeginning(Node* head, int data) {
    Node* temp = new Node(data);
    temp->next = head;               // new → old head
    if (head) head->prev = temp;     // old head → new (guard the empty list)
    return temp;
}

void show(Node* head) {
    for (; head; head = head->next) cout << head->data << (head->next ? " <-> " : "\n");
}

int main() {
    Node* head = new Node(10); Node* t1 = new Node(20); Node* t2 = new Node(30);
    head->next = t1; t1->prev = head; t1->next = t2; t2->prev = t1;
    show(head);
    head = insertAtBeginning(head, 5); show(head);
    head = insertAtBeginning(head, 1); show(head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static Node insertAtBeginning(Node head, int data) {
        Node temp = new Node(data);
        temp.next = head;                    // new → old head
        if (head != null) head.prev = temp;  // old head → new (guard the empty list)
        return temp;
    }

    static void show(Node head) {
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " <-> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), t1 = new Node(20), t2 = new Node(30);
        head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
        show(head);
        head = insertAtBeginning(head, 5); show(head);
        head = insertAtBeginning(head, 1); show(head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function insertAtBeginning(head, data) {
    const temp = new Node(data);
    temp.next = head;                        // new → old head
    if (head !== null) head.prev = temp;     // old head → new (guard the empty list)
    return temp;
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.join(" <-> "));
}

let head = new Node(10), t1 = new Node(20), t2 = new Node(30);
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
show(head);
head = insertAtBeginning(head, 5); show(head);
head = insertAtBeginning(head, 1); show(head);
```

```text filename:Output
10 <-> 20 <-> 30
5 <-> 10 <-> 20 <-> 30
1 <-> 5 <-> 10 <-> 20 <-> 30
```

Time O(1) · Space O(1)

# Insert at the end

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 <-> 20 <-> 30, insert 40 at the end`<br><strong>Output:</strong> `10 <-> 20 <-> 30 <-> 40`<br><strong>Input:</strong> `list = empty, insert 40`<br><strong>Output:</strong> `40`

> [!NOTE] Idea
>
> Walk to the last node, link it forward to the new node and link the new node back with `prev`. O(n) because of the walk; a class that stores `tail` does the same two writes in O(1).

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def insert_end(head, x):
    temp = Node(x)
    if head is None:
        return temp                      # empty list: new node is the head
    curr = head
    while curr.next is not None:         # O(n) walk to the last node
        curr = curr.next
    curr.next = temp                     # last → new
    temp.prev = curr                     # new → last
    return head

def show(head):
    parts = []
    while head:
        parts.append(str(head.data)); head = head.next
    print(" <-> ".join(parts))

head = Node(10); t1 = Node(20); t2 = Node(30)
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1
head = insert_end(head, 40); show(head)
empty = insert_end(None, 40); show(empty)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

Node* insertEnd(Node* head, int x) {
    Node* temp = new Node(x);
    if (!head) return temp;                  // empty list: new node is the head
    Node* curr = head;
    while (curr->next) curr = curr->next;    // O(n) walk to the last node
    curr->next = temp;                       // last → new
    temp->prev = curr;                       // new → last
    return head;
}

void show(Node* head) {
    for (; head; head = head->next) cout << head->data << (head->next ? " <-> " : "\n");
}

int main() {
    Node* head = new Node(10); Node* t1 = new Node(20); Node* t2 = new Node(30);
    head->next = t1; t1->prev = head; t1->next = t2; t2->prev = t1;
    head = insertEnd(head, 40); show(head);
    Node* empty = insertEnd(nullptr, 40); show(empty);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static Node insertEnd(Node head, int x) {
        Node temp = new Node(x);
        if (head == null) return temp;               // empty list: new node is the head
        Node curr = head;
        while (curr.next != null) curr = curr.next;  // O(n) walk to the last node
        curr.next = temp;                            // last → new
        temp.prev = curr;                            // new → last
        return head;
    }

    static void show(Node head) {
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " <-> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), t1 = new Node(20), t2 = new Node(30);
        head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
        head = insertEnd(head, 40); show(head);
        Node empty = insertEnd(null, 40); show(empty);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function insertEnd(head, x) {
    const temp = new Node(x);
    if (head === null) return temp;                  // empty list: new node is the head
    let curr = head;
    while (curr.next !== null) curr = curr.next;     // O(n) walk to the last node
    curr.next = temp;                                // last → new
    temp.prev = curr;                                // new → last
    return head;
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.join(" <-> "));
}

let head = new Node(10), t1 = new Node(20), t2 = new Node(30);
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
head = insertEnd(head, 40); show(head);
const empty = insertEnd(null, 40); show(empty);
```

```text filename:Output
10 <-> 20 <-> 30 <-> 40
40
```

Time O(n) — O(1) with a tail pointer · Space O(1)

# Delete the head

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 <-> 20 <-> 30`<br><strong>Output:</strong> `20 <-> 30`<br><strong>Input:</strong> `list = 10`<br><strong>Output:</strong> `empty`

> [!NOTE] Idea
>
> Move the head to the second node and clear its `prev` — without that step the new head would still point back at a node that is no longer in the list. A one-node list becomes empty.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def delete_head(head):
    if head is None or head.next is None:
        return None                      # 0 or 1 node → empty
    head = head.next
    head.prev = None                     # the new head has no predecessor
    return head

def show(head):
    parts = []
    while head:
        parts.append(str(head.data)); head = head.next
    print(" <-> ".join(parts) if parts else "empty")

head = Node(10); t1 = Node(20); t2 = Node(30)
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1
for _ in range(3):
    head = delete_head(head)
    print("after delete head: ", end=""); show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

Node* deleteHead(Node* head) {
    if (!head) return nullptr;
    if (!head->next) { delete head; return nullptr; }   // 1 node → empty
    Node* newHead = head->next;
    newHead->prev = nullptr;                 // the new head has no predecessor
    delete head;
    return newHead;
}

void show(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    for (; head; head = head->next) cout << head->data << (head->next ? " <-> " : "\n");
}

int main() {
    Node* head = new Node(10); Node* t1 = new Node(20); Node* t2 = new Node(30);
    head->next = t1; t1->prev = head; t1->next = t2; t2->prev = t1;
    for (int i = 0; i < 3; i++) {
        head = deleteHead(head);
        cout << "after delete head: "; show(head);
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static Node deleteHead(Node head) {
        if (head == null || head.next == null) return null;   // 0 or 1 node → empty
        head = head.next;
        head.prev = null;                        // the new head has no predecessor
        return head;
    }

    static void show(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " <-> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), t1 = new Node(20), t2 = new Node(30);
        head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
        for (int i = 0; i < 3; i++) {
            head = deleteHead(head);
            System.out.print("after delete head: "); show(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function deleteHead(head) {
    if (head === null || head.next === null) return null;    // 0 or 1 node → empty
    head = head.next;
    head.prev = null;                            // the new head has no predecessor
    return head;
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.length ? parts.join(" <-> ") : "empty");
}

let head = new Node(10), t1 = new Node(20), t2 = new Node(30);
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
for (let i = 0; i < 3; i++) {
    head = deleteHead(head);
    process.stdout.write("after delete head: "); show(head);
}
```

```text filename:Output
after delete head: 20 <-> 30
after delete head: 30
after delete head: empty
```

Time O(1) · Space O(1)

# Delete the last node

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 <-> 20 <-> 30`<br><strong>Output:</strong> `10 <-> 20`<br><strong>Input:</strong> `list = 10`<br><strong>Output:</strong> `empty`

> [!NOTE] Idea
>
> Walk to the last node and cut it off via `last.prev.next = None`. Thanks to `prev` the predecessor is one hop away; the only O(n) part is reaching the last node, which disappears when a `tail` pointer is kept — the operation a singly linked list cannot do in O(1) even with a tail.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def delete_last(head):
    if head is None or head.next is None:
        return None                      # 0 or 1 node → empty
    curr = head
    while curr.next is not None:         # walk to the last node (O(1) with a tail pointer)
        curr = curr.next
    curr.prev.next = None                # predecessor is one hop away via prev
    return head

def show(head):
    parts = []
    while head:
        parts.append(str(head.data)); head = head.next
    print(" <-> ".join(parts) if parts else "empty")

head = Node(10); t1 = Node(20); t2 = Node(30)
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1
for _ in range(3):
    head = delete_last(head)
    print("after delete last: ", end=""); show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

Node* deleteLast(Node* head) {
    if (!head) return nullptr;
    if (!head->next) { delete head; return nullptr; }   // 1 node → empty
    Node* curr = head;
    while (curr->next) curr = curr->next;    // walk to the last node (O(1) with a tail pointer)
    curr->prev->next = nullptr;              // predecessor is one hop away via prev
    delete curr;
    return head;
}

void show(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    for (; head; head = head->next) cout << head->data << (head->next ? " <-> " : "\n");
}

int main() {
    Node* head = new Node(10); Node* t1 = new Node(20); Node* t2 = new Node(30);
    head->next = t1; t1->prev = head; t1->next = t2; t2->prev = t1;
    for (int i = 0; i < 3; i++) {
        head = deleteLast(head);
        cout << "after delete last: "; show(head);
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static Node deleteLast(Node head) {
        if (head == null || head.next == null) return null;   // 0 or 1 node → empty
        Node curr = head;
        while (curr.next != null) curr = curr.next;   // walk to the last node (O(1) with a tail pointer)
        curr.prev.next = null;                        // predecessor is one hop away via prev
        return head;
    }

    static void show(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " <-> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), t1 = new Node(20), t2 = new Node(30);
        head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
        for (int i = 0; i < 3; i++) {
            head = deleteLast(head);
            System.out.print("after delete last: "); show(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function deleteLast(head) {
    if (head === null || head.next === null) return null;    // 0 or 1 node → empty
    let curr = head;
    while (curr.next !== null) curr = curr.next;     // walk to the last node (O(1) with a tail pointer)
    curr.prev.next = null;                           // predecessor is one hop away via prev
    return head;
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.length ? parts.join(" <-> ") : "empty");
}

let head = new Node(10), t1 = new Node(20), t2 = new Node(30);
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
for (let i = 0; i < 3; i++) {
    head = deleteLast(head);
    process.stdout.write("after delete last: "); show(head);
}
```

```text filename:Output
after delete last: 10 <-> 20
after delete last: 10
after delete last: empty
```

Time O(n) — O(1) with a tail pointer · Space O(1)

# Delete a node given its reference

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 <-> 20 <-> 30, node = the node holding 20`<br><strong>Output:</strong> `10 <-> 30`

> [!NOTE] Idea
>
> This is the operation that justifies the extra pointer. With `node.prev` and `node.next` both known, unlink in O(1): the predecessor's `next` skips to the successor and the successor's `prev` skips back to the predecessor. Guard the ends: if `node` is the head there is no predecessor (the head moves), if it is the tail there is no successor.

```text filename:Deleting%20a%20node%20in%20O(1)%3A%20two%20pointer%20writes%20on%20its%20neighbours
before:   [10] ◀──▶ [20] ◀──▶ [30]
                    node

node.prev.next = node.next     [10] ───────▶ [30]       (10's next skips 20)
node.next.prev = node.prev     [10] ◀─────── [30]       (30's prev skips 20)

after:    [10] ◀──▶ [30]
```

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def delete_node(head, node):
    if node.prev is not None:
        node.prev.next = node.next       # predecessor skips over node
    else:
        head = node.next                 # node was the head
    if node.next is not None:
        node.next.prev = node.prev       # successor skips back over node
    return head

def show(head):
    parts = []
    while head:
        parts.append(str(head.data)); head = head.next
    print(" <-> ".join(parts) if parts else "empty")

head = Node(10); t1 = Node(20); t2 = Node(30)
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1
show(head)
head = delete_node(head, t1); print("delete node 20: ", end=""); show(head)
head = delete_node(head, head); print("delete node 10 (head): ", end=""); show(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

Node* deleteNode(Node* head, Node* node) {
    if (node->prev) node->prev->next = node->next;   // predecessor skips over node
    else head = node->next;                          // node was the head
    if (node->next) node->next->prev = node->prev;   // successor skips back over node
    delete node;
    return head;
}

void show(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    for (; head; head = head->next) cout << head->data << (head->next ? " <-> " : "\n");
}

int main() {
    Node* head = new Node(10); Node* t1 = new Node(20); Node* t2 = new Node(30);
    head->next = t1; t1->prev = head; t1->next = t2; t2->prev = t1;
    show(head);
    head = deleteNode(head, t1); cout << "delete node 20: "; show(head);
    head = deleteNode(head, head); cout << "delete node 10 (head): "; show(head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static Node deleteNode(Node head, Node node) {
        if (node.prev != null) node.prev.next = node.next;   // predecessor skips over node
        else head = node.next;                               // node was the head
        if (node.next != null) node.next.prev = node.prev;   // successor skips back over node
        return head;
    }

    static void show(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder();
        for (; head != null; head = head.next) sb.append(head.data).append(head.next != null ? " <-> " : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), t1 = new Node(20), t2 = new Node(30);
        head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
        show(head);
        head = deleteNode(head, t1); System.out.print("delete node 20: "); show(head);
        head = deleteNode(head, head); System.out.print("delete node 10 (head): "); show(head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function deleteNode(head, node) {
    if (node.prev !== null) node.prev.next = node.next;   // predecessor skips over node
    else head = node.next;                                // node was the head
    if (node.next !== null) node.next.prev = node.prev;   // successor skips back over node
    return head;
}

function show(head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(parts.length ? parts.join(" <-> ") : "empty");
}

let head = new Node(10), t1 = new Node(20), t2 = new Node(30);
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
show(head);
head = deleteNode(head, t1); process.stdout.write("delete node 20: "); show(head);
head = deleteNode(head, head); process.stdout.write("delete node 10 (head): "); show(head);
```

```text filename:Output
10 <-> 20 <-> 30
delete node 20: 10 <-> 30
delete node 10 (head): 30
```

Time O(1) · Space O(1)

> [!NOTE] Key point
>
> This is exactly how an <strong>LRU cache</strong> evicts and promotes entries: a hash map gives the node for a key in O(1), and the doubly linked list moves that node to the front in O(1). Neither structure alone can do both.

# Reverse a doubly linked list

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 <-> 20 <-> 30`<br><strong>Output:</strong> `30 <-> 20 <-> 10`

> [!NOTE] Idea
>
> Reversing means every node's `next` becomes its `prev` and vice versa — so <strong>swap the two pointers in each node</strong>. After the swap, the <em>old</em> `next` is reachable as `curr.prev`, which is how the loop advances. The last node visited is the new head.

1. <strong>Walk the list</strong>

   `curr = head`, remembering the node just processed in `prev`.

2. <strong>Swap in place</strong>

   `curr.next, curr.prev = curr.prev, curr.next`.

3. <strong>Advance</strong>

   `curr = curr.prev` — that field now holds the old `next`.

4. <strong>Finish</strong>

   When `curr` is `None`, `prev` is the last node processed: the new head.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

def reverse_dll(head):
    prev, curr = None, head
    while curr is not None:
        prev = curr
        curr.next, curr.prev = curr.prev, curr.next   # swap the two links
        curr = curr.prev                              # old next now lives in prev
    return prev                                       # last node processed = new head

def show(label, head):
    parts = []
    while head:
        parts.append(str(head.data)); head = head.next
    print(label + ":", " <-> ".join(parts))

head = Node(10); t1 = Node(20); t2 = Node(30)
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1
show("forward", head)
head = reverse_dll(head); show("reversed", head)
head = reverse_dll(head); show("back again", head)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
using namespace std;

struct Node {
    int data; Node* prev; Node* next;
    Node(int d) : data(d), prev(nullptr), next(nullptr) {}
};

Node* reverseDLL(Node* head) {
    Node* prev = nullptr;
    for (Node* curr = head; curr; curr = curr->prev) {   // after the swap, prev holds the old next
        prev = curr;
        swap(curr->next, curr->prev);                      // swap the two links
    }
    return prev;                                           // last node processed = new head
}

void show(const char* label, Node* head) {
    cout << label << ":";
    for (; head; head = head->next) cout << " " << head->data << (head->next ? " <->" : "");
    cout << "\n";
}

int main() {
    Node* head = new Node(10); Node* t1 = new Node(20); Node* t2 = new Node(30);
    head->next = t1; t1->prev = head; t1->next = t2; t2->prev = t1;
    show("forward", head);
    head = reverseDLL(head); show("reversed", head);
    head = reverseDLL(head); show("back again", head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node prev, next;
        Node(int d) { data = d; }
    }

    static Node reverseDLL(Node head) {
        Node prev = null;
        for (Node curr = head; curr != null; curr = curr.prev) {   // after the swap, prev holds the old next
            prev = curr;
            Node t = curr.next; curr.next = curr.prev; curr.prev = t;   // swap the two links
        }
        return prev;                                               // last node processed = new head
    }

    static void show(String label, Node head) {
        StringBuilder sb = new StringBuilder(label + ":");
        for (; head != null; head = head.next) sb.append(" ").append(head.data).append(head.next != null ? " <->" : "");
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node head = new Node(10), t1 = new Node(20), t2 = new Node(30);
        head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
        show("forward", head);
        head = reverseDLL(head); show("reversed", head);
        head = reverseDLL(head); show("back again", head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.prev = null; this.next = null; }
}

function reverseDLL(head) {
    let prev = null;
    for (let curr = head; curr !== null; curr = curr.prev) {   // after the swap, prev holds the old next
        prev = curr;
        [curr.next, curr.prev] = [curr.prev, curr.next];        // swap the two links
    }
    return prev;                                                // last node processed = new head
}

function show(label, head) {
    const parts = [];
    for (; head !== null; head = head.next) parts.push(head.data);
    console.log(label + ":", parts.join(" <-> "));
}

let head = new Node(10), t1 = new Node(20), t2 = new Node(30);
head.next = t1; t1.prev = head; t1.next = t2; t2.prev = t1;
show("forward", head);
head = reverseDLL(head); show("reversed", head);
head = reverseDLL(head); show("back again", head);
```

```text filename:Output
forward: 10 <-> 20 <-> 30
reversed: 30 <-> 20 <-> 10
back again: 10 <-> 20 <-> 30
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> Advancing with `curr = curr.next` <em>after</em> the swap walks backwards into the part already reversed and loops forever (or stops after one node). The old `next` is in `curr.prev` once the swap has happened.

# Interview Q&amp;A

```question
What does the extra prev pointer buy you?

---

O(1) deletion of a node you hold a reference to, O(1) insertion <em>before</em> a node, O(1) removal from the tail (with a tail pointer) and backward traversal. The price is one more pointer per node and twice as many links to keep consistent.
```

```question
How does an LRU cache use a doubly linked list?

---

Entries are nodes ordered from most to least recently used; a hash map points from each key to its node. On access, the node is unlinked in O(1) (possible only because of `prev`) and re-inserted at the front. On eviction the tail node is removed in O(1). All operations are O(1).
```

```question
Singly vs doubly linked list — how do you choose?

---

Singly when you only move forward and operate at the head (stacks, hash chains, adjacency lists) — it is smaller and simpler. Doubly when you need deletions in the middle by reference, both-end operations (deques) or backward iteration. Java's `LinkedList` and C++ `std::list` are doubly linked; `std::forward_list` is singly linked.
```

```question
How would you reverse a doubly linked list?

---

Swap `next` and `prev` in every node and return the last node visited. One pass, no extra memory. Because the old `next` ends up in `prev`, the loop advances with `curr = curr.prev`.
```

```question
What is an XOR linked list?

---

A memory-saving trick: each node stores `prev XOR next` in a single field. Walking forward from a known predecessor, `next = stored XOR prev`. It halves the pointer overhead but defeats garbage collectors and makes the code fragile — an interview curiosity rather than a production structure.
```
