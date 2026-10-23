---
id: bd3d07f9-6c76-77d1-b5f5-ec478c69d209
key: topic:dsa-advanced/infix_postfix
subject: dsa-advanced
topic: infix_postfix
title: Infix, Postfix, Prefix
slug: infix-postfix-prefix
order: 1
---

Humans write `x + y`; machines prefer `x y +` or `+ x y`, because those forms need no brackets, no precedence table and no associativity rules — a single left-to-right pass with a stack evaluates them. Converting between the three notations is the classic stack algorithm.

> [!INFO]
>
> <strong>Infix / Postfix / Prefix</strong> — the three ways to place an operator relative to its operands: <strong>infix</strong> between them (`x + y`), <strong>postfix</strong> after them (`x y +`, also called <em>Reverse Polish Notation</em>), <strong>prefix</strong> before them (`+ x y`, <em>Polish Notation</em>).

| Infix | Postfix | Prefix |
| --- | --- | --- |
| `x + y` | `x y +` | `+ x y` |
| `x + y * z` | `x y z * +` | `+ x * y z` |
| `(x + y) * z` | `x y + z *` | `* + x y z` |
| `a + b * (c - d) / e` | `a b c d - * e / +` | `+ a / * b - c d e` |
| `a ^ b ^ c` (right-assoc) | `a b c ^ ^` | `^ a ^ b c` |

# Why postfix and prefix are useful

> [!NOTE] No parentheses
>
> The position of each operator already says which operands it applies to, so brackets are never needed. `(x + y) * z` is just `x y + z *`.

> [!NOTE] No precedence or associativity rules
>
> Those rules only exist to disambiguate infix. Once an expression is in postfix or prefix, `*` before `+` is decided by position, not by a table.

> [!NOTE] One pass to evaluate
>
> A single left-to-right scan with one stack evaluates postfix (right-to-left for prefix). Compilers and calculators (HP's RPN models, the JVM's stack machine, PostScript) run on exactly this.

> [!NOTE] Same tree, three traversals
>
> All three notations are traversals of the same <em>expression tree</em>: prefix = preorder, infix = inorder, postfix = postorder. Converting is just re-traversing.

```text filename:The%20expression%20tree%20of%20a%20%2B%20b%20*%20c%20and%20its%20three%20traversals
   +                    preorder  (prefix)  : + a * b c
 /   \                  inorder   (infix)   : a + b * c
a     *                 postorder (postfix) : a b c * +
     / \
    b   c
```

# Precedence and associativity

Infix is ambiguous without two extra rules. <strong>Precedence</strong> decides which operator binds tighter when they differ; <strong>associativity</strong> decides the order when they are equal.

| Operator | Precedence | Associativity | Example |
| --- | --- | --- | --- |
| `^` | 3 (highest) | right to left | `2 ^ 1 ^ 2 = 2 ^ (1 ^ 2) = 2 ^ 1 = 2` |
| `*`, `/` | 2 | left to right | `12 / 2 * 3 = (12 / 2) * 3 = 18` |
| `+`, `-` | 1 (lowest) | left to right | `10 + 2 - 3 = (10 + 2) - 3 = 9` |

- <strong>Precedence:</strong> `10 + 20 * 2` → `10 + 40` → `50`, not `60`.
- <strong>Left associativity:</strong> `10 - 2 - 3` → `(10 - 2) - 3` → `5`, not `11`.
- <strong>Right associativity:</strong> `2 ^ 3 ^ 2` → `2 ^ (3 ^ 2)` → `2 ^ 9` → `512`, not `64`.

> [!NOTE] How the rules enter the algorithm
>
> In the conversion algorithms, precedence decides whether an incoming operator pops the stack top; associativity decides what happens when they are <strong>equal</strong>: left-associative operators pop the equal top (so the earlier one is output first), right-associative ones do not.

# Converting by hand: fully parenthesise, then move operators

1. <strong>Parenthesise fully</strong>

   Add brackets that make precedence and associativity explicit: `x + y * z` → `(x + (y * z))`.

