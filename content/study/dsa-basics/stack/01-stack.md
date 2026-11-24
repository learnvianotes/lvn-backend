---
id: a7f0f1cb-dcd5-7b1f-87cd-997c0d7e75b8
key: topic:dsa-basics/stack
subject: dsa-basics
topic: stack
title: Stack
slug: stack
order: 1
---

A stack is a <strong>Last In, First Out</strong> (LIFO) collection: you can only add to or remove from one end, the <em>top</em>. It is the data structure behind function calls, undo, bracket matching and expression evaluation.

> [!INFO]
>
> <strong>Stack</strong> — a linear data structure where insertion (`push`) and deletion (`pop`) happen at the same end, called the top. The element pushed last is popped first.

```text filename:A%20stack%20after%20push(10)%2C%20push(20)%2C%20push(30)%2C%20push(40)
push(40)  →   ┌────┐  ← top        pop()  →  returns 40
              │ 40 │
              ├────┤
              │ 30 │
              ├────┤
              │ 20 │
              ├────┤
              │ 10 │  ← bottom
              └────┘
```

# Operations

| Operation | What it does | Time |
| --- | --- | --- |
| `push(x)` | Insert `x` at the top | O(1) |
| `pop()` | Remove and return the top element | O(1) |
| `peek()` / `top()` | Return the top element without removing it | O(1) |
| `isEmpty()` | `true` when the stack has no elements | O(1) |
| `size()` | Number of elements | O(1) |

> [!WARNING] Watch out
>
> <strong>Underflow</strong> — calling `pop()` or `peek()` on an empty stack. <strong>Overflow</strong> — calling `push()` on a fixed-capacity stack that is full. Always check `isEmpty()` before popping; the built-in containers below raise an error (Python/Java) or return `undefined` (JavaScript) instead.

# Using the built-in containers

Every language already has a container that works as a stack. Use the end of a dynamic array (append / pop at the back are amortised O(1)) — never the front, where every operation shifts all elements.

```python filename:Python
stack = []                 # a list used as a stack
stack.append('a')          # push
stack.append('b')
stack.append('c')
print("top:", stack[-1])   # peek
print("popped:", stack.pop())
print("popped:", stack.pop())
print("size:", len(stack))
print("empty:", len(stack) == 0)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
using namespace std;

int main() {
    stack<char> st;            // std::stack adapts a deque
    st.push('a');
    st.push('b');
    st.push('c');
    cout << "top: " << st.top() << "\n";
    cout << "popped: " << st.top() << "\n"; st.pop();   // pop() returns nothing in C++
    cout << "popped: " << st.top() << "\n"; st.pop();
    cout << "size: " << st.size() << "\n";
    cout << "empty: " << (st.empty() ? "True" : "False") << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    public static void main(String[] args) {
        Deque<Character> stack = new ArrayDeque<>();   // preferred over the legacy java.util.Stack
        stack.push('a');
        stack.push('b');
        stack.push('c');
        System.out.println("top: " + stack.peek());
        System.out.println("popped: " + stack.pop());
        System.out.println("popped: " + stack.pop());
        System.out.println("size: " + stack.size());
        System.out.println("empty: " + (stack.isEmpty() ? "True" : "False"));
    }
}
```

```javascript filename:JavaScript
const stack = [];              // an array used as a stack
stack.push('a');
stack.push('b');
stack.push('c');
console.log("top:", stack[stack.length - 1]);
console.log("popped:", stack.pop());
console.log("popped:", stack.pop());
console.log("size:", stack.length);
console.log("empty:", stack.length === 0 ? "True" : "False");
```

```text filename:Output
top: c
popped: c
popped: b
size: 1
empty: False
```

> [!NOTE] Key point
>
> Python's `collections.deque` and `queue.LifoQueue` also work as stacks. `deque` is the right choice when the same container must also behave as a queue; `LifoQueue` is thread-safe and meant for producer/consumer code, not for algorithms.

# Implementing a stack with a linked list

Pushing and popping at the head of a singly linked list are both O(1), so a linked list gives a stack that never needs resizing. The head node is the top.

