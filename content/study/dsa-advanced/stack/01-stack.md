---
id: ab4d20fe-57ed-795c-b7e1-a9cbc963d850
key: topic:dsa-advanced/stack
subject: dsa-advanced
topic: stack
title: Stack
slug: stack
order: 1
---

You know `push` and `pop`. The advanced stack problems are about three ideas: sharing one array between several stacks, the <strong>monotonic stack</strong> that answers <em>previous/next greater or smaller</em> questions in `O(n)`, and augmenting a stack so `getMin()` is `O(1)`.

> [!INFO]
>
> <strong>Monotonic stack</strong> — a stack whose elements are kept in sorted order (strictly decreasing or increasing from bottom to top) by popping everything that would break the order before each push. Each element is pushed once and popped at most once, so a whole scan costs `O(n)` even though it contains a nested `while`.

# The three families of stack problems

> [!NOTE] Space sharing
>
> Two stacks in one array, k stacks in one array. The trick is to let stacks grow towards each other or to thread a free list through the array so no slot is reserved for a stack that is empty.

> [!NOTE] Monotonic stack
>
> Stock span, previous greater, next greater, largest rectangle in a histogram, largest rectangle of 1s in a matrix. One pattern, five problems.

> [!NOTE] Augmented stack
>
> A stack that also answers `getMin()` in `O(1)` — first with a second stack, then with a single extra variable and an encoding trick.

# The monotonic stack pattern

Most <em>nearest element</em> questions — <em>what is the closest element to the left that is greater than me?</em> — have an obvious `O(n²)` answer: for every `i` scan backwards. The stack version scans once and keeps only the candidates that can still be the answer for some future element.

> [!NOTE] Idea
>
> Walking left to right, if `arr[j] <= arr[i]` for some `j < i`, then `arr[j]` can never be the <em>previous greater</em> of anything after `i` — `arr[i]` is at least as large and closer. So when `arr[i]` arrives, pop every top that is `<= arr[i]`: they are dead. Whatever remains on top is the answer for `i`. Then push `i`. The stack stays strictly decreasing from bottom to top.

```text filename:Previous%20greater%20element%20with%20a%20monotonic%20stack%20%E2%80%94%20every%20element%20is%20pushed%20once%20and%20popped%20at%20most%20once
arr = [15, 10, 18, 12, 4, 6, 2, 8]        stack holds values, decreasing bottom → top

i  arr[i]  pop while top <= arr[i]      top after pops   previous greater   push → stack
0   15     –                             (empty)          -1                 [15]
1   10     –                             15               15                 [15, 10]
2   18     10, 15                        (empty)          -1                 [18]
3   12     –                             18               18                 [18, 12]
4    4     –                             12               12                 [18, 12, 4]
5    6     4                             12               12                 [18, 12, 6]
6    2     –                             6                6                  [18, 12, 6, 2]
7    8     2, 6                          12               12                 [18, 12, 8]
```

| Question | Scan direction | Pop while | Stack order (bottom → top) |
| --- | --- | --- | --- |
| Previous greater | left → right | `top <= arr[i]` | strictly decreasing |
| Next greater | right → left | `top <= arr[i]` | strictly decreasing |
| Previous smaller | left → right | `top >= arr[i]` | strictly increasing |
| Next smaller | right → left | `top >= arr[i]` | strictly increasing |

> [!NOTE] Amortised O(n)
>
> <strong>Why it is </strong><strong>`O(n)`</strong><strong> despite the nested loop.</strong> Each index is pushed exactly once, and every iteration of the inner `while` pops one element. There can be no more pops than pushes, so the total work over the whole scan is at most `2n` stack operations. Amortised analysis, not worst-case per step, is the right lens.

Store <strong>indices</strong> on the stack rather than values when you also need distances (stock span, histogram widths). Store values when only the element itself is wanted. The rest of this topic uses this pattern five times; each section says which variant it is.

# Implement two stacks in one array

> [!TIP] Example
>
> <strong>Input:</strong> `cap = 6; push1(5), push1(10), push1(15), push1(20); push2(25), push2(30); push2(35)`<br><strong>Output:</strong> `push1(20) succeeds, push2(35) fails — the array is full only when 6 elements are stored`<br><strong>Input:</strong> `pop1(), pop1(), pop2(), pop2()`<br><strong>Output:</strong> `20 15 30 25`

<strong>Naive split.</strong> Give the first half of the array to stack 1 and the second half to stack 2. Wasteful: with capacity 6, stack 1 is full after 3 pushes even if stack 2 is empty.

> [!NOTE] Idea
>
> Start the two stacks at the <strong>two ends</strong> of the array and let them grow towards each other: stack 1 grows from index `0` upwards (`top1` starts at `-1`), stack 2 grows from index `n-1` downwards (`top2` starts at `n`). The array is full only when the two tops meet: `top1 + 1 == top2`. Either stack may use any amount of the shared space.

```text filename:After%20push1(5%2C%2010%2C%2015%2C%2020)%20and%20push2(25%2C%2030)%20in%20a%20capacity-6%20array
index:   0    1    2    3    4    5
       ┌────┬────┬────┬────┬────┬────┐
       │ 5  │ 10 │ 15 │ 20 │ 30 │ 25 │
       └────┴────┴────┴────┴────┴────┘
         stack 1 ──────────▶  ◀── stack 2
                      top1 = 3   top2 = 4      full: top1 + 1 == top2
```

```python filename:Python
class TwoStacks:
    def __init__(self, n):
        self.cap = n
        self.arr = [None] * n
        self.top1 = -1        # stack 1 grows from the left end
        self.top2 = n         # stack 2 grows from the right end

    def push1(self, x):
        if self.top1 + 1 == self.top2:     # the tops have met: no free slot
            return False
        self.top1 += 1
        self.arr[self.top1] = x
        return True

    def push2(self, x):
        if self.top1 + 1 == self.top2:
            return False
        self.top2 -= 1
        self.arr[self.top2] = x
        return True

    def pop1(self):
        if self.top1 < 0:
            return None
        x = self.arr[self.top1]
        self.top1 -= 1
        return x

    def pop2(self):
        if self.top2 >= self.cap:
            return None
        x = self.arr[self.top2]
        self.top2 += 1
        return x

    def size1(self):
        return self.top1 + 1

    def size2(self):
        return self.cap - self.top2

s = TwoStacks(6)
for x in (5, 10, 15):
    s.push1(x)
print("push1(20):", "true" if s.push1(20) else "false")   # a 3+3 split would refuse this
for x in (25, 30):
    s.push2(x)
print("push2(35):", "true" if s.push2(35) else "false")   # now the array really is full
print("pop1:", s.pop1())
print("pop1:", s.pop1())
print("pop2:", s.pop2())
print("pop2:", s.pop2())
print("size1:", s.size1())
print("size2:", s.size2())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

class TwoStacks {
    vector<int> arr;
    int cap, top1, top2;
public:
    TwoStacks(int n) : arr(n), cap(n), top1(-1), top2(n) {}
    bool push1(int x) {
        if (top1 + 1 == top2) return false;    // the tops have met: no free slot
        arr[++top1] = x;
        return true;
    }
    bool push2(int x) {
        if (top1 + 1 == top2) return false;
        arr[--top2] = x;
        return true;
    }
    int pop1() { return top1 < 0 ? -1 : arr[top1--]; }
    int pop2() { return top2 >= cap ? -1 : arr[top2++]; }
    int size1() const { return top1 + 1; }
    int size2() const { return cap - top2; }
};

int main() {
    TwoStacks s(6);
    for (int x : {5, 10, 15}) s.push1(x);
    cout << "push1(20): " << (s.push1(20) ? "true" : "false") << "\n";   // a 3+3 split would refuse this
    for (int x : {25, 30}) s.push2(x);
    cout << "push2(35): " << (s.push2(35) ? "true" : "false") << "\n";   // now the array really is full
    cout << "pop1: " << s.pop1() << "\n";
    cout << "pop1: " << s.pop1() << "\n";
    cout << "pop2: " << s.pop2() << "\n";
    cout << "pop2: " << s.pop2() << "\n";
    cout << "size1: " << s.size1() << "\n";
    cout << "size2: " << s.size2() << "\n";
}
```