2. <strong>Convert innermost first</strong>

   Replace each `(a op b)` by `a b op` (postfix) or `op a b` (prefix), working outwards: `(x + (y z *))` → `x y z * +`.

3. <strong>Drop the brackets</strong>

   They are no longer needed — the result is the postfix (or prefix) form.

| Infix | Fully parenthesised | Postfix | Prefix |
| --- | --- | --- | --- |
| `x + y * z` | `(x + (y * z))` | `x y z * +` | `+ x * y z` |
| `(x + y) * z` | `((x + y) * z)` | `x y + z *` | `* + x y z` |
| `a - b - c` | `((a - b) - c)` | `a b - c -` | `- - a b c` |
| `a ^ b ^ c` | `(a ^ (b ^ c))` | `a b c ^ ^` | `^ a ^ b c` |

# Infix to postfix (shunting-yard algorithm)

> [!TIP] Example
>
> <strong>Input:</strong> `a+b*c`<br><strong>Output:</strong> `abc*+`<br><strong>Input:</strong> `(a+b)*c`<br><strong>Output:</strong> `ab+c*`<br><strong>Input:</strong> `a+b*(c-d)/e`<br><strong>Output:</strong> `abcd-*e/+`

> [!NOTE] Idea
>
> Operands go straight to the output; they are already in the right order. Operators wait on a stack until every operator that must be applied <em>before</em> them has been output. An operator on the stack must come out before an incoming operator of lower (or equal, for left-associative) precedence — that is the only rule. Brackets are a fence: `(` is pushed and nothing below it can be popped until the matching `)` arrives.

1. <strong>Operand</strong>

   Append it to the output.

2. <strong>`(`</strong>

   Push it.

3. <strong>`)`</strong>

   Pop and output operators until the `(`; pop the `(` and discard it (brackets never appear in postfix).

4. <strong>Operator </strong><strong>`x`</strong>

   While the stack top is an operator with <strong>higher</strong> precedence than `x`, or <strong>equal</strong> precedence and `x` is left-associative, pop it to the output. Then push `x`.

5. <strong>End of input</strong>

   Pop and output everything left on the stack.

| Symbol | Action | Stack (bottom → top) | Output |
| --- | --- | --- | --- |
| `a` | operand → output |  | `a` |
| `+` | stack empty → push | `+` | `a` |
| `b` | operand → output | `+` | `a b` |
| `*` | higher than `+` → push | `+ *` | `a b` |
| `(` | push | `+ * (` | `a b` |
| `c` | operand → output | `+ * (` | `a b c` |
| `-` | top is `(` → push | `+ * ( -` | `a b c` |
| `d` | operand → output | `+ * ( -` | `a b c d` |
| `)` | pop to `(`: output `-`, discard `(` | `+ *` | `a b c d -` |
| `/` | equal to `*`, left-assoc → pop `*`; `+` is lower → stop; push `/` | `+ /` | `a b c d - *` |
| `e` | operand → output | `+ /` | `a b c d - * e` |
| end | pop everything |  | `a b c d - * e / +` |

```python filename:Python
PREC = {'+': 1, '-': 1, '*': 2, '/': 2, '^': 3}
RIGHT_ASSOC = {'^'}

def infix_to_postfix(expr):
    out, st = [], []
    for ch in expr:
        if ch == ' ':
            continue
        if ch.isalnum():                       # operand: straight to the output
            out.append(ch)
        elif ch == '(':
            st.append(ch)
        elif ch == ')':
            while st[-1] != '(':               # pop until the matching '('
                out.append(st.pop())
            st.pop()                           # discard the '(' itself
        else:                                  # operator
            while (st and st[-1] != '(' and
                   (PREC[st[-1]] > PREC[ch] or
                    (PREC[st[-1]] == PREC[ch] and ch not in RIGHT_ASSOC))):
                out.append(st.pop())           # higher (or equal, left-assoc) comes out first
            st.append(ch)
    while st:
        out.append(st.pop())
    return ''.join(out)

for e in ["a+b*c", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"]:
    print(e, "→", infix_to_postfix(e))
```

