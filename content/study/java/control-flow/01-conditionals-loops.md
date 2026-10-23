---
id: f58c85f4-7a80-7926-8be9-cd17d1343fed
key: topic:java/control-flow
subject: java
topic: control-flow
title: Conditionals & Loops
slug: conditionals-loops
order: 1
---

`if`/`else`, the ternary operator and four loop forms — plus labeled `break`/`continue` for nested loops.

# if / else if / else

```java filename:Java
public class Main {
    static String grade(int score) {
        if (score >= 90) return "A";
        else if (score >= 75) return "B";
        else if (score >= 50) return "C";
        else return "F";
    }

    public static void main(String[] args) {
        System.out.println(grade(95) + grade(80) + grade(60) + grade(10));
        int n = 7;
        String parity = (n % 2 == 0) ? "even" : "odd";     // ternary: an expression
        System.out.println(n + " is " + parity);
    }
}
```

```text filename:Output
ABCF
7 is odd
```

> [!WARNING] Watch out
>
> Conditions must be `boolean` — `if (x = 5)` or `if (n)` do not compile in Java (unlike C). The one sneaky exception: `if (flag = true)` compiles for a `boolean flag` and is always true.

# Loops at a glance

| Loop | Syntax | Use when |
| --- | --- | --- |
| `for` | `for (int i = 0; i < n; i++)` | You need the index or a counted range |
| enhanced `for` | `for (T x : arrayOrIterable)` | Visiting every element, read-only |
| `while` | `while (cond) { … }` | Unknown number of iterations; may run 0 times |
| `do-while` | `do { … } while (cond);` | Body must run <strong>at least once</strong> (menus, retries) |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        for (int i = 0, j = 10; i < j; i += 3, j -= 3)       // several variables
            System.out.print(i + ":" + j + " ");
        System.out.println();

        int[] nums = {3, 1, 4};
        int sum = 0;
        for (int x : nums) sum += x;
        System.out.println("sum=" + sum);

        int n = 1234, digits = 0;
        while (n > 0) { n /= 10; digits++; }
        System.out.println("digits=" + digits);

        int k = 100;
        do { System.out.println("runs once, k=" + k); } while (k < 10);
    }
}
```

```text filename:Output
0:10 3:7
sum=8
digits=4
runs once, k=100
```

# break, continue &amp; labels

```java filename:Java
public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 10; i++) {
            if (i % 2 == 0) continue;      // skip evens
            if (i > 7) break;              // stop the loop
            System.out.print(i + " ");
        }
        System.out.println();

        int[][] grid = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
        outer:
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                if (grid[r][c] == 5) {
                    System.out.println("found at " + r + "," + c);
                    break outer;           // leaves BOTH loops
                }
            }
        }
    }
}
```

```text filename:Output
1 3 5 7
found at 1,1
```

# Common mistakes

- Off-by-one: `i <= arr.length` → `ArrayIndexOutOfBoundsException`. Use `i < arr.length`.
- Modifying the loop variable inside an enhanced `for` does nothing to the array — `x` is a copy.
- Removing from a `List` inside a for-each throws `ConcurrentModificationException` — use an `Iterator` or `removeIf`.
- A stray `;` — `for (…);` or `while (…);` makes an empty body.
- Floating-point loop counters (`for (double d = 0; d != 1; d += 0.1)`) may never terminate.

```question
What is the difference between while and do-while?

---

`while` checks the condition first, so the body may run zero times. `do-while` checks after the body, so it always runs at least once.
```

```question
How do you break out of nested loops?

---

Put a label on the outer loop (`outer:`) and use `break outer;` (or `continue outer;`). Alternatives: move the loops into a method and `return`, or use a flag variable.
```

```question
Can the ternary operator replace every if/else?

---

No — it is an <em>expression</em> that must produce a value of a common type; it can't contain statements. Use it for simple value choices; nested ternaries hurt readability.
```
