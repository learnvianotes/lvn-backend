---
id: ec36f15a-af9b-70de-85dc-1a14aeac10f8
key: topic:java/exceptions
subject: java
topic: exceptions
title: "Exceptions: Checked vs Unchecked"
slug: exceptions-checked-vs-unchecked
order: 1
---

An exception is an object that signals something went wrong. Java splits them into <strong>checked</strong> exceptions the compiler forces you to handle, and <strong>unchecked</strong> ones it doesn't.

> [!INFO]
>
> <strong>Exception</strong> — an instance of `Throwable` that is <em>thrown</em> to abort normal flow. The runtime unwinds the call stack until a matching `catch` is found; if none is, the thread dies and the stack trace is printed.

# The hierarchy

`Throwable` → `Error` | `Exception` → `RuntimeException` (under `Exception`)

| Type | Checked? | Meaning | Examples |
| --- | --- | --- | --- |
| `Error` | Unchecked | Serious JVM/environment problems — don't catch | `OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError` |
| `Exception` (not Runtime) | <strong>Checked</strong> | Recoverable, expected conditions outside your control | `IOException`, `FileNotFoundException`, `SQLException`, `InterruptedException` |
| `RuntimeException` | Unchecked | Programming bugs / violated preconditions | `NullPointerException`, `IllegalArgumentException`, `IndexOutOfBoundsException`, `ClassCastException`, `ArithmeticException` |

> [!NOTE] Key point
>
> <strong>Checked</strong> = `Exception` and its subclasses <em>except</em> `RuntimeException` subclasses. The compiler requires them to be caught or declared with `throws`. Everything else (`RuntimeException`, `Error`) is unchecked.

# throw vs throws

|  | `throw` | `throws` |
| --- | --- | --- |
| What | A statement that throws one exception object | Part of a method signature listing exceptions it may throw |
| Where | Method body: `throw new IllegalStateException("closed");` | Declaration: `void read() throws IOException` |
| Needed for | Any exception | <strong>Checked</strong> exceptions (optional for unchecked) |

```java filename:Java
import java.io.IOException;

public class Main {
    static int parseAge(String s) {                        // unchecked: no throws needed
        int age = Integer.parseInt(s);                     // may throw NumberFormatException
        if (age < 0) throw new IllegalArgumentException("negative age: " + age);
        return age;
    }

    static String load(String name) throws IOException {  // checked: must be declared
        if (name.isEmpty()) throw new IOException("no file name");
        return "data of " + name;
    }

    public static void main(String[] args) {
        for (String s : new String[] {"42", "-1", "abc"}) {
            try {
                System.out.println(parseAge(s));
            } catch (IllegalArgumentException e) {         // NumberFormatException is a subclass
                System.out.println(e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
        try {
            System.out.println(load("a.txt"));
            System.out.println(load(""));
        } catch (IOException e) {
            System.out.println("IO problem: " + e.getMessage());
        }
    }
}
```

```text filename:Output
42
IllegalArgumentException: negative age: -1
NumberFormatException: For input string: "abc"
data of a.txt
IO problem: no file name
```

# Handle or declare

Calling a method that throws a checked exception without catching or declaring it doesn't compile:

```java filename:Java
import java.nio.file.*;

public class Main {
    public static void main(String[] args) {
        String text = Files.readString(Path.of("notes.txt"));
        System.out.println(text);
    }
}
```

```text filename:Compiler%20error
Main.java:5: error: unreported exception IOException; must be caught or declared to be thrown
        String text = Files.readString(Path.of("notes.txt"));
                                      ^
```

# Stack unwinding

```java filename:Java
public class Main {
    static void c() { System.out.println("c throws"); throw new IllegalStateException("boom"); }
    static void b() { System.out.println("b calls c"); c(); System.out.println("b after c"); }  // never printed
    static void a() {
        try {
            b();
        } catch (IllegalStateException e) {
            System.out.println("a caught " + e.getMessage());
            StackTraceElement top = e.getStackTrace()[0];
            System.out.println("thrown in " + top.getMethodName() + "()");
        }
    }

    public static void main(String[] args) {
        a();
        System.out.println("program continues");
    }
}
```

```text filename:Output
b calls c
c throws
a caught boom
thrown in c()
program continues
```

The exception travels up from `c` through `b` (whose remaining code is skipped) until `a`'s `catch` matches. An uncaught exception in `main` terminates the thread and prints `Exception in thread "main" …` with the stack trace to <strong>stderr</strong>.

# Common exceptions to recognise

| Exception | Typical cause |
| --- | --- |
| `NullPointerException` | Calling a method / accessing a field on `null` (Java 14+ says <em>which</em> reference was null) |
| `ArrayIndexOutOfBoundsException` | `arr[arr.length]`, negative index |
| `ArithmeticException` | Integer division by zero (`5 / 0`); `5.0 / 0` is `Infinity`, no exception |
| `ClassCastException` | `(String) someInteger` at runtime |
| `NumberFormatException` | `Integer.parseInt("12a")` |
| `ConcurrentModificationException` | Modifying a collection while iterating it with for-each |
| `UnsupportedOperationException` | Adding to `List.of(…)` or `Arrays.asList(…)` |
| `IllegalStateException` | Method called at the wrong time (iterator `remove` twice, closed resource) |
| `StackOverflowError` | Infinite / too-deep recursion |
| `OutOfMemoryError` | Heap (or metaspace) exhausted |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Runnable[] bugs = {
            () -> System.out.println(10 / Integer.parseInt("0")),
            () -> java.util.List.of(1).add(2),
            () -> { Object o = "text"; Integer i = (Integer) o; System.out.println(i); },
            () -> { String s = null; System.out.println(s.length()); },
        };
        for (Runnable bug : bugs) {
            try {
                bug.run();
            } catch (RuntimeException e) {
                System.out.println(e.getClass().getSimpleName());
            }
        }
        try {
            int[] a = new int[3];
            a[3] = 1;
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
ArithmeticException
UnsupportedOperationException
ClassCastException
NullPointerException
Index 3 out of bounds for length 3
```

> [!WARNING] Watch out
>
> Never catch `Throwable` or `Error` just to keep going — an `OutOfMemoryError` or `StackOverflowError` leaves the JVM in a doubtful state. Catch the most specific exception you can actually handle.

```question
Checked vs unchecked exceptions?

---

Checked exceptions (`Exception` subclasses other than `RuntimeException`) must be caught or declared with `throws` — they model recoverable conditions like I/O failures. Unchecked (`RuntimeException`, `Error`) need not be declared — they usually indicate bugs (null, bad index, bad argument) or JVM failures.
```

```question
Error vs Exception?

---

`Error` signals serious problems the application generally can't recover from (`OutOfMemoryError`, `StackOverflowError`). `Exception` signals conditions a program might reasonably catch and handle.
```

```question
Is NullPointerException checked?

---

No — it extends `RuntimeException`. The compiler can't force you to handle it; prevent it with null checks, `Objects.requireNonNull`, `Optional` return types and not returning `null` from methods.
```