```cpp filename:C%2B%2B
#include <cctype>
#include <iostream>
#include <stack>
#include <string>
using namespace std;

int prec(char op) {
    if (op == '^') return 3;
    if (op == '*' || op == '/') return 2;
    if (op == '+' || op == '-') return 1;
    return 0;
}
bool rightAssoc(char op) { return op == '^'; }

string infixToPostfix(const string& expr) {
    string out;
    stack<char> st;
    for (char ch : expr) {
        if (ch == ' ') continue;
        if (isalnum(static_cast<unsigned char>(ch))) {
            out += ch;                                   // operand: straight to the output
        } else if (ch == '(') {
            st.push(ch);
        } else if (ch == ')') {
            while (st.top() != '(') { out += st.top(); st.pop(); }   // pop until the matching '('
            st.pop();                                    // discard the '(' itself
        } else {
            while (!st.empty() && st.top() != '(' &&
                   (prec(st.top()) > prec(ch) || (prec(st.top()) == prec(ch) && !rightAssoc(ch)))) {
                out += st.top(); st.pop();               // higher (or equal, left-assoc) comes out first
            }
            st.push(ch);
        }
    }
    while (!st.empty()) { out += st.top(); st.pop(); }
    return out;
}

int main() {
    for (string e : {"a+b*c", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"})
        cout << e << " → " << infixToPostfix(e) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int prec(char op) {
        if (op == '^') return 3;
        if (op == '*' || op == '/') return 2;
        if (op == '+' || op == '-') return 1;
        return 0;
    }
    static boolean rightAssoc(char op) { return op == '^'; }

    static String infixToPostfix(String expr) {
        StringBuilder out = new StringBuilder();
        Deque<Character> st = new ArrayDeque<>();
        for (char ch : expr.toCharArray()) {
            if (ch == ' ') continue;
            if (Character.isLetterOrDigit(ch)) {
                out.append(ch);                              // operand: straight to the output
            } else if (ch == '(') {
                st.push(ch);
            } else if (ch == ')') {
                while (st.peek() != '(') out.append(st.pop());   // pop until the matching '('
                st.pop();                                    // discard the '(' itself
            } else {
                while (!st.isEmpty() && st.peek() != '(' &&
                       (prec(st.peek()) > prec(ch) || (prec(st.peek()) == prec(ch) && !rightAssoc(ch))))
                    out.append(st.pop());                    // higher (or equal, left-assoc) comes out first
                st.push(ch);
            }
        }
        while (!st.isEmpty()) out.append(st.pop());
        return out.toString();
    }

    public static void main(String[] args) {
        for (String e : new String[]{"a+b*c", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"})
            System.out.println(e + " → " + infixToPostfix(e));
    }
}
```

```javascript filename:JavaScript
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
const RIGHT_ASSOC = new Set(['^']);
const isOperand = ch => /[A-Za-z0-9]/.test(ch);

function infixToPostfix(expr) {
    const out = [], st = [];
    const top = () => st[st.length - 1];
    for (const ch of expr) {
        if (ch === ' ') continue;
        if (isOperand(ch)) {
            out.push(ch);                                   // operand: straight to the output
        } else if (ch === '(') {
            st.push(ch);
        } else if (ch === ')') {
            while (top() !== '(') out.push(st.pop());       // pop until the matching '('
            st.pop();                                       // discard the '(' itself
        } else {
            while (st.length && top() !== '(' &&
                   (PREC[top()] > PREC[ch] || (PREC[top()] === PREC[ch] && !RIGHT_ASSOC.has(ch))))
                out.push(st.pop());                         // higher (or equal, left-assoc) comes out first
            st.push(ch);
        }
    }
    while (st.length) out.push(st.pop());
    return out.join('');
}

for (const e of ["a+b*c", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"])
    console.log(e, "→", infixToPostfix(e));
```

```text filename:Output
a+b*c → abc*+
(a+b)*c → ab+c*
a+b*(c-d)/e → abcd-*e/+
a^b^c → abc^^
a-b-c → ab-c-
```