```text filename:push(10)%2C%20push(20)%2C%20push(30)%20%E2%80%94%20the%20newest%20node%20becomes%20the%20head
top
 ↓
┌────┬───┐   ┌────┬───┐   ┌────┬───┐
│ 30 │ ●─┼──▶│ 20 │ ●─┼──▶│ 10 │ ∅ │
└────┴───┘   └────┴───┘   └────┴───┘
```

```python filename:Python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None

class Stack:
    def __init__(self):
        self.head = None
        self.size = 0

    def push(self, value):
        node = Node(value)
        node.next = self.head      # new node points at the old top
        self.head = node
        self.size += 1

    def pop(self):
        if self.head is None:
            raise IndexError("pop from empty stack")
        node = self.head
        self.head = node.next
        self.size -= 1
        return node.value

    def peek(self):
        return None if self.head is None else self.head.value

    def is_empty(self):
        return self.head is None

s = Stack()
for x in (10, 20, 30):
    s.push(x)
node = s.head
while node:                      # print top → bottom
    print(node.value, end=" ")
    node = node.next
print()
print("size:", s.size)
print("popped:", s.pop())
print("peek:", s.peek())
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

class Stack {
    Node* head = nullptr;
    int count = 0;
public:
    ~Stack() { while (head) pop(); }
    void push(int v) {
        Node* node = new Node(v);
        node->next = head;           // new node points at the old top
        head = node;
        count++;
    }
    int pop() {
        if (!head) throw runtime_error("pop from empty stack");
        Node* node = head;
        int v = node->value;
        head = node->next;
        delete node;
        count--;
        return v;
    }
    int peek() const { return head->value; }
    bool isEmpty() const { return head == nullptr; }
    int size() const { return count; }
    Node* top() const { return head; }
};

int main() {
    Stack s;
    for (int x : {10, 20, 30}) s.push(x);
    for (Node* n = s.top(); n; n = n->next) cout << n->value << " ";
    cout << "\n";
    cout << "size: " << s.size() << "\n";
    cout << "popped: " << s.pop() << "\n";
    cout << "peek: " << s.peek() << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int value; Node next;
        Node(int v) { value = v; }
    }

    static class Stack {
        Node head; int size;
        void push(int v) {
            Node node = new Node(v);
            node.next = head;            // new node points at the old top
            head = node;
            size++;
        }
        int pop() {
            if (head == null) throw new RuntimeException("pop from empty stack");
            int v = head.value;
            head = head.next;
            size--;
            return v;
        }
        Integer peek() { return head == null ? null : head.value; }
        boolean isEmpty() { return head == null; }
    }

    public static void main(String[] args) {
        Stack s = new Stack();
        for (int x : new int[]{10, 20, 30}) s.push(x);
        StringBuilder sb = new StringBuilder();
        for (Node n = s.head; n != null; n = n.next) sb.append(n.value).append(' ');
        System.out.println(sb.toString().trim());
        System.out.println("size: " + s.size);
        System.out.println("popped: " + s.pop());
        System.out.println("peek: " + s.peek());
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(value) { this.value = value; this.next = null; }
}

class Stack {
    constructor() { this.head = null; this.size = 0; }
    push(value) {
        const node = new Node(value);
        node.next = this.head;           // new node points at the old top
        this.head = node;
        this.size++;
    }
    pop() {
        if (!this.head) throw new Error("pop from empty stack");
        const node = this.head;
        this.head = node.next;
        this.size--;
        return node.value;
    }
    peek() { return this.head ? this.head.value : null; }
    isEmpty() { return this.head === null; }
}

const s = new Stack();
for (const x of [10, 20, 30]) s.push(x);
const parts = [];
for (let n = s.head; n; n = n.next) parts.push(n.value);
console.log(parts.join(" "));
console.log("size:", s.size);
console.log("popped:", s.pop());
console.log("peek:", s.peek());
```

```text filename:Output
30 20 10
size: 3
popped: 30
peek: 20
```

Time O(1) per operation · Space O(n) for n elements

# Where stacks are used

> [!NOTE] Function calls
>
> The call stack stores one frame per active call; returning pops it. Deep recursion overflows it.

