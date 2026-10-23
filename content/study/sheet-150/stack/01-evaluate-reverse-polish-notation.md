---
id: 4853f46f-45ef-7c77-b4a7-c2695d8de430
key: problem:sheet-150/lc-150
subject: sheet-150
topic: stack
title: Evaluate Reverse Polish Notation
slug: evaluate-reverse-polish-notation
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 150](https://leetcode.com/problems/evaluate-reverse-polish-notation/)

# Problem

Evaluate the value of an arithmetic expression in Reverse Polish Notation (postfix). Valid operators are `'+'`, `'-'`, `'*'`, and `'/'`.

# Understanding the problem

In RPN, operators follow their operands: e.g. `['2', '1', '+', '3', '*']` = `(2 + 1) * 3 = 9`.

# Intuition

Use an operand stack. Push numbers. On operator, pop top 2 numbers (second popped is left operand), evaluate result, and push back.

# Approach

1. Initialize empty `stack`.
2. Iterate through `tokens`.
3. If integer: push `int(token)` to stack.
4. If operator: pop `b = stack.pop()`, `a = stack.pop()`.
5. Perform operation (truncating division toward zero `int(a / b)`), push result to stack.
6. Return `stack[-1]`.

# Naive Solution — Brute Force

Repeatedly scan token array, find first operator, evaluate previous 2 operands, and replace sub-slice in token list.

```python filename:Python
class Solution:
    def evalRPN(self, tokens):

        tokens = tokens[:]

        operators = {"+", "-", "*", "/"}

        while len(tokens) > 1:
            for i, token in enumerate(tokens):

                if token not in operators:
                    continue

                a = int(tokens[i - 2])
                b = int(tokens[i - 1])

                if token == "+":
                    result = a + b
                elif token == "-":
                    result = a - b
                elif token == "*":
                    result = a * b
                else:
                    result = int(a / b)

                tokens[i - 2:i + 1] = [str(result)]
                break

        return int(tokens[0])
```

```cpp filename:C%2B%2B
class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        vector<string> t = tokens;
        while (t.size() > 1) {
            for (int i = 0; i < t.size(); i++) {
                const string& token = t[i];
                if (token != "+" && token != "-" && token != "*" && token != "/") continue;
                int a = stoi(t[i - 2]), b = stoi(t[i - 1]);
                int result;
                if (token == "+") result = a + b;
                else if (token == "-") result = a - b;
                else if (token == "*") result = a * b;
                else result = a / b;
                t.erase(t.begin() + i - 2, t.begin() + i + 1);
                t.insert(t.begin() + i - 2, to_string(result));
                break;
            }
        }
        return stoi(t[0]);
    }
};
```

```java filename:Java
class Solution {
    public int evalRPN(String[] tokens) {
        List<String> t = new ArrayList<>(Arrays.asList(tokens));
        Set<String> operators = Set.of("+", "-", "*", "/");
        while (t.size() > 1) {
            for (int i = 0; i < t.size(); i++) {
                String token = t.get(i);
                if (!operators.contains(token)) continue;
                int a = Integer.parseInt(t.get(i - 2));
                int b = Integer.parseInt(t.get(i - 1));
                int result;
                if (token.equals("+")) result = a + b;
                else if (token.equals("-")) result = a - b;
                else if (token.equals("*")) result = a * b;
                else result = a / b;
                t.subList(i - 2, i + 1).clear();
                t.add(i - 2, String.valueOf(result));
                break;
            }
        }
        return Integer.parseInt(t.get(0));
    }
}
```

```javascript filename:JavaScript
var evalRPN = function(tokens) {
    tokens = tokens.slice();
    const operators = new Set(["+", "-", "*", "/"]);
    while (tokens.length > 1) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (!operators.has(token)) continue;
            const a = parseInt(tokens[i - 2]), b = parseInt(tokens[i - 1]);
            let result;
            if (token === "+") result = a + b;
            else if (token === "-") result = a - b;
            else if (token === "*") result = a * b;
            else result = Math.trunc(a / b);
            tokens.splice(i - 2, 3, String(result));
            break;
        }
    }
    return parseInt(tokens[0]);
};
```

<strong>Time: O(n²) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def evalRPN(self, tokens):
        stack = []

        operators = {"+", "-", "*", "/"}

        for token in tokens:

            if token not in operators:
                stack.append(int(token))
                continue

            b = stack.pop()
            a = stack.pop()

            if token == "+":
                result = a + b
            elif token == "-":
                result = a - b
            elif token == "*":
                result = a * b
            else:
                result = int(a / b)

            stack.append(result)

        return stack[-1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        stack<int> st;
        for (const string& token : tokens) {
            if (token != "+" && token != "-" && token != "*" && token != "/") {
                st.push(stoi(token));
                continue;
            }
            int b = st.top(); st.pop();
            int a = st.top(); st.pop();
            int result;
            if (token == "+") result = a + b;
            else if (token == "-") result = a - b;
            else if (token == "*") result = a * b;
            else result = a / b;
            st.push(result);
        }
        return st.top();
    }
};
```

```java filename:Java
class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();
        Set<String> operators = Set.of("+", "-", "*", "/");
        for (String token : tokens) {
            if (!operators.contains(token)) {
                stack.push(Integer.parseInt(token));
                continue;
            }
            int b = stack.pop();
            int a = stack.pop();
            int result;
            if (token.equals("+")) result = a + b;
            else if (token.equals("-")) result = a - b;
            else if (token.equals("*")) result = a * b;
            else result = a / b;
            stack.push(result);
        }
        return stack.peek();
    }
}
```

```javascript filename:JavaScript
var evalRPN = function(tokens) {
    const stack = [];
    const operators = new Set(["+", "-", "*", "/"]);
    for (const token of tokens) {
        if (!operators.has(token)) {
            stack.push(parseInt(token));
            continue;
        }
        const b = stack.pop();
        const a = stack.pop();
        let result;
        if (token === "+") result = a + b;
        else if (token === "-") result = a - b;
        else if (token === "*") result = a * b;
        else result = Math.trunc(a / b);
        stack.push(result);
    }
    return stack[stack.length - 1];
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Operand → push; Operator → pop two → calculate → push result