```java filename:Java
public class Main {
    static class TwoStacks {
        int[] arr;
        int cap, top1, top2;
        TwoStacks(int n) { arr = new int[n]; cap = n; top1 = -1; top2 = n; }
        boolean push1(int x) {
            if (top1 + 1 == top2) return false;   // the tops have met: no free slot
            arr[++top1] = x;
            return true;
        }
        boolean push2(int x) {
            if (top1 + 1 == top2) return false;
            arr[--top2] = x;
            return true;
        }
        int pop1() { return top1 < 0 ? -1 : arr[top1--]; }
        int pop2() { return top2 >= cap ? -1 : arr[top2++]; }
        int size1() { return top1 + 1; }
        int size2() { return cap - top2; }
    }

    public static void main(String[] args) {
        TwoStacks s = new TwoStacks(6);
        for (int x : new int[]{5, 10, 15}) s.push1(x);
        System.out.println("push1(20): " + s.push1(20));   // a 3+3 split would refuse this
        for (int x : new int[]{25, 30}) s.push2(x);
        System.out.println("push2(35): " + s.push2(35));   // now the array really is full
        System.out.println("pop1: " + s.pop1());
        System.out.println("pop1: " + s.pop1());
        System.out.println("pop2: " + s.pop2());
        System.out.println("pop2: " + s.pop2());
        System.out.println("size1: " + s.size1());
        System.out.println("size2: " + s.size2());
    }
}
```

```javascript filename:JavaScript
class TwoStacks {
    constructor(n) {
        this.cap = n;
        this.arr = new Array(n);
        this.top1 = -1;       // stack 1 grows from the left end
        this.top2 = n;        // stack 2 grows from the right end
    }
    push1(x) {
        if (this.top1 + 1 === this.top2) return false;   // the tops have met: no free slot
        this.arr[++this.top1] = x;
        return true;
    }
    push2(x) {
        if (this.top1 + 1 === this.top2) return false;
        this.arr[--this.top2] = x;
        return true;
    }
    pop1() { return this.top1 < 0 ? null : this.arr[this.top1--]; }
    pop2() { return this.top2 >= this.cap ? null : this.arr[this.top2++]; }
    size1() { return this.top1 + 1; }
    size2() { return this.cap - this.top2; }
}

const s = new TwoStacks(6);
for (const x of [5, 10, 15]) s.push1(x);
console.log("push1(20):", s.push1(20));   // a 3+3 split would refuse this
for (const x of [25, 30]) s.push2(x);
console.log("push2(35):", s.push2(35));   // now the array really is full
console.log("pop1:", s.pop1());
console.log("pop1:", s.pop1());
console.log("pop2:", s.pop2());
console.log("pop2:", s.pop2());
console.log("size1:", s.size1());
console.log("size2:", s.size2());
```

```text filename:Output
push1(20): true
push2(35): false
pop1: 20
pop1: 15
pop2: 30
pop2: 25
size1: 2
size2: 0
```

Time O(1) per operation · Space O(n) for the shared array

> [!WARNING] Pitfall
>
> The full test is `top1 + 1 == top2`, not `top1 == top2`. With `top1 = -1` and `top2 = n` the gap between them is exactly the number of free slots; when it reaches zero the tops are adjacent, never equal.

# Implement k stacks in one array

> [!TIP] Example
>
> <strong>Input:</strong> `n = 10, k = 3; push(15, 0), push(45, 1), push(17, 0), push(39, 1), push(11, 2)`<br><strong>Output:</strong> `pop(0) → 17, pop(1) → 39, pop(2) → 11, pop(0) → 15`

The two-ends trick does not extend to three or more stacks. The general solution threads <strong>linked lists through the array</strong>: every stack is a linked list of slots, and the unused slots form one more linked list, the <em>free list</em>. Three small arrays do all the bookkeeping.

| Array / variable | Size | Meaning |
| --- | --- | --- |
| `arr[n]` | `n` | the stored values |
| `top[k]` | `k` | `top[sn]` = index of the top slot of stack `sn`; `-1` when that stack is empty |
| `next[n]` | `n` | for a used slot: index of the slot <em>below</em> it in its stack; for a free slot: index of the next free slot (`-1` = none) |
| `free` | 1 | index of the first free slot — the top of the free list |

> [!NOTE] Idea
>
> `push(x, sn)` takes the slot `i = free` off the free list (`free = next[i]`), stores `x` there and links it on top of stack `sn` (`next[i] = top[sn]; top[sn] = i`). `pop(sn)` does the reverse: unlink `i = top[sn]` (`top[sn] = next[i]`) and give the slot back (`next[i] = free; free = i`). The array is full exactly when `free == -1`, regardless of how the stacks share it.

```text filename:Every%20stack%20is%20a%20linked%20list%20of%20array%20slots%3B%20%60next%5B%5D%60%20doubles%20as%20the%20free%20list
after push(15,0) push(45,1) push(17,0) push(39,1) push(11,2)   with n = 10, k = 3

index :  0    1    2    3    4    5    6    7    8    9
arr   : 15   45   17   39   11    _    _    _    _    _
next  : -1   -1    0    1   -1    6    7    8    9   -1
         ↑         ↑    ↑    ↑         └── free list: 5 → 6 → 7 → 8 → 9 → -1
         └─────────┘    │    └─ stack 2: 11                      free = 5
         stack 0: 17 → 15    stack 1: 39 → 45          top = [2, 3, 4]
```