Time O(n) · Space O(n) for the operator stack

> [!WARNING] Pitfall
>
> Three places where this goes wrong: (1) comparing precedence with a `(` on top — give `(` the lowest precedence or test for it explicitly, otherwise `)` never finds its partner; (2) using `>` instead of `>=` for left-associative operators, which turns `a-b-c` into `abc--` = `a-(b-c)`; (3) the `)` case must <em>discard</em> the `(` — brackets never reach the output.

# Evaluating a postfix expression

> [!TIP] Example
>
> <strong>Input:</strong> `10 2 * 3 +`<br><strong>Output:</strong> `23`<br><strong>Input:</strong> `2 3 1 * + 9 -`<br><strong>Output:</strong> `-4`<br><strong>Input:</strong> `100 20 5 / -`<br><strong>Output:</strong> `96`

> [!NOTE] Idea
>
> Scan left to right. Operands are pushed. When an operator arrives, its two operands are the two most recent values — pop them, apply, push the result. The expression is well formed exactly when one value remains at the end. <strong>Order matters for </strong><strong>`-`</strong><strong>, </strong><strong>`/`</strong><strong> and </strong><strong>`^`</strong><strong>:</strong> the first pop is the <em>right</em> operand.

1. <strong>Operand</strong>

   Push it.

2. <strong>Operator</strong>

   `right = pop()`, `left = pop()`, push `left op right`.

3. <strong>End</strong>

   The single remaining value is the result.

```text filename:Each%20operator%20replaces%20the%20top%20two%20values%20by%20one
tokens:  10   2   *   3   +
stack:  [10] [10 2] [20] [20 3] [23]        2 3 1 * + 9 -  →  [2] [2 3] [2 3 1] [2 3] [5] [5 9] [-4]
```

```python filename:Python
def apply(op, a, b):
    if op == '+': return a + b
    if op == '-': return a - b
    if op == '*': return a * b
    if op == '/': return a // b           # integer division (operands kept positive here)
    if op == '^': return a ** b
    raise ValueError(op)

def eval_postfix(expr):
    st = []
    for tok in expr.split():
        if tok.lstrip('-').isdigit():
            st.append(int(tok))
        else:
            right = st.pop()              # first pop is the RIGHT operand
            left = st.pop()
            st.append(apply(tok, left, right))
    return st[-1]                         # exactly one value remains

for e in ["10 2 * 3 +", "2 3 1 * + 9 -", "100 20 5 / -", "2 3 ^ 1 -"]:
    print(e, "=", eval_postfix(e))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <sstream>
#include <stack>
#include <string>
using namespace std;

long long ipow(long long a, long long b) { long long r = 1; while (b-- > 0) r *= a; return r; }

long long apply(const string& op, long long a, long long b) {
    if (op == "+") return a + b;
    if (op == "-") return a - b;
    if (op == "*") return a * b;
    if (op == "/") return a / b;         // integer division (operands kept positive here)
    return ipow(a, b);                   // "^"
}

long long evalPostfix(const string& expr) {
    stack<long long> st;
    istringstream in(expr);
    string tok;
    while (in >> tok) {
        if (isdigit(static_cast<unsigned char>(tok.back()))) {
            st.push(stoll(tok));
        } else {
            long long right = st.top(); st.pop();   // first pop is the RIGHT operand
            long long left = st.top(); st.pop();
            st.push(apply(tok, left, right));
        }
    }
    return st.top();                                // exactly one value remains
}

int main() {
    for (string e : {"10 2 * 3 +", "2 3 1 * + 9 -", "100 20 5 / -", "2 3 ^ 1 -"})
        cout << e << " = " << evalPostfix(e) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static long ipow(long a, long b) { long r = 1; while (b-- > 0) r *= a; return r; }

    static long apply(String op, long a, long b) {
        switch (op) {
            case "+": return a + b;
            case "-": return a - b;
            case "*": return a * b;
            case "/": return a / b;          // integer division (operands kept positive here)
            default:  return ipow(a, b);     // "^"
        }
    }

    static long evalPostfix(String expr) {
        Deque<Long> st = new ArrayDeque<>();
        for (String tok : expr.split(" ")) {
            if (Character.isDigit(tok.charAt(tok.length() - 1))) {
                st.push(Long.parseLong(tok));
            } else {
                long right = st.pop();           // first pop is the RIGHT operand
                long left = st.pop();
                st.push(apply(tok, left, right));
            }
        }
        return st.peek();                        // exactly one value remains
    }

    public static void main(String[] args) {
        for (String e : new String[]{"10 2 * 3 +", "2 3 1 * + 9 -", "100 20 5 / -", "2 3 ^ 1 -"})
            System.out.println(e + " = " + evalPostfix(e));
    }
}
```

