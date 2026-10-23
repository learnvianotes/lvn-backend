---
id: 4ba105c3-3f1b-7b4b-93ea-e2e902b00c52
key: topic:java/program-structure
subject: java
topic: program-structure
title: Program Structure & main()
slug: program-structure-main
order: 1
---

A Java program is a set of classes; execution starts at `public static void main(String[] args)` of the class you launch.

# Anatomy of a source file

```java filename:Java
package com.example.app;           // 1. optional package (must be first)

import java.util.List;             // 2. imports

public class Main {                // 3. at most ONE public top-level class, named like the file
    static final int LIMIT = 3;    //    fields

    public static void main(String[] args) {   // entry point
        List<String> names = List.of("Ada", "Linus", "Grace");
        for (int i = 0; i < LIMIT; i++) {
            greet(names.get(i));
        }
    }

    static void greet(String name) {            // methods
        System.out.println("Hi, " + name);
    }
}
```

```text filename:Output
Hi, Ada
Hi, Linus
Hi, Grace
```

# Dissecting `main`

| Part | Why |
| --- | --- |
| `public` | The JVM calls it from outside the class. |
| `static` | No object exists yet — the JVM calls it on the class itself. |
| `void` | Returns nothing; use `System.exit(code)` to set an exit status. |
| `main` | The name the launcher looks for. |
| `String[] args` | Command-line arguments (also `String... args`). Never `null`; empty if none. |

```java filename:Java%20%E2%80%94%20java%20Main.java%20hello%2042
public class Main {
    public static void main(String[] args) {
        System.out.println("count = " + args.length);
        for (String a : args) System.out.println("arg: " + a);
    }
}
```

```text filename:Output
count = 2
arg: hello
arg: 42
```

> [!NOTE] Newer Java
>
> Java 21 previews <em>unnamed classes and instance main methods</em> (`void main() { … }`), finalised later as “compact source files” in Java 25. For interviews and production, the classic `public static void main(String[] args)` is the one to know.

# Rules and conventions

- One `public` top-level class per file, and the file must be named after it: `Main` → `Main.java`.
- Every statement ends with `;`; blocks use `{ }`. Java is case-sensitive (`Main` ≠ `main`).
- Naming: `PascalCase` classes/interfaces, `camelCase` methods/variables, `UPPER_SNAKE_CASE` constants, `lowercase.dotted` packages (reversed domain: `com.example.app`).
- Comments: `// line`, `/* block */`, `/** Javadoc */` (turned into HTML API docs by `javadoc`).
- `java.lang` (`String`, `Math`, `System`, `Integer`…) is imported automatically.

# Console output &amp; input

```java filename:Java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String name = in.next();
        int age = in.nextInt();
        System.out.print("No newline, ");
        System.out.println("then newline");
        System.out.printf("%s is %d years old (%.2f decades)%n", name, age, age / 10.0);
        System.out.println(String.format("[%5d] [%-5s] [%05d]", 42, "ab", 42));
    }
}
```

```text filename:Output
No newline, then newline
Ravi is 27 years old (2.70 decades)
[   42] [ab   ] [00042]
```

| Format | Meaning |
| --- | --- |
| `%d` / `%s` / `%c` / `%b` | integer / string / char / boolean |
| `%f`, `%.2f`, `%e` | floating point, 2 decimals, scientific |
| `%5d`, `%-5s`, `%05d` | width 5 right-aligned, left-aligned, zero-padded |
| `%x`, `%o` | hexadecimal, octal |
| `%n` | platform line separator (prefer over `\n` in `printf`) |

```question
Can we overload main? Can main be private or non-static?

---

You can overload `main` (e.g. `main(int x)`), but the JVM only calls `public static void main(String[])`. If it's `private` or non-static, the class compiles but the classic launcher reports that no valid main method was found.
```

```question
Why is main static?

---

So the JVM can call it without creating an instance first — at start-up there is no object to call it on, and the JVM wouldn't know which constructor to use.
```

```question
Can a source file have no public class?

---

Yes. Then the file can have any name, and all its top-level classes are package-private.
```