```python filename:Python
class KStacks:
    def __init__(self, n, k):
        self.arr = [None] * n
        self.top = [-1] * k                     # top[sn] = index of the top of stack sn
        self.next = [i + 1 for i in range(n)]   # free list: slot i → slot i+1
        self.next[n - 1] = -1
        self.free = 0                           # first free slot

    def is_full(self):
        return self.free == -1

    def is_empty(self, sn):
        return self.top[sn] == -1

    def push(self, x, sn):
        if self.is_full():
            return False
        i = self.free
        self.free = self.next[i]        # take the slot off the free list
        self.arr[i] = x
        self.next[i] = self.top[sn]     # link it above the old top of stack sn
        self.top[sn] = i
        return True

    def pop(self, sn):
        if self.is_empty(sn):
            return None
        i = self.top[sn]
        self.top[sn] = self.next[i]     # unlink the top slot
        self.next[i] = self.free        # give it back to the free list
        self.free = i
        return self.arr[i]

s = KStacks(10, 3)
for x, sn in ((15, 0), (45, 1), (17, 0), (39, 1), (11, 2)):
    s.push(x, sn)
print("pop(0):", s.pop(0))
print("pop(1):", s.pop(1))
print("pop(2):", s.pop(2))
print("pop(0):", s.pop(0))
print("empty(2):", "true" if s.is_empty(2) else "false")
print("empty(0):", "true" if s.is_empty(0) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

class KStacks {
    vector<int> arr, top, nxt;
    int freeTop;
public:
    KStacks(int n, int k) : arr(n), top(k, -1), nxt(n), freeTop(0) {
        for (int i = 0; i < n; i++) nxt[i] = i + 1;   // free list: slot i → slot i+1
        nxt[n - 1] = -1;
    }
    bool isFull() const { return freeTop == -1; }
    bool isEmpty(int sn) const { return top[sn] == -1; }
    bool push(int x, int sn) {
        if (isFull()) return false;
        int i = freeTop;
        freeTop = nxt[i];          // take the slot off the free list
        arr[i] = x;
        nxt[i] = top[sn];          // link it above the old top of stack sn
        top[sn] = i;
        return true;
    }
    int pop(int sn) {
        if (isEmpty(sn)) return -1;
        int i = top[sn];
        top[sn] = nxt[i];          // unlink the top slot
        nxt[i] = freeTop;          // give it back to the free list
        freeTop = i;
        return arr[i];
    }
};

int main() {
    KStacks s(10, 3);
    int xs[] = {15, 45, 17, 39, 11}, sns[] = {0, 1, 0, 1, 2};
    for (int i = 0; i < 5; i++) s.push(xs[i], sns[i]);
    cout << "pop(0): " << s.pop(0) << "\n";
    cout << "pop(1): " << s.pop(1) << "\n";
    cout << "pop(2): " << s.pop(2) << "\n";
    cout << "pop(0): " << s.pop(0) << "\n";
    cout << "empty(2): " << (s.isEmpty(2) ? "true" : "false") << "\n";
    cout << "empty(0): " << (s.isEmpty(0) ? "true" : "false") << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static class KStacks {
        int[] arr, top, next;
        int free;
        KStacks(int n, int k) {
            arr = new int[n];
            top = new int[k];
            Arrays.fill(top, -1);
            next = new int[n];
            for (int i = 0; i < n; i++) next[i] = i + 1;   // free list: slot i → slot i+1
            next[n - 1] = -1;
            free = 0;
        }
        boolean isFull() { return free == -1; }
        boolean isEmpty(int sn) { return top[sn] == -1; }
        boolean push(int x, int sn) {
            if (isFull()) return false;
            int i = free;
            free = next[i];            // take the slot off the free list
            arr[i] = x;
            next[i] = top[sn];         // link it above the old top of stack sn
            top[sn] = i;
            return true;
        }
        int pop(int sn) {
            if (isEmpty(sn)) return -1;
            int i = top[sn];
            top[sn] = next[i];         // unlink the top slot
            next[i] = free;            // give it back to the free list
            free = i;
            return arr[i];
        }
    }

    public static void main(String[] args) {
        KStacks s = new KStacks(10, 3);
        int[] xs = {15, 45, 17, 39, 11}, sns = {0, 1, 0, 1, 2};
        for (int i = 0; i < 5; i++) s.push(xs[i], sns[i]);
        System.out.println("pop(0): " + s.pop(0));
        System.out.println("pop(1): " + s.pop(1));
        System.out.println("pop(2): " + s.pop(2));
        System.out.println("pop(0): " + s.pop(0));
        System.out.println("empty(2): " + s.isEmpty(2));
        System.out.println("empty(0): " + s.isEmpty(0));
    }
}
```

```javascript filename:JavaScript
class KStacks {
    constructor(n, k) {
        this.arr = new Array(n);
        this.top = new Array(k).fill(-1);                 // top[sn] = index of the top of stack sn
        this.next = Array.from({ length: n }, (_, i) => i + 1);   // free list: slot i → slot i+1
        this.next[n - 1] = -1;
        this.free = 0;                                    // first free slot
    }
    isFull() { return this.free === -1; }
    isEmpty(sn) { return this.top[sn] === -1; }
    push(x, sn) {
        if (this.isFull()) return false;
        const i = this.free;
        this.free = this.next[i];        // take the slot off the free list
        this.arr[i] = x;
        this.next[i] = this.top[sn];     // link it above the old top of stack sn
        this.top[sn] = i;
        return true;
    }
    pop(sn) {
        if (this.isEmpty(sn)) return null;
        const i = this.top[sn];
        this.top[sn] = this.next[i];     // unlink the top slot
        this.next[i] = this.free;        // give it back to the free list
        this.free = i;
        return this.arr[i];
    }
}

const s = new KStacks(10, 3);
for (const [x, sn] of [[15, 0], [45, 1], [17, 0], [39, 1], [11, 2]]) s.push(x, sn);
console.log("pop(0):", s.pop(0));
console.log("pop(1):", s.pop(1));
console.log("pop(2):", s.pop(2));
console.log("pop(0):", s.pop(0));
console.log("empty(2):", s.isEmpty(2));
console.log("empty(0):", s.isEmpty(0));
```

```text filename:Output
pop(0): 17
pop(1): 39
pop(2): 11
pop(0): 15
empty(2): true
empty(0): true
```

Time O(1) per operation · Space O(n + k) — `arr` and `next` of size n, `top` of size k

> [!NOTE] Key point
>
> `next[]` plays two roles: inside a stack it points <em>down</em> to the element below; inside the free list it points to the <em>next free slot</em>. A slot is in exactly one of the two at any moment, so one array suffices. This is exactly how a memory allocator keeps its free blocks.

# Stock span problem

> [!TIP] Example
>
> <strong>Input:</strong> `price = [13, 15, 12, 14, 16, 8, 6, 4, 10, 30]`<br><strong>Output:</strong> `1 2 1 2 5 1 1 1 4 10`

The <strong>span</strong> of a stock's price on day `i` is the number of consecutive days ending at `i` (including `i`) on which the price was less than or equal to `price[i]`. Day 4 (price 16) has span 5 because all of 13, 15, 12, 14 are below 16; day 8 (price 10) has span 4 because 8, 6, 4 are below it but 16 stops the run.

```python filename:Naive%20%E2%80%94%20O(n%C2%B2)%3A%20for%20each%20day%20walk%20back%20until%20a%20higher%20price
def stock_span_naive(price):
    span = []
    for i in range(len(price)):
        j = i - 1
        while j >= 0 and price[j] <= price[i]:   # walk back while prices are not higher
            j -= 1
        span.append(i - j)
    return span

print(*stock_span_naive([13, 15, 12, 14, 16, 8, 6, 4, 10, 30]))
```

```text filename:Output
1 2 1 2 5 1 1 1 4 10
```

> [!NOTE] Idea
>
> `span[i] = i − (index of the previous greater element)`, or `i + 1` if there is none. So this is the <strong>previous greater</strong> variant of the monotonic stack with <em>indices</em> on the stack: pop every index whose price is `<= price[i]`, read the index left on top, push `i`.