```javascript filename:JavaScript
function apply(op, a, b) {
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return Math.trunc(a / b);     // integer division (operands kept positive here)
        case '^': return a ** b;
    }
    throw new Error(op);
}

function evalPostfix(expr) {
    const st = [];
    for (const tok of expr.split(' ')) {
        if (/\d$/.test(tok)) {
            st.push(Number(tok));
        } else {
            const right = st.pop();              // first pop is the RIGHT operand
            const left = st.pop();
            st.push(apply(tok, left, right));
        }
    }
    return st[st.length - 1];                    // exactly one value remains
}

for (const e of ["10 2 * 3 +", "2 3 1 * + 9 -", "100 20 5 / -", "2 3 ^ 1 -"])
    console.log(e, "=", evalPostfix(e));
```

```text filename:Output
10 2 * 3 + = 23
2 3 1 * + 9 - = -4
100 20 5 / - = 96
2 3 ^ 1 - = 7
```

Time O(n) · Space O(n) for the operand stack

> [!WARNING] Pitfall
>
> `op1 = pop(); op2 = pop(); push(op2 op op1)` — the original notes wrote it correctly, but swapping the two is the single most common bug: `10 2 -` must give `8`, not `-8`. Also tokenise on spaces when operands can have several digits; a character-by-character scan silently reads `10` as `1` and `0`.

# Infix to prefix

> [!TIP] Example
>
> <strong>Input:</strong> `x+y*z`<br><strong>Output:</strong> `+x*yz`<br><strong>Input:</strong> `(a+b)*c`<br><strong>Output:</strong> `*+abc`<br><strong>Input:</strong> `a+b*(c-d)/e`<br><strong>Output:</strong> `+a/*b-cde`

By hand: fully parenthesise and convert from the innermost bracket outwards, writing each operator <em>before</em> its operands — `x + (y * z)` → `x + (* y z)` → `+ x * y z`. With a stack there are two routes; the reversal trick reuses the postfix code almost unchanged.

> [!NOTE] Idea
>
> Prefix is almost <em>postfix read backwards</em>: reverse the infix string (swapping `(` with `)`), run the postfix algorithm, and reverse the result. The one subtlety is associativity, which flips with the reversal: in the reversed string a left-associative operator must <strong>not</strong> pop an equal-precedence top (otherwise `a-b-c` would come out as `-a-bc` = `a-(b-c)`), while the right-associative `^` must.

1. <strong>Reverse</strong>

   Reverse the infix string and swap every `(` with `)`: `(a+b)*c` → `c*(b+a)`.

2. <strong>Convert</strong>

   Run infix-to-postfix on it, popping on <strong>strictly higher</strong> precedence (or equal precedence when the operator is right-associative): `c*(b+a)` → `cba+*`.

3. <strong>Reverse again</strong>

   Reverse the output: `cba+*` → `*+abc`.

