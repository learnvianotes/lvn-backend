---
id: ff7fcd47-1dc4-726e-a6a4-c5f556ff5ad6
key: topic:dsa-basics/circular_linked
subject: dsa-basics
topic: circular_linked
title: Circular Linked List
slug: circular-linked-list
order: 1
---

A circular linked list is a singly linked list whose <strong>last node points back to the head</strong> instead of to `None`. There is no end, so the list can be traversed from any node, and keeping a single pointer gives O(1) access to both the first and the last element.

> [!INFO]
>
> <strong>Circular linked list</strong> — a linked list in which the `next` of the last node refers to the first node. A one-node list points to itself. Traversal stops when we return to the node where we started, not when `next` is `None` — because it never is.

```text filename:10%20%E2%86%92%205%20%E2%86%92%2020%20%E2%86%92%2015%20%E2%86%92%20back%20to%2010
head
 ↓
┌──────┬────┐    ┌──────┬────┐    ┌──────┬────┐    ┌──────┬────┐
│  10  │ ●──┼───▶│   5  │ ●──┼───▶│  20  │ ●──┼───▶│  15  │ ●──┼──┐
└──────┴────┘    └──────┴────┘    └──────┴────┘    └──────┴────┘  │
  ▲                                                               │
  └───────────────────────────────────────────────────────────────┘
                the last node links back to the head
```

# Building and traversing

The nodes are the same as in a singly linked list; only the last link differs. Traversal must <strong>stop when it comes back to the head</strong>, so the loop prints the head first and then walks until `curr == head` again. A `while curr.next != head` loop (as in the original notes) also works but needs the last node printed separately.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def print_circular(head):
    if head is None:
        print("empty")
        return
    parts = [str(head.data)]
    curr = head.next
    while curr != head:              # stop when we are back at the start
        parts.append(str(curr.data))
        curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10)