```python filename:Python
def stock_span(price):
    st = []                      # indices; prices strictly decreasing bottom → top
    span = [0] * len(price)
    for i in range(len(price)):
        while st and price[st[-1]] <= price[i]:   # those days can never be a previous greater again
            st.pop()
        span[i] = i + 1 if not st else i - st[-1]
        st.append(i)
    return span

print(*stock_span([13, 15, 12, 14, 16, 8, 6, 4, 10, 30]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
#include <vector>
using namespace std;

vector<int> stockSpan(const vector<int>& price) {
    int n = price.size();
    vector<int> span(n);
    stack<int> st;               // indices; prices strictly decreasing bottom → top
    for (int i = 0; i < n; i++) {
        while (!st.empty() && price[st.top()] <= price[i]) st.pop();   // dead candidates
        span[i] = st.empty() ? i + 1 : i - st.top();
        st.push(i);
    }
    return span;
}

int main() {
    vector<int> price = {13, 15, 12, 14, 16, 8, 6, 4, 10, 30};
    for (int s : stockSpan(price)) cout << s << " ";
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int[] stockSpan(int[] price) {
        int n = price.length;
        int[] span = new int[n];
        Deque<Integer> st = new ArrayDeque<>();   // indices; prices strictly decreasing bottom → top
        for (int i = 0; i < n; i++) {
            while (!st.isEmpty() && price[st.peek()] <= price[i]) st.pop();   // dead candidates
            span[i] = st.isEmpty() ? i + 1 : i - st.peek();
            st.push(i);
        }
        return span;
    }

    public static void main(String[] args) {
        int[] price = {13, 15, 12, 14, 16, 8, 6, 4, 10, 30};
        StringBuilder sb = new StringBuilder();
        for (int s : stockSpan(price)) sb.append(s).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
function stockSpan(price) {
    const st = [];               // indices; prices strictly decreasing bottom → top
    const span = new Array(price.length);
    for (let i = 0; i < price.length; i++) {
        while (st.length && price[st[st.length - 1]] <= price[i]) st.pop();   // dead candidates
        span[i] = st.length === 0 ? i + 1 : i - st[st.length - 1];
        st.push(i);
    }
    return span;
}

console.log(stockSpan([13, 15, 12, 14, 16, 8, 6, 4, 10, 30]).join(" "));
```

```text filename:Output
1 2 1 2 5 1 1 1 4 10
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> Pop on `<=`, not `<`. An earlier day with the <em>same</em> price cannot stop the span (the definition says <em>less than or equal</em>), so it must not survive on the stack. The strictness of the comparison is the detail that changes between the five monotonic-stack problems — decide it from the problem statement every time.

# Previous greater element

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [15, 10, 18, 12, 4, 6, 2, 8]`<br><strong>Output:</strong> `-1 15 -1 18 12 12 6 12`

For every element, the nearest element to its <strong>left</strong> that is strictly greater; `-1` if there is none. This is the pattern from the overview section in its purest form — the trace table above is exactly this input.

```python filename:Naive%20%E2%80%94%20O(n%C2%B2)
def previous_greater_naive(arr):
    res = []
    for i in range(len(arr)):
        pg = -1
        for j in range(i - 1, -1, -1):     # scan left until something bigger
            if arr[j] > arr[i]:
                pg = arr[j]
                break
        res.append(pg)
    return res

print(*previous_greater_naive([15, 10, 18, 12, 4, 6, 2, 8]))
```

```text filename:Output
-1 15 -1 18 12 12 6 12
```

> [!NOTE] Idea
>
> Left-to-right scan, values on the stack, pop while `top <= arr[i]`. After the pops the top (if any) is the nearest greater element to the left — everything between it and `i` was smaller than `arr[i]` and has been discarded.

```python filename:Python
def previous_greater(arr):
    st = []                           # values; strictly decreasing bottom → top
    res = []
    for x in arr:
        while st and st[-1] <= x:     # smaller-or-equal elements can never be an answer again
            st.pop()
        res.append(-1 if not st else st[-1])
        st.append(x)
    return res

print(*previous_greater([15, 10, 18, 12, 4, 6, 2, 8]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
#include <vector>
using namespace std;

vector<int> previousGreater(const vector<int>& arr) {
    stack<int> st;                    // values; strictly decreasing bottom → top
    vector<int> res;
    for (int x : arr) {
        while (!st.empty() && st.top() <= x) st.pop();   // can never be an answer again
        res.push_back(st.empty() ? -1 : st.top());
        st.push(x);
    }
    return res;
}

int main() {
    for (int v : previousGreater({15, 10, 18, 12, 4, 6, 2, 8})) cout << v << " ";
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int[] previousGreater(int[] arr) {
        Deque<Integer> st = new ArrayDeque<>();   // values; strictly decreasing bottom → top
        int[] res = new int[arr.length];
        for (int i = 0; i < arr.length; i++) {
            while (!st.isEmpty() && st.peek() <= arr[i]) st.pop();   // can never be an answer again
            res[i] = st.isEmpty() ? -1 : st.peek();
            st.push(arr[i]);
        }
        return res;
    }

    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int v : previousGreater(new int[]{15, 10, 18, 12, 4, 6, 2, 8})) sb.append(v).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
function previousGreater(arr) {
    const st = [];                    // values; strictly decreasing bottom → top
    const res = [];
    for (const x of arr) {
        while (st.length && st[st.length - 1] <= x) st.pop();   // can never be an answer again
        res.push(st.length === 0 ? -1 : st[st.length - 1]);
        st.push(x);
    }
    return res;
}

console.log(previousGreater([15, 10, 18, 12, 4, 6, 2, 8]).join(" "));
```

```text filename:Output
-1 15 -1 18 12 12 6 12
```

Time O(n) · Space O(n)

# Next greater element

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [5, 15, 10, 8, 12, 7]`<br><strong>Output:</strong> `15 -1 12 12 -1 -1`

Mirror image: for every element, the nearest <strong>strictly greater</strong> element to its <strong>right</strong>, `-1` if none. (The original notes listed seven answers for six inputs — the correct output has one answer per element.)

```python filename:Naive%20%E2%80%94%20O(n%C2%B2)
def next_greater_naive(arr):
    res = []
    for i in range(len(arr)):
        ng = -1
        for j in range(i + 1, len(arr)):
            if arr[j] > arr[i]:
                ng = arr[j]
                break
        res.append(ng)
    return res

print(*next_greater_naive([5, 15, 10, 8, 12, 7]))
```

```text filename:Output
15 -1 12 12 -1 -1
```

> [!NOTE] Idea
>
> Run the previous-greater algorithm <strong>from right to left</strong>: when the scan reaches `i`, the stack holds exactly the elements to its right that are still candidates, so after popping the `<= arr[i]` ones, the top is the next greater. Fill `res[i]` in reverse and print in order.

```python filename:Python
def next_greater(arr):
    n = len(arr)
    st = []                           # values to the right of i; strictly decreasing bottom → top
    res = [-1] * n
    for i in range(n - 1, -1, -1):    # right to left
        while st and st[-1] <= arr[i]:
            st.pop()
        res[i] = -1 if not st else st[-1]
        st.append(arr[i])
    return res