```python filename:Python
PREC = {'+': 1, '-': 1, '*': 2, '/': 2, '^': 3}
RIGHT_ASSOC = {'^'}

def infix_to_prefix(expr):
    rev = ''.join(')' if c == '(' else '(' if c == ')' else c for c in reversed(expr))
    out, st = [], []
    for ch in rev:
        if ch == ' ':
            continue
        if ch.isalnum():
            out.append(ch)
        elif ch == '(':
            st.append(ch)
        elif ch == ')':
            while st[-1] != '(':
                out.append(st.pop())
            st.pop()
        else:
            while (st and st[-1] != '(' and
                   (PREC[st[-1]] > PREC[ch] or
                    (PREC[st[-1]] == PREC[ch] and ch in RIGHT_ASSOC))):   # associativity flipped
                out.append(st.pop())
            st.append(ch)
    while st:
        out.append(st.pop())
    return ''.join(reversed(out))                                       # undo the reversal

for e in ["x+y*z", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"]:
    print(e, "→", infix_to_prefix(e))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <cctype>
#include <iostream>
#include <stack>
#include <string>
using namespace std;

int prec(char op) {
    if (op == '^') return 3;
    if (op == '*' || op == '/') return 2;
    if (op == '+' || op == '-') return 1;
    return 0;
}
bool rightAssoc(char op) { return op == '^'; }

string infixToPrefix(string expr) {
    reverse(expr.begin(), expr.end());
    for (char& c : expr) c = c == '(' ? ')' : c == ')' ? '(' : c;   // swap the brackets
    string out;
    stack<char> st;
    for (char ch : expr) {
        if (ch == ' ') continue;
        if (isalnum(static_cast<unsigned char>(ch))) {
            out += ch;
        } else if (ch == '(') {
            st.push(ch);
        } else if (ch == ')') {
            while (st.top() != '(') { out += st.top(); st.pop(); }
            st.pop();
        } else {
            while (!st.empty() && st.top() != '(' &&
                   (prec(st.top()) > prec(ch) || (prec(st.top()) == prec(ch) && rightAssoc(ch)))) {
                out += st.top(); st.pop();                        // associativity flipped
            }
            st.push(ch);
        }
    }
    while (!st.empty()) { out += st.top(); st.pop(); }
    reverse(out.begin(), out.end());                              // undo the reversal
    return out;
}

int main() {
    for (string e : {"x+y*z", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"})
        cout << e << " → " << infixToPrefix(e) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int prec(char op) {
        if (op == '^') return 3;
        if (op == '*' || op == '/') return 2;
        if (op == '+' || op == '-') return 1;
        return 0;
    }
    static boolean rightAssoc(char op) { return op == '^'; }

    static String infixToPrefix(String expr) {
        StringBuilder rev = new StringBuilder();
        for (int i = expr.length() - 1; i >= 0; i--) {              // reverse and swap the brackets
            char c = expr.charAt(i);
            rev.append(c == '(' ? ')' : c == ')' ? '(' : c);
        }
        StringBuilder out = new StringBuilder();
        Deque<Character> st = new ArrayDeque<>();
        for (char ch : rev.toString().toCharArray()) {
            if (ch == ' ') continue;
            if (Character.isLetterOrDigit(ch)) {
                out.append(ch);
            } else if (ch == '(') {
                st.push(ch);
            } else if (ch == ')') {
                while (st.peek() != '(') out.append(st.pop());
                st.pop();
            } else {
                while (!st.isEmpty() && st.peek() != '(' &&
                       (prec(st.peek()) > prec(ch) || (prec(st.peek()) == prec(ch) && rightAssoc(ch))))
                    out.append(st.pop());                        // associativity flipped
                st.push(ch);
            }
        }
        while (!st.isEmpty()) out.append(st.pop());
        return out.reverse().toString();                         // undo the reversal
    }

    public static void main(String[] args) {
        for (String e : new String[]{"x+y*z", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"})
            System.out.println(e + " → " + infixToPrefix(e));
    }
}
```