head.next = Node(5)
head.next.next = Node(20)
head.next.next.next = Node(15)
head.next.next.next.next = head      # close the circle
print_circular(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

void printCircular(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    cout << head->data;
    for (Node* curr = head->next; curr != head; curr = curr->next)   // stop when back at the start
        cout << " -> " << curr->data;
    cout << " -> (back to " << head->data << ")\n";
}

int main() {
    Node* head = new Node(10);
    head->next = new Node(5);
    head->next->next = new Node(20);
    head->next->next->next = new Node(15);
    head->next->next->next->next = head;    // close the circle
    printCircular(head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static void printCircular(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder().append(head.data);
        for (Node curr = head.next; curr != head; curr = curr.next)   // stop when back at the start
            sb.append(" -> ").append(curr.data);
        System.out.println(sb + " -> (back to " + head.data + ")");
    }

    public static void main(String[] args) {
        Node head = new Node(10);
        head.next = new Node(5);
        head.next.next = new Node(20);
        head.next.next.next = new Node(15);
        head.next.next.next.next = head;    // close the circle
        printCircular(head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function printCircular(head) {
    if (head === null) { console.log("empty"); return; }
    const parts = [head.data];
    for (let curr = head.next; curr !== head; curr = curr.next)   // stop when back at the start
        parts.push(curr.data);
    console.log(parts.join(" -> "), `-> (back to ${head.data})`);
}

const head = new Node(10);
head.next = new Node(5);
head.next.next = new Node(20);
head.next.next.next = new Node(15);
head.next.next.next.next = head;        // close the circle
printCircular(head);
```

```text filename:Output
10 -> 5 -> 20 -> 15 -> (back to 10)
```

Time O(n) traversal · Space O(1)

> [!WARNING] Pitfall
>
> A `while curr is not None` loop never terminates on a circular list. Every traversal must remember where it started and stop there.

# Advantages and disadvantages

> [!NOTE] Traverse from any node
>
> Starting anywhere, following `next` visits every node — no need to find the head first.

> [!NOTE] Round-robin scheduling
>
> The OS gives each process a time slice and moves to `next`; after the last process comes the first again. Also: multiplayer turns, circular buffers, music playlists on repeat.

> [!NOTE] O(1) at both ends with one pointer
>
> Keep a reference to the <strong>tail</strong>: the head is `tail.next`, so insert at the beginning, insert at the end and delete the head are all O(1).

> [!NOTE] More complex code
>
> Every operation must handle the empty list, the one-node list (which points at itself) and the wrap-around; an off-by-one gives an infinite loop instead of a crash.

| Operation (holding `head` only) | Naive | Efficient trick | Holding `tail` instead |
| --- | --- | --- | --- |
| Insert at beginning | O(n): walk to the last node to fix its `next` | O(1): insert <em>after</em> head and swap data | O(1) |
| Insert at end | O(n): walk to the last node | O(1): same trick, return the new node as head | O(1) |
| Delete head | O(n): walk to the last node to re-point it | O(1): copy `head.next` into head and unlink `head.next` | O(1) |
| Delete k-th node | O(k) | — | O(k) |
| Search | O(n) | — | O(n) |

# Insert at the beginning

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 5 -> 20 -> 15 (circular), insert 25 at the beginning`<br><strong>Output:</strong> `25 -> 10 -> 5 -> 20 -> 15 -> (back to 25)`

<strong>Naive, O(n).</strong> The last node must point at the new head, and the only way to reach the last node is to walk the whole circle.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def insert_beginning_naive(head, x):
    temp = Node(x)
    if head is None:
        temp.next = temp               # one node points at itself
        return temp
    curr = head
    while curr.next != head:           # O(n) walk to the last node
        curr = curr.next
    curr.next = temp                   # last node → new node
    temp.next = head                   # new node → old head
    return temp

def print_circular(head):
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
head = insert_beginning_naive(head, 25)
print_circular(head)
```

```text filename:Output
25 -> 10 -> 5 -> 20 -> 15 -> (back to 25)
```

Time O(n) · Space O(1)

> [!NOTE] Idea
>
> <strong>Efficient, O(1).</strong> Insert the new node <em>right after</em> the head (two pointer changes — no walk) and then <strong>swap the data</strong> of the head and the new node. The head node now carries the new value and the old head value sits in second position: exactly the result of inserting at the front. The head reference does not even change.

```text filename:Insert%20at%20the%20beginning%20in%20O(1)%3A%20insert%20after%20the%20head%2C%20then%20swap%20the%20two%20values
before:          head ──▶ [10] ──▶ [5] ──▶ [20] ──▶ [15] ──▶ back to 10
insert after head:   head ──▶ [10] ──▶ [25] ──▶ [5] ──▶ [20] ──▶ [15] ──▶ back to 10
swap data:           head ──▶ [25] ──▶ [10] ──▶ [5] ──▶ [20] ──▶ [15] ──▶ back to 25
```

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def insert_beginning(head, x):
    temp = Node(x)
    if head is None:
        temp.next = temp                             # one node points at itself
        return temp
    temp.next = head.next                            # insert temp right after head
    head.next = temp
    head.data, temp.data = temp.data, head.data      # swap values: head now holds x
    return head

def print_circular(head):
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
head = insert_beginning(head, 25); print_circular(head)
head = insert_beginning(head, 30); print_circular(head)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* insertBeginning(Node* head, int x) {
    Node* temp = new Node(x);
    if (!head) { temp->next = temp; return temp; }   // one node points at itself
    temp->next = head->next;                         // insert temp right after head
    head->next = temp;
    swap(head->data, temp->data);                    // swap values: head now holds x
    return head;
}

void printCircular(Node* head) {
    cout << head->data;
    for (Node* curr = head->next; curr != head; curr = curr->next) cout << " -> " << curr->data;
    cout << " -> (back to " << head->data << ")\n";
}

int main() {
    Node* head = new Node(10); head->next = new Node(5); head->next->next = new Node(20);
    head->next->next->next = new Node(15); head->next->next->next->next = head;
    head = insertBeginning(head, 25); printCircular(head);
    head = insertBeginning(head, 30); printCircular(head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static Node insertBeginning(Node head, int x) {
        Node temp = new Node(x);
        if (head == null) { temp.next = temp; return temp; }   // one node points at itself
        temp.next = head.next;                                  // insert temp right after head
        head.next = temp;
        int t = head.data; head.data = temp.data; temp.data = t; // swap values: head now holds x
        return head;
    }

    static void printCircular(Node head) {
        StringBuilder sb = new StringBuilder().append(head.data);
        for (Node curr = head.next; curr != head; curr = curr.next) sb.append(" -> ").append(curr.data);
        System.out.println(sb + " -> (back to " + head.data + ")");
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
        head.next.next.next = new Node(15); head.next.next.next.next = head;
        head = insertBeginning(head, 25); printCircular(head);
        head = insertBeginning(head, 30); printCircular(head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function insertBeginning(head, x) {
    const temp = new Node(x);
    if (head === null) { temp.next = temp; return temp; }   // one node points at itself
    temp.next = head.next;                                   // insert temp right after head
    head.next = temp;
    [head.data, temp.data] = [temp.data, head.data];         // swap values: head now holds x
    return head;
}

function printCircular(head) {
    const parts = [head.data];
    for (let curr = head.next; curr !== head; curr = curr.next) parts.push(curr.data);
    console.log(parts.join(" -> "), `-> (back to ${head.data})`);
}

let head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
head.next.next.next = new Node(15); head.next.next.next.next = head;
head = insertBeginning(head, 25); printCircular(head);
head = insertBeginning(head, 30); printCircular(head);
```

```text filename:Output
25 -> 10 -> 5 -> 20 -> 15 -> (back to 25)
30 -> 25 -> 10 -> 5 -> 20 -> 15 -> (back to 30)
```

Time O(1) · Space O(1)

> [!WARNING] Pitfall
>
> The swap trick moves a <em>value</em> into a different node. If other code holds references to specific nodes (or the data is large/expensive to copy), use the tail-pointer design instead: with `tail` known, `head = tail.next` and both ends are O(1) without any swapping.

# Insert at the end

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 5 -> 20 -> 15 (circular), insert 35 at the end`<br><strong>Output:</strong> `10 -> 5 -> 20 -> 15 -> 35 -> (back to 10)`

<strong>Naive, O(n).</strong> Walk to the last node, link it to the new node and link the new node back to the head.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def insert_end_naive(head, x):
    temp = Node(x)
    if head is None:
        temp.next = temp
        return temp
    curr = head
    while curr.next != head:           # O(n) walk to the last node
        curr = curr.next
    curr.next = temp                   # last → new
    temp.next = head                   # new → head
    return head

def print_circular(head):
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
head = insert_end_naive(head, 35)
print_circular(head)
```

```text filename:Output
10 -> 5 -> 20 -> 15 -> 35 -> (back to 10)
```

Time O(n) · Space O(1)

> [!NOTE] Idea
>
> <strong>Efficient, O(1).</strong> Same trick as before — insert the new node after the head and swap the values — but now <strong>return the new node as the head</strong>. Reading the circle from that node gives the old sequence first and the new value last: the head node (which now holds `x`) comes just before it.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def insert_end(head, x):
    temp = Node(x)
    if head is None:
        temp.next = temp
        return temp
    temp.next = head.next                            # insert temp right after head
    head.next = temp
    head.data, temp.data = temp.data, head.data      # old head value moves to temp
    return temp                                      # temp is the new head; x sits just before it

def print_circular(head):
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
head = insert_end(head, 35); print_circular(head)
head = insert_end(head, 40); print_circular(head)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* insertEnd(Node* head, int x) {
    Node* temp = new Node(x);
    if (!head) { temp->next = temp; return temp; }
    temp->next = head->next;                         // insert temp right after head
    head->next = temp;
    swap(head->data, temp->data);                    // old head value moves to temp
    return temp;                                     // temp is the new head; x sits just before it
}

void printCircular(Node* head) {
    cout << head->data;
    for (Node* curr = head->next; curr != head; curr = curr->next) cout << " -> " << curr->data;
    cout << " -> (back to " << head->data << ")\n";
}

int main() {
    Node* head = new Node(10); head->next = new Node(5); head->next->next = new Node(20);
    head->next->next->next = new Node(15); head->next->next->next->next = head;
    head = insertEnd(head, 35); printCircular(head);
    head = insertEnd(head, 40); printCircular(head);
}
```

```java filename:Java
public class Main {
    static class Node {
        int data; Node next;
        Node(int d) { data = d; }
    }

    static Node insertEnd(Node head, int x) {
        Node temp = new Node(x);
        if (head == null) { temp.next = temp; return temp; }
        temp.next = head.next;                                   // insert temp right after head
        head.next = temp;
        int t = head.data; head.data = temp.data; temp.data = t;  // old head value moves to temp
        return temp;                                             // temp is the new head; x sits just before it
    }

    static void printCircular(Node head) {
        StringBuilder sb = new StringBuilder().append(head.data);
        for (Node curr = head.next; curr != head; curr = curr.next) sb.append(" -> ").append(curr.data);
        System.out.println(sb + " -> (back to " + head.data + ")");
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
        head.next.next.next = new Node(15); head.next.next.next.next = head;
        head = insertEnd(head, 35); printCircular(head);
        head = insertEnd(head, 40); printCircular(head);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function insertEnd(head, x) {
    const temp = new Node(x);
    if (head === null) { temp.next = temp; return temp; }
    temp.next = head.next;                                   // insert temp right after head
    head.next = temp;
    [head.data, temp.data] = [temp.data, head.data];         // old head value moves to temp
    return temp;                                             // temp is the new head; x sits just before it
}

function printCircular(head) {
    const parts = [head.data];
    for (let curr = head.next; curr !== head; curr = curr.next) parts.push(curr.data);
    console.log(parts.join(" -> "), `-> (back to ${head.data})`);
}

let head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
head.next.next.next = new Node(15); head.next.next.next.next = head;
head = insertEnd(head, 35); printCircular(head);
head = insertEnd(head, 40); printCircular(head);
```

```text filename:Output
10 -> 5 -> 20 -> 15 -> 35 -> (back to 10)
10 -> 5 -> 20 -> 15 -> 35 -> 40 -> (back to 10)
```

Time O(1) · Space O(1)

# Delete the head

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 5 -> 20 -> 15 (circular)`<br><strong>Output:</strong> `5 -> 20 -> 15 -> (back to 5)`<br><strong>Input:</strong> `list = 10 (one node)`<br><strong>Output:</strong> `empty`

<strong>Naive, O(n).</strong> The last node points at the head, so after removing the head the last node must be found and re-pointed at the second node — a full walk.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def delete_head_naive(head):
    if head is None or head.next == head:   # empty or single node → empty
        return None
    curr = head
    while curr.next != head:                # O(n) walk to the last node
        curr = curr.next
    curr.next = head.next                   # last → second node
    return curr.next                        # second node is the new head

def print_circular(head):
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
head = delete_head_naive(head)
print_circular(head)
```

```text filename:Output
5 -> 20 -> 15 -> (back to 5)
```

Time O(n) · Space O(1)

> [!NOTE] Idea
>
> <strong>Efficient, O(1).</strong> Instead of removing the head node, <strong>copy the second node's value into it</strong> and unlink the second node. The head node object survives, so the last node's back-pointer stays valid without any walk.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def delete_head(head):
    if head is None or head.next == head:   # empty or single node → empty
        return None
    head.data = head.next.data               # pull the second value into the head node
    head.next = head.next.next               # unlink the second node
    return head

def print_circular(head):
    if head is None:
        print("empty"); return
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
for _ in range(4):
    head = delete_head(head)
    print_circular(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* deleteHead(Node* head) {
    if (!head) return nullptr;
    if (head->next == head) { delete head; return nullptr; }   // single node → empty
    Node* second = head->next;
    head->data = second->data;               // pull the second value into the head node
    head->next = second->next;               // unlink the second node
    delete second;
    return head;
}

void printCircular(Node* head) {
    if (!head) { cout << "empty\n"; return; }
    cout << head->data;
    for (Node* curr = head->next; curr != head; curr = curr->next) cout << " -> " << curr->data;
    cout << " -> (back to " << head->data << ")\n";
}

int main() {
    Node* head = new Node(10); head->next = new Node(5); head->next->next = new Node(20);
    head->next->next->next = new Node(15); head->next->next->next->next = head;
    for (int i = 0; i < 4; i++) {
        head = deleteHead(head);
        printCircular(head);
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
        if (head == null || head.next == head) return null;   // empty or single node → empty
        head.data = head.next.data;              // pull the second value into the head node
        head.next = head.next.next;              // unlink the second node
        return head;
    }

    static void printCircular(Node head) {
        if (head == null) { System.out.println("empty"); return; }
        StringBuilder sb = new StringBuilder().append(head.data);
        for (Node curr = head.next; curr != head; curr = curr.next) sb.append(" -> ").append(curr.data);
        System.out.println(sb + " -> (back to " + head.data + ")");
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
        head.next.next.next = new Node(15); head.next.next.next.next = head;
        for (int i = 0; i < 4; i++) {
            head = deleteHead(head);
            printCircular(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function deleteHead(head) {
    if (head === null || head.next === head) return null;    // empty or single node → empty
    head.data = head.next.data;                  // pull the second value into the head node
    head.next = head.next.next;                  // unlink the second node
    return head;
}

function printCircular(head) {
    if (head === null) { console.log("empty"); return; }
    const parts = [head.data];
    for (let curr = head.next; curr !== head; curr = curr.next) parts.push(curr.data);
    console.log(parts.join(" -> "), `-> (back to ${head.data})`);
}

let head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
head.next.next.next = new Node(15); head.next.next.next.next = head;
for (let i = 0; i < 4; i++) {
    head = deleteHead(head);
    printCircular(head);
}
```

```text filename:Output
5 -> 20 -> 15 -> (back to 5)
20 -> 15 -> (back to 20)
15 -> (back to 15)
empty
```

Time O(1) · Space O(1)

# Delete the k-th node

> [!TIP] Example
>
> <strong>Input:</strong> `list = 10 -> 5 -> 20 -> 15 (circular), k = 2`<br><strong>Output:</strong> `10 -> 20 -> 15 -> (back to 10)`<br><strong>Input:</strong> `k = 1`<br><strong>Output:</strong> `5 -> 20 -> 15 -> (back to 5)`

> [!NOTE] Idea
>
> `k = 1` is the head — reuse `delete_head`. Otherwise walk to the `(k-1)`-th node, which takes `k - 2` steps from the head, and bypass its successor: `curr.next = curr.next.next`. The circle stays closed because the bypassed node's `next` is reused.

1. <strong>Empty list</strong>

   Return `None`.

2. <strong>`k == 1`</strong>

   Return `delete_head(head)` — the O(1) version above.

3. <strong>Walk</strong>

   `curr = head`; move `k - 2` times → `curr` is the `(k-1)`-th node.

4. <strong>Bypass</strong>

   `curr.next = curr.next.next` removes the `k`-th node.

```python filename:Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

def delete_head(head):
    if head is None or head.next == head:
        return None
    head.data = head.next.data
    head.next = head.next.next
    return head

def delete_kth(head, k):
    if head is None:
        return None
    if k == 1:
        return delete_head(head)
    curr = head
    for _ in range(k - 2):                   # k-2 steps reach the (k-1)-th node
        curr = curr.next
    curr.next = curr.next.next               # bypass the k-th node
    return head

def print_circular(head):
    parts, curr = [str(head.data)], head.next
    while curr != head:
        parts.append(str(curr.data)); curr = curr.next
    print(" -> ".join(parts), f"-> (back to {head.data})")

head = Node(10); head.next = Node(5); head.next.next = Node(20); head.next.next.next = Node(15)
head.next.next.next.next = head
print_circular(head)
for k, label in ((2, "2nd"), (3, "3rd"), (1, "1st")):
    head = delete_kth(head, k)
    print(f"delete {label}: ", end=""); print_circular(head)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int data; Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

Node* deleteHead(Node* head) {
    if (!head) return nullptr;
    if (head->next == head) { delete head; return nullptr; }
    Node* second = head->next;
    head->data = second->data; head->next = second->next;
    delete second;
    return head;
}

Node* deleteKth(Node* head, int k) {
    if (!head) return nullptr;
    if (k == 1) return deleteHead(head);
    Node* curr = head;
    for (int i = 0; i < k - 2; i++) curr = curr->next;   // k-2 steps reach the (k-1)-th node
    Node* victim = curr->next;
    curr->next = victim->next;                           // bypass the k-th node
    delete victim;
    return head;
}

void printCircular(Node* head) {
    cout << head->data;
    for (Node* curr = head->next; curr != head; curr = curr->next) cout << " -> " << curr->data;
    cout << " -> (back to " << head->data << ")\n";
}

int main() {
    Node* head = new Node(10); head->next = new Node(5); head->next->next = new Node(20);
    head->next->next->next = new Node(15); head->next->next->next->next = head;
    printCircular(head);
    int ks[] = {2, 3, 1}; const char* labels[] = {"2nd", "3rd", "1st"};
    for (int i = 0; i < 3; i++) {
        head = deleteKth(head, ks[i]);
        cout << "delete " << labels[i] << ": "; printCircular(head);
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
        if (head == null || head.next == head) return null;
        head.data = head.next.data; head.next = head.next.next;
        return head;
    }

    static Node deleteKth(Node head, int k) {
        if (head == null) return null;
        if (k == 1) return deleteHead(head);
        Node curr = head;
        for (int i = 0; i < k - 2; i++) curr = curr.next;   // k-2 steps reach the (k-1)-th node
        curr.next = curr.next.next;                         // bypass the k-th node
        return head;
    }

    static void printCircular(Node head) {
        StringBuilder sb = new StringBuilder().append(head.data);
        for (Node curr = head.next; curr != head; curr = curr.next) sb.append(" -> ").append(curr.data);
        System.out.println(sb + " -> (back to " + head.data + ")");
    }

    public static void main(String[] args) {
        Node head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
        head.next.next.next = new Node(15); head.next.next.next.next = head;
        printCircular(head);
        int[] ks = {2, 3, 1}; String[] labels = {"2nd", "3rd", "1st"};
        for (int i = 0; i < 3; i++) {
            head = deleteKth(head, ks[i]);
            System.out.print("delete " + labels[i] + ": "); printCircular(head);
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(data) { this.data = data; this.next = null; }
}

function deleteHead(head) {
    if (head === null || head.next === head) return null;
    head.data = head.next.data; head.next = head.next.next;
    return head;
}

function deleteKth(head, k) {
    if (head === null) return null;
    if (k === 1) return deleteHead(head);
    let curr = head;
    for (let i = 0; i < k - 2; i++) curr = curr.next;   // k-2 steps reach the (k-1)-th node
    curr.next = curr.next.next;                         // bypass the k-th node
    return head;
}

function printCircular(head) {
    const parts = [head.data];
    for (let curr = head.next; curr !== head; curr = curr.next) parts.push(curr.data);
    console.log(parts.join(" -> "), `-> (back to ${head.data})`);
}

let head = new Node(10); head.next = new Node(5); head.next.next = new Node(20);
head.next.next.next = new Node(15); head.next.next.next.next = head;
printCircular(head);
for (const [k, label] of [[2, "2nd"], [3, "3rd"], [1, "1st"]]) {
    head = deleteKth(head, k);
    process.stdout.write(`delete ${label}: `); printCircular(head);
}
```

```text filename:Output
10 -> 5 -> 20 -> 15 -> (back to 10)
delete 2nd: 10 -> 20 -> 15 -> (back to 10)
delete 3rd: 10 -> 20 -> (back to 10)
delete 1st: 20 -> (back to 20)
```

Time O(k) · Space O(1)

> [!WARNING] Pitfall
>
> The original notes looped `for i in range(1, k-2)`, which takes `k - 3` steps and deletes the wrong node for every `k > 2`. Count the steps on paper: from node 1, reaching node `k-1` is exactly `k - 2` hops. The code also assumes `k ≤ length`; add a length check (or stop when `curr.next == head`) for untrusted input.

# Interview Q&amp;A

```question
How do you detect that a linked list is circular?

---

Traverse with a `fast` pointer moving two steps and a `slow` pointer moving one (Floyd's cycle detection). In a circular list they eventually meet; in a normal list `fast` reaches `None`. O(n) time, O(1) space — a visited-set would also work but costs O(n) memory.
```

```question
Why keep a tail pointer rather than a head pointer in a circular list?

---

Because `tail.next` <em>is</em> the head. With the tail you can insert at the front (`new.next = tail.next; tail.next = new`), insert at the back (same, then `tail = new`) and delete the front, all in O(1), without the value-swapping trick. Queues built on circular lists do exactly this.
```

```question
Where are circular linked lists used in practice?

---

Round-robin CPU scheduling, turn order in games, circular buffers for streaming data, Fibonacci heaps (the root list is circular doubly linked), and the Josephus problem — every k-th person around a circle is eliminated until one remains.
```

```question
What goes wrong if you forget the single-node case?

---

A one-node circular list has `head.next == head`. A `delete_head` that does `head.next = head.next.next` would leave the node pointing at itself and return it — the list never becomes empty. Always test the empty, one-node and two-node lists.
```