print(*next_greater([5, 15, 10, 8, 12, 7]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
#include <vector>
using namespace std;

vector<int> nextGreater(const vector<int>& arr) {
    int n = arr.size();
    stack<int> st;                    // values to the right of i; strictly decreasing bottom → top
    vector<int> res(n, -1);
    for (int i = n - 1; i >= 0; i--) {          // right to left
        while (!st.empty() && st.top() <= arr[i]) st.pop();
        res[i] = st.empty() ? -1 : st.top();
        st.push(arr[i]);
    }
    return res;
}

int main() {
    for (int v : nextGreater({5, 15, 10, 8, 12, 7})) cout << v << " ";
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int[] nextGreater(int[] arr) {
        int n = arr.length;
        Deque<Integer> st = new ArrayDeque<>();   // values to the right of i; strictly decreasing
        int[] res = new int[n];
        for (int i = n - 1; i >= 0; i--) {        // right to left
            while (!st.isEmpty() && st.peek() <= arr[i]) st.pop();
            res[i] = st.isEmpty() ? -1 : st.peek();
            st.push(arr[i]);
        }
        return res;
    }

    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int v : nextGreater(new int[]{5, 15, 10, 8, 12, 7})) sb.append(v).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
function nextGreater(arr) {
    const n = arr.length;
    const st = [];                    // values to the right of i; strictly decreasing bottom → top
    const res = new Array(n).fill(-1);
    for (let i = n - 1; i >= 0; i--) {            // right to left
        while (st.length && st[st.length - 1] <= arr[i]) st.pop();
        res[i] = st.length === 0 ? -1 : st[st.length - 1];
        st.push(arr[i]);
    }
    return res;
}

console.log(nextGreater([5, 15, 10, 8, 12, 7]).join(" "));
```

```text filename:Output
15 -1 12 12 -1 -1
```

Time O(n) · Space O(n)

> [!NOTE] Key point
>
> <strong>Left-to-right alternative.</strong> Keep <em>indices</em> on the stack and scan forwards; when `arr[i]` pops an index `j`, you have just discovered that `arr[i]` is the next greater of `arr[j]`, so set `res[j] = arr[i]`. Whatever remains on the stack at the end gets `-1`. Same complexity; this version is the one to use when the input arrives as a stream and cannot be scanned backwards.

# Largest rectangular area in a histogram

> [!TIP] Example
>
> <strong>Input:</strong> `heights = [6, 2, 5, 4, 1, 5, 6]`<br><strong>Output:</strong> `10`

```text filename:Bars%20of%20width%201%3B%20the%20best%20rectangle%20spans%20the%20last%20two%20bars%20at%20height%205%20(area%2010)
             ■                  ■
■            ■               ■  ■
■      ■     ■               ■  ■
■      ■  ■  ■               ■  ■
■  ■   ■  ■  ■               ■  ■
■  ■   ■  ■  ■   ■           ■  ■       largest rectangle: height 5 over bars 5,6 → 10
6  2   5  4  1   5  6
```

Every bar is the <em>shortest bar</em> of exactly one maximal rectangle: the one that extends from the previous smaller bar to the next smaller bar. So the answer is `max over i of heights[i] × (nextSmaller[i] − prevSmaller[i] − 1)`. The problem is finding both boundaries fast — which is the monotonic stack again, this time the <strong>smaller</strong> variants.

```python filename:Naive%20%E2%80%94%20O(n%C2%B2)%3A%20for%20every%20bar%2C%20extend%20left%20and%20right%20while%20the%20bars%20stay%20at%20least%20as%20tall
def max_area_naive(h):
    best = 0
    for i in range(len(h)):
        width = 1
        j = i - 1
        while j >= 0 and h[j] >= h[i]:      # extend left while bars are at least as tall
            width += 1
            j -= 1
        j = i + 1
        while j < len(h) and h[j] >= h[i]:  # extend right
            width += 1
            j += 1
        best = max(best, h[i] * width)
    return best

print(max_area_naive([6, 2, 5, 4, 1, 5, 6]))
```

```text filename:Output
10
```

```python filename:Better%20%E2%80%94%20O(n)%20with%20two%20monotonic-stack%20passes%20(previous%20smaller%2C%20next%20smaller)
def prev_smaller(h):
    st, res = [], [-1] * len(h)
    for i in range(len(h)):
        while st and h[st[-1]] >= h[i]:
            st.pop()
        res[i] = st[-1] if st else -1          # -1 = no smaller bar on the left
        st.append(i)
    return res

def next_smaller(h):
    n = len(h)
    st, res = [], [n] * n
    for i in range(n - 1, -1, -1):
        while st and h[st[-1]] >= h[i]:
            st.pop()
        res[i] = st[-1] if st else n           # n = no smaller bar on the right
        st.append(i)
    return res

def max_area_two_pass(h):
    ps, ns = prev_smaller(h), next_smaller(h)
    return max(h[i] * (ns[i] - ps[i] - 1) for i in range(len(h)))

h = [6, 2, 5, 4, 1, 5, 6]
print(*prev_smaller(h))
print(*next_smaller(h))
print(max_area_two_pass(h))
```

```text filename:Output
-1 -1 1 1 -1 4 5
1 4 3 4 7 7 7
10
```

> [!NOTE] Idea
>
> <strong>One pass.</strong> Keep indices on a stack with heights <em>increasing</em> bottom to top. When `heights[i]` is smaller than the top, the top bar's rectangle ends here: `i` is its next smaller, and the index beneath it on the stack is its previous smaller, so its area is `heights[top] × (i − below − 1)`. Pop it and repeat. After the scan, treat a bar of height `0` at index `n` as the final element so every remaining bar is popped and measured.

```python filename:Python
def max_histogram_area(h):
    n = len(h)
    st = []                     # indices; heights increasing bottom → top
    best = 0
    for i in range(n + 1):
        cur = h[i] if i < n else 0            # a 0-high bar at the end flushes the stack
        while st and h[st[-1]] >= cur:
            top = st.pop()                    # i is the next smaller of bar `top`
            left = st[-1] if st else -1       # the bar below is its previous smaller
            best = max(best, h[top] * (i - left - 1))
        st.append(i)
    return best

print(max_histogram_area([6, 2, 5, 4, 1, 5, 6]))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <stack>
#include <vector>
using namespace std;

int maxHistogramArea(const vector<int>& h) {
    int n = h.size();
    stack<int> st;              // indices; heights increasing bottom → top
    int best = 0;
    for (int i = 0; i <= n; i++) {
        int cur = i < n ? h[i] : 0;           // a 0-high bar at the end flushes the stack
        while (!st.empty() && h[st.top()] >= cur) {
            int top = st.top(); st.pop();     // i is the next smaller of bar `top`
            int left = st.empty() ? -1 : st.top();   // the bar below is its previous smaller
            best = max(best, h[top] * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}

int main() {
    cout << maxHistogramArea({6, 2, 5, 4, 1, 5, 6}) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int maxHistogramArea(int[] h) {
        int n = h.length;
        Deque<Integer> st = new ArrayDeque<>();   // indices; heights increasing bottom → top
        int best = 0;
        for (int i = 0; i <= n; i++) {
            int cur = i < n ? h[i] : 0;           // a 0-high bar at the end flushes the stack
            while (!st.isEmpty() && h[st.peek()] >= cur) {
                int top = st.pop();               // i is the next smaller of bar `top`
                int left = st.isEmpty() ? -1 : st.peek();   // the bar below is its previous smaller
                best = Math.max(best, h[top] * (i - left - 1));
            }
            st.push(i);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(maxHistogramArea(new int[]{6, 2, 5, 4, 1, 5, 6}));
    }
}
```

```javascript filename:JavaScript
function maxHistogramArea(h) {
    const n = h.length;
    const st = [];              // indices; heights increasing bottom → top
    let best = 0;
    for (let i = 0; i <= n; i++) {
        const cur = i < n ? h[i] : 0;             // a 0-high bar at the end flushes the stack
        while (st.length && h[st[st.length - 1]] >= cur) {
            const top = st.pop();                 // i is the next smaller of bar `top`
            const left = st.length ? st[st.length - 1] : -1;   // the bar below is its previous smaller
            best = Math.max(best, h[top] * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}

console.log(maxHistogramArea([6, 2, 5, 4, 1, 5, 6]));
```

```text filename:Output
10
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> Two off-by-one traps. The width is `i − left − 1` (the bars strictly between the two smaller ones), and when the stack is empty after the pop, `left` must be `−1`, not `0`. Test on a strictly increasing input such as `[1, 2, 3]` (answer 4) where nothing is popped until the sentinel.

> [!NOTE] Key point
>
> Popping on `>=` (equal heights too) is safe: when two bars have the same height the one popped first gets a width that is too small, but the last one of the run extends over all of them and reports the full rectangle.

# Largest rectangle with all 1s in a binary matrix

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[0,1,1,0], [1,1,1,1], [1,1,1,1], [1,1,0,0]]`<br><strong>Output:</strong> `8`

<strong>Naive:</strong> take every cell as a top-left corner, try every width and height, check that the rectangle contains only 1s — `O(R³C³)` or `O(R²C²)` with prefix sums. The efficient solution reuses the histogram algorithm row by row.

> [!NOTE] Idea
>
> Treat each row as the <strong>base of a histogram</strong>: `height[j]` is the number of consecutive 1s ending at the current row in column `j` (`0` if the cell is `0`). A rectangle of 1s whose bottom edge is on this row is exactly a rectangle under that histogram, so `maxHistogramArea(height)` for every row — keeping the best — is the answer.

```text filename:Each%20row's%20heights%20form%20a%20histogram%3B%20the%20maximum%20over%20all%20rows%20is%208
matrix          height[] after each row        best histogram area
0 1 1 0         0 1 1 0                        2
1 1 1 1         1 2 2 1                        4
1 1 1 1         2 3 3 2                        8   ← 4 columns × height 2
1 1 0 0         3 4 0 0                        6
```

```python filename:Python
def max_histogram_area(h):
    st, best = [], 0
    for i in range(len(h) + 1):
        cur = h[i] if i < len(h) else 0
        while st and h[st[-1]] >= cur:
            top = st.pop()
            left = st[-1] if st else -1
            best = max(best, h[top] * (i - left - 1))
        st.append(i)
    return best

def max_rectangle_of_ones(mat):
    if not mat:
        return 0
    cols = len(mat[0])
    height = [0] * cols
    best = 0
    for row in mat:
        for j in range(cols):
            height[j] = height[j] + 1 if row[j] == 1 else 0   # grow the bar or reset it
        best = max(best, max_histogram_area(height))          # best rectangle ending on this row
    return best

mat = [[0, 1, 1, 0],
       [1, 1, 1, 1],
       [1, 1, 1, 1],
       [1, 1, 0, 0]]
print(max_rectangle_of_ones(mat))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <stack>
#include <vector>
using namespace std;

int maxHistogramArea(const vector<int>& h) {
    int n = h.size(), best = 0;
    stack<int> st;
    for (int i = 0; i <= n; i++) {
        int cur = i < n ? h[i] : 0;
        while (!st.empty() && h[st.top()] >= cur) {
            int top = st.top(); st.pop();
            int left = st.empty() ? -1 : st.top();
            best = max(best, h[top] * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}

int maxRectangleOfOnes(const vector<vector<int>>& mat) {
    if (mat.empty()) return 0;
    int cols = mat[0].size(), best = 0;
    vector<int> height(cols, 0);
    for (const auto& row : mat) {
        for (int j = 0; j < cols; j++)
            height[j] = row[j] == 1 ? height[j] + 1 : 0;      // grow the bar or reset it
        best = max(best, maxHistogramArea(height));           // best rectangle ending on this row
    }
    return best;
}

int main() {
    vector<vector<int>> mat = {{0, 1, 1, 0},
                               {1, 1, 1, 1},
                               {1, 1, 1, 1},
                               {1, 1, 0, 0}};
    cout << maxRectangleOfOnes(mat) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int maxHistogramArea(int[] h) {
        int n = h.length, best = 0;
        Deque<Integer> st = new ArrayDeque<>();
        for (int i = 0; i <= n; i++) {
            int cur = i < n ? h[i] : 0;
            while (!st.isEmpty() && h[st.peek()] >= cur) {
                int top = st.pop();
                int left = st.isEmpty() ? -1 : st.peek();
                best = Math.max(best, h[top] * (i - left - 1));
            }
            st.push(i);
        }
        return best;
    }

    static int maxRectangleOfOnes(int[][] mat) {
        if (mat.length == 0) return 0;
        int cols = mat[0].length, best = 0;
        int[] height = new int[cols];
        for (int[] row : mat) {
            for (int j = 0; j < cols; j++)
                height[j] = row[j] == 1 ? height[j] + 1 : 0;   // grow the bar or reset it
            best = Math.max(best, maxHistogramArea(height));   // best rectangle ending on this row
        }
        return best;
    }

    public static void main(String[] args) {
        int[][] mat = {{0, 1, 1, 0},
                       {1, 1, 1, 1},
                       {1, 1, 1, 1},
                       {1, 1, 0, 0}};
        System.out.println(maxRectangleOfOnes(mat));
    }
}
```

```javascript filename:JavaScript
function maxHistogramArea(h) {
    const st = [];
    let best = 0;
    for (let i = 0; i <= h.length; i++) {
        const cur = i < h.length ? h[i] : 0;
        while (st.length && h[st[st.length - 1]] >= cur) {
            const top = st.pop();
            const left = st.length ? st[st.length - 1] : -1;
            best = Math.max(best, h[top] * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}

function maxRectangleOfOnes(mat) {
    if (mat.length === 0) return 0;
    const cols = mat[0].length;
    const height = new Array(cols).fill(0);
    let best = 0;
    for (const row of mat) {
        for (let j = 0; j < cols; j++)
            height[j] = row[j] === 1 ? height[j] + 1 : 0;      // grow the bar or reset it
        best = Math.max(best, maxHistogramArea(height));       // best rectangle ending on this row
    }
    return best;
}

const mat = [[0, 1, 1, 0],
             [1, 1, 1, 1],
             [1, 1, 1, 1],
             [1, 1, 0, 0]];
console.log(maxRectangleOfOnes(mat));
```

```text filename:Output
8
```

Time O(R × C) · Space O(C) for the height array (plus the stack)

> [!WARNING] Pitfall
>
> Reset `height[j]` to `0` on a `0` cell — do not just skip it. A column that keeps its old height after a `0` would let a rectangle <em>jump over</em> the gap. The original notes' second version modified the matrix in place (`mat[i][j] += mat[i-1][j]`), which also works but destroys the input; a separate `height` array is the cleaner habit.

# Design a stack with getMin() in O(1) — auxiliary stack

> [!TIP] Example
>
> <strong>Input:</strong> `push(20), push(10), getMin(), push(5), getMin(), pop(), getMin(), pop(), getMin()`<br><strong>Output:</strong> `10 5 10 20`

<strong>Naive:</strong> keep an ordinary stack and compute `min(stack)` on demand — `getMin()` becomes `O(n)`. The requirement is `O(1)` for <em>every</em> operation including `getMin()`.

> [!NOTE] Idea
>
> Keep a second stack `mins` in lock-step with the main one: `mins[i]` is the minimum of the main stack's bottom `i + 1` elements. On `push(x)` push `min(x, mins.top)`; on `pop()` pop both. `getMin()` is simply `mins.top`. Because the two stacks always have the same height, popping the main stack automatically <em>un-does</em> the minimum that element introduced.

```text filename:mins%5Bi%5D%20always%20equals%20the%20minimum%20of%20main%5B0..i%5D
operation    main stack       mins stack      getMin()
push(20)     [20]             [20]            20
push(10)     [20, 10]         [20, 10]        10
push(5)      [20, 10, 5]      [20, 10, 5]     5
push(12)     [20, 10, 5, 12]  [20, 10, 5, 5]  5     ← 12 does not lower the min, so 5 is repeated
pop()        [20, 10, 5]      [20, 10, 5]     5
pop()        [20, 10]         [20, 10]        10
```

```python filename:Python
class MinStack:
    def __init__(self):
        self.main = []
        self.mins = []               # mins[i] = min of main[0..i]

    def push(self, x):
        self.main.append(x)
        self.mins.append(x if not self.mins else min(x, self.mins[-1]))

    def pop(self):
        self.mins.pop()              # the two stacks always move together
        return self.main.pop()

    def top(self):
        return self.main[-1]

    def get_min(self):
        return self.mins[-1]

s = MinStack()
s.push(20)
s.push(10)
print("getMin:", s.get_min())
s.push(5)
print("getMin:", s.get_min())
print("pop:", s.pop())
print("getMin:", s.get_min())
print("pop:", s.pop())
print("getMin:", s.get_min())
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <stack>
using namespace std;

class MinStack {
    stack<int> main_, mins;      // mins.top() = min of everything in main_
public:
    void push(int x) {
        main_.push(x);
        mins.push(mins.empty() ? x : min(x, mins.top()));
    }
    int pop() {
        int x = main_.top();
        main_.pop();
        mins.pop();              // the two stacks always move together
        return x;
    }
    int top() const { return main_.top(); }
    int getMin() const { return mins.top(); }
};

int main() {
    MinStack s;
    s.push(20);
    s.push(10);
    cout << "getMin: " << s.getMin() << "\n";
    s.push(5);
    cout << "getMin: " << s.getMin() << "\n";
    cout << "pop: " << s.pop() << "\n";
    cout << "getMin: " << s.getMin() << "\n";
    cout << "pop: " << s.pop() << "\n";
    cout << "getMin: " << s.getMin() << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static class MinStack {
        Deque<Integer> main = new ArrayDeque<>();
        Deque<Integer> mins = new ArrayDeque<>();   // mins.peek() = min of everything in main
        void push(int x) {
            main.push(x);
            mins.push(mins.isEmpty() ? x : Math.min(x, mins.peek()));
        }
        int pop() {
            mins.pop();                              // the two stacks always move together
            return main.pop();
        }
        int top() { return main.peek(); }
        int getMin() { return mins.peek(); }
    }

    public static void main(String[] args) {
        MinStack s = new MinStack();
        s.push(20);
        s.push(10);
        System.out.println("getMin: " + s.getMin());
        s.push(5);
        System.out.println("getMin: " + s.getMin());
        System.out.println("pop: " + s.pop());
        System.out.println("getMin: " + s.getMin());
        System.out.println("pop: " + s.pop());
        System.out.println("getMin: " + s.getMin());
    }
}
```

```javascript filename:JavaScript
class MinStack {
    constructor() {
        this.main = [];
        this.mins = [];              // mins[i] = min of main[0..i]
    }
    push(x) {
        this.main.push(x);
        this.mins.push(this.mins.length ? Math.min(x, this.mins[this.mins.length - 1]) : x);
    }
    pop() {
        this.mins.pop();             // the two stacks always move together
        return this.main.pop();
    }
    top() { return this.main[this.main.length - 1]; }
    getMin() { return this.mins[this.mins.length - 1]; }
}

const s = new MinStack();
s.push(20);
s.push(10);
console.log("getMin:", s.getMin());
s.push(5);
console.log("getMin:", s.getMin());
console.log("pop:", s.pop());
console.log("getMin:", s.getMin());
console.log("pop:", s.pop());
console.log("getMin:", s.getMin());
```

```text filename:Output
getMin: 10
getMin: 5
pop: 5
getMin: 10
pop: 10
getMin: 20
```

Time O(1) per operation · Space O(n) extra for the mins stack

> [!NOTE] Key point
>
> A common space saving: push onto `mins` only when `x <= mins.top`, and pop from `mins` only when the popped value equals `mins.top`. Worst case it is still `O(n)` extra (a decreasing sequence), but on typical data the auxiliary stack stays short. The `<=` matters — with `<`, popping one of two equal minimums would wrongly remove the record.

# Design a stack with getMin() in O(1) extra space

> [!TIP] Example
>
> <strong>Input:</strong> `push(20), push(10), getMin(), push(5), getMin(), pop(), getMin(), pop(), getMin()`<br><strong>Output:</strong> `10 5 10 20`<br><strong>Input:</strong> `push(-2), push(0), push(-3), getMin(), pop(), getMin()`<br><strong>Output:</strong> `-3 -2`

The auxiliary stack stores one number per element. Can we do it with a <strong>single extra variable</strong> `minEle`? Yes — by storing an <em>encoded</em> value instead of `x` whenever `x` becomes the new minimum. The encoded value remembers the <em>previous</em> minimum, so `pop()` can restore it.

> [!NOTE] Idea
>
> Invariant: `minEle` is the current minimum, and an element sits in the stack as its real value unless it was a new minimum when pushed — then it is stored as `2x − minEle_old`, which is <strong>less than </strong><strong>`x`</strong> (because `x < minEle_old`) and hence less than the new `minEle = x`. So a stored value <em>below</em> `minEle` is a flag meaning <em>this element is the current minimum</em>; its real value is `minEle`, and the previous minimum is recovered as `2·minEle − stored`.

| Operation | Condition | Do |
| --- | --- | --- |
| `push(x)` | stack empty | push `x`; `minEle = x` |
| `push(x)` | `x >= minEle` | push `x` as is |
| `push(x)` | `x < minEle` | push `2x − minEle` (encoded); `minEle = x` |
| `pop()` | `top >= minEle` | return `top` |
| `pop()` | `top < minEle` | the real value is `minEle`; restore `minEle = 2·minEle − top`; return the old `minEle` |
| `top()` | `top < minEle` | return `minEle`, else the stored value |
| `getMin()` | — | return `minEle` |

```text filename:The%20encoded%20entries%20(here%20both%200)%20are%20below%20minEle%2C%20which%20marks%20them%20as%20'I%20am%20the%20minimum'
operation   stored stack     minEle   note
push(20)    [20]             20
push(10)    [20, 0]          10       10 < 20 → store 2·10 − 20 = 0
push(5)     [20, 0, 0]       5        5 < 10  → store 2·5 − 10 = 0
pop()       [20, 0]          10       top 0 < minEle 5 → real value 5; minEle = 2·5 − 0 = 10
pop()       [20]             20       top 0 < minEle 10 → real value 10; minEle = 2·10 − 0 = 20
```

```python filename:Python
class MinStack:
    def __init__(self):
        self.st = []
        self.min_ele = None

    def push(self, x):
        if not self.st:
            self.st.append(x)
            self.min_ele = x
        elif x < self.min_ele:
            self.st.append(2 * x - self.min_ele)   # encoded: always < x < new min
            self.min_ele = x
        else:
            self.st.append(x)

    def pop(self):
        top = self.st.pop()
        if top < self.min_ele:                     # encoded entry: it *was* the minimum
            real = self.min_ele
            self.min_ele = 2 * self.min_ele - top  # restore the previous minimum
            return real
        return top

    def top(self):
        t = self.st[-1]
        return self.min_ele if t < self.min_ele else t

    def get_min(self):
        return self.min_ele

s = MinStack()
s.push(20)
s.push(10)
print("getMin:", s.get_min())
s.push(5)
print("getMin:", s.get_min())
print("pop:", s.pop())
print("getMin:", s.get_min())
print("pop:", s.pop())
print("getMin:", s.get_min())

print("--- negatives ---")
s = MinStack()
for x in (-2, 0, -3):
    s.push(x)
print("getMin:", s.get_min())
print("pop:", s.pop())
print("getMin:", s.get_min())
print("top:", s.top())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
using namespace std;

class MinStack {
    stack<long long> st;         // long long: 2x - minEle can exceed the int range
    long long minEle = 0;
public:
    void push(long long x) {
        if (st.empty()) {
            st.push(x);
            minEle = x;
        } else if (x < minEle) {
            st.push(2 * x - minEle);    // encoded: always < x < new min
            minEle = x;
        } else {
            st.push(x);
        }
    }
    long long pop() {
        long long top = st.top();
        st.pop();
        if (top < minEle) {              // encoded entry: it *was* the minimum
            long long real = minEle;
            minEle = 2 * minEle - top;   // restore the previous minimum
            return real;
        }
        return top;
    }
    long long top() const {
        long long t = st.top();
        return t < minEle ? minEle : t;
    }
    long long getMin() const { return minEle; }
};

int main() {
    MinStack s;
    s.push(20);
    s.push(10);
    cout << "getMin: " << s.getMin() << "\n";
    s.push(5);
    cout << "getMin: " << s.getMin() << "\n";
    cout << "pop: " << s.pop() << "\n";
    cout << "getMin: " << s.getMin() << "\n";
    cout << "pop: " << s.pop() << "\n";
    cout << "getMin: " << s.getMin() << "\n";

    cout << "--- negatives ---\n";
    MinStack t;
    for (long long x : {-2, 0, -3}) t.push(x);
    cout << "getMin: " << t.getMin() << "\n";
    cout << "pop: " << t.pop() << "\n";
    cout << "getMin: " << t.getMin() << "\n";
    cout << "top: " << t.top() << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static class MinStack {
        Deque<Long> st = new ArrayDeque<>();   // long: 2x - minEle can exceed the int range
        long minEle;
        void push(long x) {
            if (st.isEmpty()) {
                st.push(x);
                minEle = x;
            } else if (x < minEle) {
                st.push(2 * x - minEle);        // encoded: always < x < new min
                minEle = x;
            } else {
                st.push(x);
            }
        }
        long pop() {
            long top = st.pop();
            if (top < minEle) {                  // encoded entry: it *was* the minimum
                long real = minEle;
                minEle = 2 * minEle - top;       // restore the previous minimum
                return real;
            }
            return top;
        }
        long top() {
            long t = st.peek();
            return t < minEle ? minEle : t;
        }
        long getMin() { return minEle; }
    }

    public static void main(String[] args) {
        MinStack s = new MinStack();
        s.push(20);
        s.push(10);
        System.out.println("getMin: " + s.getMin());
        s.push(5);
        System.out.println("getMin: " + s.getMin());
        System.out.println("pop: " + s.pop());
        System.out.println("getMin: " + s.getMin());
        System.out.println("pop: " + s.pop());
        System.out.println("getMin: " + s.getMin());

        System.out.println("--- negatives ---");
        MinStack t = new MinStack();
        for (long x : new long[]{-2, 0, -3}) t.push(x);
        System.out.println("getMin: " + t.getMin());
        System.out.println("pop: " + t.pop());
        System.out.println("getMin: " + t.getMin());
        System.out.println("top: " + t.top());
    }
}
```

```javascript filename:JavaScript
class MinStack {
    constructor() {
        this.st = [];
        this.minEle = null;
    }
    push(x) {
        if (this.st.length === 0) {
            this.st.push(x);
            this.minEle = x;
        } else if (x < this.minEle) {
            this.st.push(2 * x - this.minEle);   // encoded: always < x < new min
            this.minEle = x;
        } else {
            this.st.push(x);
        }
    }
    pop() {
        const top = this.st.pop();
        if (top < this.minEle) {                  // encoded entry: it *was* the minimum
            const real = this.minEle;
            this.minEle = 2 * this.minEle - top;  // restore the previous minimum
            return real;
        }
        return top;
    }
    top() {
        const t = this.st[this.st.length - 1];
        return t < this.minEle ? this.minEle : t;
    }
    getMin() { return this.minEle; }
}

let s = new MinStack();
s.push(20);
s.push(10);
console.log("getMin:", s.getMin());
s.push(5);
console.log("getMin:", s.getMin());
console.log("pop:", s.pop());
console.log("getMin:", s.getMin());
console.log("pop:", s.pop());
console.log("getMin:", s.getMin());

console.log("--- negatives ---");
s = new MinStack();
for (const x of [-2, 0, -3]) s.push(x);
console.log("getMin:", s.getMin());
console.log("pop:", s.pop());
console.log("getMin:", s.getMin());
console.log("top:", s.top());
```

```text filename:Output
getMin: 10
getMin: 5
pop: 5
getMin: 10
pop: 10
getMin: 20
--- negatives ---
getMin: -3
pop: -3
getMin: -2
top: 0
```

Time O(1) per operation · Space O(1) extra — one variable besides the stack

<strong>Why </strong><strong>`2x − minEle`</strong><strong> works.</strong> Let `m` be the old minimum and `x < m` the new one. The stored value is `e = 2x − m = x − (m − x) < x`. Since the new `minEle` is `x`, the stored `e` is below `minEle`, which is how `pop()` recognises it. Reversing: `2·minEle − e = 2x − (2x − m) = m`, the old minimum. Negative numbers need no special handling — the algebra never relied on signs, only on `x < m`. The original notes repeated the same class under <em>Handling negatives</em>; the `-2, 0, -3` driver above shows it works unchanged.

> [!WARNING] Pitfall
>
> `2x − minEle` can <strong>overflow</strong> a 32-bit integer when `x` and `minEle` are near the limits with opposite signs. Use a 64-bit type for the stored values (`long long` / `long` above), or fall back to the auxiliary stack when inputs can be extreme. Also: `top()` must decode exactly like `pop()` — returning the raw stored value is a classic bug that only shows up when the top happens to be the minimum.

# Interview Q&amp;A

```question
When should I reach for a monotonic stack?

---

Whenever the question is about the <em>nearest</em> element to the left or right satisfying an order relation — greater, smaller, greater-or-equal — or about spans/widths bounded by such elements. Signals: 'next greater', 'previous smaller', 'how many days until a warmer temperature', 'largest rectangle', 'trapping rain water', 'remove k digits to make the smallest number'. The nested `while` looks quadratic but is amortised `O(n)` because each element is popped at most once.
```

```question
Previous greater vs next greater: what actually changes in the code?

---

Only the scan direction. Scan left-to-right and the stack contains candidates from the left (previous greater); scan right-to-left and it contains candidates from the right (next greater). Changing `<=` to `>=` in the pop condition switches from <em>greater</em> to <em>smaller</em>. Four problems, one template.
```

```question
Why is the histogram problem O(n) when each bar may pop many others?

---

Each index is pushed once and popped once (at most), so the total number of pops across the whole run is at most `n`. The sentinel `0` bar at the end guarantees that every index is eventually popped and measured, so no separate clean-up loop with its own off-by-one risks is needed.
```

```question
How does the k-stacks structure differ from just using k dynamic arrays?

---

`k` separate arrays either reserve capacity per stack (wasted when stacks are unbalanced) or resize independently. The single-array version guarantees that <em>any</em> distribution of up to `n` elements across the `k` stacks fits, with `O(1)` push/pop and `O(n + k)` total memory, by maintaining a free list inside the array — the same idea an allocator uses for free blocks.
```

```question
Is the O(1)-space getMin() trick safe in production code?

---

It is correct for any integers as long as `2x − minEle` does not overflow, so store 64-bit values or check the range. It also only works for one tracked statistic (min <em>or</em> max) and makes `top()` subtle. Many engineers prefer the auxiliary-stack version for its clarity; know both and say why you would choose one.
```

```question
How would you find the next greater element for a circular array?

---

Run the right-to-left scan twice over the array (`i` from `2n − 1` down to `0`, using `arr[i % n]`), filling results only during the second half. The first pass seeds the stack with every element so wrap-around candidates are available when the real scan starts. Still `O(n)`.
```