```javascript filename:JavaScript
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
const RIGHT_ASSOC = new Set(['^']);
const isOperand = ch => /[A-Za-z0-9]/.test(ch);

function infixToPrefix(expr) {
    const rev = [...expr].reverse().map(c => c === '(' ? ')' : c === ')' ? '(' : c);   // swap the brackets
    const out = [], st = [];
    const top = () => st[st.length - 1];
    for (const ch of rev) {
        if (ch === ' ') continue;
        if (isOperand(ch)) {
            out.push(ch);
        } else if (ch === '(') {
            st.push(ch);
        } else if (ch === ')') {
            while (top() !== '(') out.push(st.pop());
            st.pop();
        } else {
            while (st.length && top() !== '(' &&
                   (PREC[top()] > PREC[ch] || (PREC[top()] === PREC[ch] && RIGHT_ASSOC.has(ch))))
                out.push(st.pop());                              // associativity flipped
            st.push(ch);
        }
    }
    while (st.length) out.push(st.pop());
    return out.reverse().join('');                               // undo the reversal
}

for (const e of ["x+y*z", "(a+b)*c", "a+b*(c-d)/e", "a^b^c", "a-b-c"])
    console.log(e, "→", infixToPrefix(e));
```

```text filename:Output
x+y*z → +x*yz
(a+b)*c → *+abc
a+b*(c-d)/e → +a/*b-cde
a^b^c → ^a^bc
a-b-c → --abc
```

Time O(n) · Space O(n)

> [!NOTE] Key point
>
> <strong>Direct route without reversal:</strong> scan the infix <em>right to left</em>, treating `)` as the opener and `(` as the closer, collect operands and popped operators into a list, and reverse that list at the end — this is exactly the step list in the original notes (push operands to `prefix`, push `)` to the stack, pop on `(`, compare precedence, finally reverse). The code above is the same algorithm with the reversal done up front, which lets it share its structure with the postfix converter.

# Evaluating a prefix expression

> [!TIP] Example
>
> <strong>Input:</strong> `+ 10 * 2 3`<br><strong>Output:</strong> `16`<br><strong>Input:</strong> `- + 7 * 4 5 2`<br><strong>Output:</strong> `25`<br><strong>Input:</strong> `/ 100 - 20 15`<br><strong>Output:</strong> `20`

> [!NOTE] Idea
>
> Mirror the postfix evaluator: scan <strong>right to left</strong>. Operands are pushed; an operator pops two values, but now the first pop is the <strong>left</strong> operand (it was closer to the operator in the original text). Push the result; the last remaining value is the answer.

```python filename:Python
def apply(op, a, b):
    if op == '+': return a + b
    if op == '-': return a - b
    if op == '*': return a * b
    if op == '/': return a // b
    raise ValueError(op)

def eval_prefix(expr):
    st = []
    for tok in reversed(expr.split()):      # right to left
        if tok.isdigit():
            st.append(int(tok))
        else:
            left = st.pop()                 # first pop is the LEFT operand this time
            right = st.pop()
            st.append(apply(tok, left, right))
    return st[-1]

for e in ["+ 10 * 2 3", "- + 7 * 4 5 2", "/ 100 - 20 15"]:
    print(e, "=", eval_prefix(e))
```

```cpp filename:C%2B%2B
#include <cctype>
#include <iostream>
#include <sstream>
#include <stack>
#include <string>
#include <vector>
using namespace std;

long long apply(const string& op, long long a, long long b) {
    if (op == "+") return a + b;
    if (op == "-") return a - b;
    if (op == "*") return a * b;
    return a / b;
}

long long evalPrefix(const string& expr) {
    vector<string> toks;
    istringstream in(expr);
    for (string t; in >> t;) toks.push_back(t);
    stack<long long> st;
    for (int i = (int)toks.size() - 1; i >= 0; i--) {         // right to left
        if (isdigit(static_cast<unsigned char>(toks[i].back()))) {
            st.push(stoll(toks[i]));
        } else {
            long long left = st.top(); st.pop();              // first pop is the LEFT operand this time
            long long right = st.top(); st.pop();
            st.push(apply(toks[i], left, right));
        }
    }
    return st.top();
}

int main() {
    for (string e : {"+ 10 * 2 3", "- + 7 * 4 5 2", "/ 100 - 20 15"})
        cout << e << " = " << evalPrefix(e) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static long apply(String op, long a, long b) {
        switch (op) {
            case "+": return a + b;
            case "-": return a - b;
            case "*": return a * b;
            default:  return a / b;
        }
    }

    static long evalPrefix(String expr) {
        String[] toks = expr.split(" ");
        Deque<Long> st = new ArrayDeque<>();
        for (int i = toks.length - 1; i >= 0; i--) {              // right to left
            if (Character.isDigit(toks[i].charAt(toks[i].length() - 1))) {
                st.push(Long.parseLong(toks[i]));
            } else {
                long left = st.pop();                             // first pop is the LEFT operand this time
                long right = st.pop();
                st.push(apply(toks[i], left, right));
            }
        }
        return st.peek();
    }

    public static void main(String[] args) {
        for (String e : new String[]{"+ 10 * 2 3", "- + 7 * 4 5 2", "/ 100 - 20 15"})
            System.out.println(e + " = " + evalPrefix(e));
    }
}
```