> [!NOTE] Balanced brackets
>
> Push every opener, pop on every closer and check that it matches — see below.

> [!NOTE] Undo / redo, back / forward
>
> Each action is pushed; undo pops it onto a second stack for redo.

> [!NOTE] Expression evaluation
>
> Infix → postfix conversion and postfix evaluation both run on a stack.

> [!NOTE] Reversing
>
> Push everything, then pop everything — the order reverses.

> [!NOTE] Monotonic stack problems
>
> Next greater element, stock span, histogram area (DSA Advanced → Stack).

# Problem: check for balanced parentheses

> [!TIP] Example
>
> <strong>Input:</strong> `s = "([])"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s = "([)]"`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `s = "(("`<br><strong>Output:</strong> `No`

> [!NOTE] Idea
>
> Scan left to right. Push every opening bracket. On a closing bracket the stack must be non-empty and its top must be the matching opener — pop it. At the end the stack must be empty. Any violation means the string is unbalanced.

1. <strong>Opening bracket</strong>

   Push it onto the stack.

2. <strong>Closing bracket</strong>

   If the stack is empty → unbalanced. Pop the top; if it is not the matching opener → unbalanced.

3. <strong>End of string</strong>

   Balanced only if the stack is empty (every opener was closed).

```python filename:Python
def is_balanced(s):
    match = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in match:
            if not stack or stack.pop() != match[ch]:
                return False
    return not stack

for s in ["([])", "([)]", "((", "{[()]}"]:
    print(s, "→", "Yes" if is_balanced(s) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
#include <string>
using namespace std;

bool isBalanced(const string& s) {
    stack<char> st;
    for (char ch : s) {
        if (ch == '(' || ch == '[' || ch == '{') {
            st.push(ch);
        } else {
            if (st.empty()) return false;
            char open = st.top(); st.pop();
            if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{'))
                return false;
        }
    }
    return st.empty();
}

int main() {
    for (string s : {"([])", "([)]", "((", "{[()]}"})
        cout << s << " → " << (isBalanced(s) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static boolean isBalanced(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char ch : s.toCharArray()) {
            if (ch == '(' || ch == '[' || ch == '{') {
                stack.push(ch);
            } else {
                if (stack.isEmpty()) return false;
                char open = stack.pop();
                if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{'))
                    return false;
            }
        }
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        for (String s : new String[]{"([])", "([)]", "((", "{[()]}"})
            System.out.println(s + " → " + (isBalanced(s) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isBalanced(s) {
    const match = { ')': '(', ']': '[', '}': '{' };
    const stack = [];
    for (const ch of s) {
        if ('([{'.includes(ch)) {
            stack.push(ch);
        } else if (ch in match) {
            if (!stack.length || stack.pop() !== match[ch]) return false;
        }
    }
    return stack.length === 0;
}

for (const s of ["([])", "([)]", "((", "{[()]}"])
    console.log(s, "→", isBalanced(s) ? "Yes" : "No");
```

```text filename:Output
([]) → Yes
([)] → No
(( → No
{[()]} → Yes
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> Forgetting the final `stack is empty` check accepts `"(("`; forgetting the `empty before pop` check crashes on `")"`. Both are classic interview slips.

# Interview Q&amp;A

```question
Array or linked list for a stack — which is better?

---

Both give O(1) push/pop. An array (dynamic) is cache-friendly and usually faster; occasionally a push triggers an O(n) resize, but the amortised cost stays O(1). A linked list never resizes and has no capacity limit, at the price of one pointer per element and scattered memory.
```

```question
What is stack overflow in the context of recursion?

---

Every call pushes a frame on the call stack. Recursion that goes too deep (no base case, or a very large input) exhausts the stack's fixed size — Python raises `RecursionError` at about 1000 frames; C++ and Java crash with a stack overflow. Convert to iteration or use an explicit stack when depth can be large.
```

```question
How would you implement a queue using two stacks?

---

Push into stack `in`. To dequeue, if `out` is empty, pop everything from `in` and push onto `out` (this reverses the order), then pop from `out`. Each element moves at most twice, so operations are amortised O(1). See the Queue topic.
```