```javascript filename:JavaScript
function apply(op, a, b) {
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return Math.trunc(a / b);
    }
    throw new Error(op);
}

function evalPrefix(expr) {
    const toks = expr.split(' ');
    const st = [];
    for (let i = toks.length - 1; i >= 0; i--) {                  // right to left
        if (/\d$/.test(toks[i])) {
            st.push(Number(toks[i]));
        } else {
            const left = st.pop();                                // first pop is the LEFT operand this time
            const right = st.pop();
            st.push(apply(toks[i], left, right));
        }
    }
    return st[st.length - 1];
}

for (const e of ["+ 10 * 2 3", "- + 7 * 4 5 2", "/ 100 - 20 15"])
    console.log(e, "=", evalPrefix(e));
```

```text filename:Output
+ 10 * 2 3 = 16
- + 7 * 4 5 2 = 25
/ 100 - 20 15 = 20
```

Time O(n) · Space O(n)

# The three notations side by side

|  | Infix | Postfix | Prefix |
| --- | --- | --- | --- |
| Operator position | between operands | after operands | before operands |
| Needs brackets / precedence | yes | no | no |
| Evaluation scan | needs two stacks or a parser | left → right, one stack | right → left, one stack |
| First pop on an operator is | — | the <strong>right</strong> operand | the <strong>left</strong> operand |
| Tree traversal | inorder | postorder | preorder |
| Used by | people, source code | JVM / CPython bytecode, PostScript, RPN calculators | Lisp, some compilers' IRs |

# Interview Q&amp;A

```question
Why do compilers and virtual machines prefer postfix?

---

Because it maps directly onto a stack machine: each operand becomes a <em>push</em>, each operator a <em>pop-pop-compute-push</em>. No lookahead, no precedence table, one pass. The parser deals with precedence once, when it converts the source expression; the runtime never sees it again.
```

```question
How does the shunting-yard algorithm handle associativity?

---

Only in the equal-precedence case. For a left-associative incoming operator, an equal-precedence top is popped first (so `a - b - c` → `a b - c -`); for a right-associative one (`^`) it stays, so the later operator is output first (`a ^ b ^ c` → `a b c ^ ^`).
```

```question
Can you evaluate an infix expression directly, without converting first?

---

Yes — Dijkstra's two-stack algorithm: one stack for values and one for operators. It is the shunting-yard algorithm where, instead of <em>outputting</em> a popped operator, you immediately apply it to the top two values. The conversion and the evaluation are the same control flow with a different action.
```

```question
What is wrong with evaluating postfix character by character?

---

Multi-digit numbers break: `10 2 *` would be read as `1`, `0`, `2`. Tokenise on spaces (or scan runs of digits) first. The same goes for identifiers longer than one character and for a unary minus, which needs its own token type.
```

```question
How are the three notations related to the expression tree?

---

They are its three depth-first traversals: preorder prints the operator first (prefix), inorder prints it between the subtrees (infix, which is why it needs brackets to recover the structure), postorder prints it last (postfix). Both prefix and postfix determine the tree uniquely; infix without brackets does not.
```
