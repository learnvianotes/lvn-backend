---
id: 913e24f6-0470-7a6a-85a9-d21ab5f739bc
key: topic:java/try-catch-finally
subject: java
topic: try-catch-finally
title: try/catch/finally & try-with-resources
slug: try-catch-finally-try-with-resources
order: 1
---

`try` marks code that may fail, `catch` handles specific exceptions, `finally` always runs — and try-with-resources closes resources automatically, in reverse order, without losing exceptions.

# Anatomy

```java filename:Java
public class Main {
    static void run(String input) {
        try {
            System.out.println("parsing " + input);
            int n = Integer.parseInt(input);
            System.out.println("100 / n = " + 100 / n);
        } catch (NumberFormatException | ArithmeticException e) {   // multi-catch
            System.out.println("bad input: " + e.getClass().getSimpleName());
        } finally {
            System.out.println("finally");                          // always
        }
    }

    public static void main(String[] args) {
        run("4");
        run("0");
        run("x");
    }
}
```

```text filename:Output
parsing 4
100 / n = 25
finally
parsing 0
bad input: ArithmeticException
finally
parsing x
bad input: NumberFormatException
finally
```

- Catch blocks are tried <strong>top to bottom</strong>; the first matching type wins.
- A subclass catch must come <strong>before</strong> its superclass — `catch (Exception e)` then `catch (IOException e)` doesn't compile (unreachable).
- In a multi-catch `A | B`, the types can't be related by inheritance and `e` is implicitly `final`.
- `try` needs at least one `catch` or a `finally` (or resources).

# finally always runs — even after return

```java filename:Java
public class Main {
    static int value() {
        try {
            return 1;
        } finally {
            System.out.println("finally runs before the method returns");
        }
    }

    @SuppressWarnings("finally")
    static int overridden() {
        try {
            throw new RuntimeException("lost!");
        } finally {
            return 2;              // discards the exception AND any earlier return
        }
    }

    static int snapshot() {
        int x = 10;
        try {
            return x;              // return value (10) is saved here
        } finally {
            x = 99;                // changing x doesn't affect it
        }
    }

    public static void main(String[] args) {
        System.out.println(value());
        System.out.println(overridden());
        System.out.println(snapshot());
    }
}
```

```text filename:Output
finally runs before the method returns
1
2
10
```

> [!WARNING] Trap
>
> Never `return` (or `throw`) from a `finally` block: it silently replaces the method's result and <strong>swallows</strong> any exception in flight. The only ways `finally` doesn't run are `System.exit()`, the JVM crashing, or the thread being killed.

# try-with-resources

Any object implementing `AutoCloseable` (or `Closeable`) declared in the `try (…)` header is closed automatically when the block ends — normally or by exception. Resources close in <strong>reverse</strong> order of declaration.

```java filename:Java
public class Main {
    record Res(String name) implements AutoCloseable {
        Res { System.out.println("open " + name); }
        @Override public void close() { System.out.println("close " + name); }
    }

    public static void main(String[] args) {
        try (Res db = new Res("db"); Res file = new Res("file")) {
            System.out.println("working with " + db.name() + " and " + file.name());
            throw new IllegalStateException("failure");
        } catch (IllegalStateException e) {
            System.out.println("caught " + e.getMessage() + " (resources already closed)");
        } finally {
            System.out.println("finally");
        }
    }
}
```

```text filename:Output
open db
open file
working with db and file
close file
close db
caught failure (resources already closed)
finally
```

# Suppressed exceptions

If the body throws <em>and</em> `close()` throws, the body's exception is the one propagated; the close exception is attached to it as <strong>suppressed</strong> instead of replacing it (which is what a hand-written `finally { close(); }` would do).

```java filename:Java
public class Main {
    static class Conn implements AutoCloseable {
        @Override public void close() { throw new IllegalStateException("close failed"); }
    }

    public static void main(String[] args) {
        try (Conn c = new Conn()) {
            throw new RuntimeException("query failed");
        } catch (RuntimeException e) {
            System.out.println("primary: " + e.getMessage());
            for (Throwable s : e.getSuppressed())
                System.out.println("suppressed: " + s.getMessage());
        }
    }
}
```

```text filename:Output
primary: query failed
suppressed: close failed
```

# Before and after

> [!TIP] Do
>
> `try (var in = Files.newBufferedReader(path)) { … }` — closed on every path, exceptions preserved. Java 9+ also accepts an existing effectively-final variable: `try (in) { … }`.

> [!DANGER] Avoid
>
> Manual `finally { if (in != null) in.close(); }` — verbose, `close()` needs its own try/catch, and an exception from `close()` hides the real one.

```question
Does finally run if there's a return in try?

---

Yes. The return value is computed and saved, `finally` runs, then the method returns. If `finally` itself returns, that value wins and any pending exception is discarded — so never return from `finally`.
```

```question
When does finally NOT execute?

---

When the JVM stops: `System.exit()`, a crash / `kill -9`, or power loss. (Also if the `try` never completes, e.g. an infinite loop, or a daemon thread killed at JVM exit.)
```

```question
What are suppressed exceptions?

---

In try-with-resources, if the body throws and then `close()` also throws, the close exception is added to the primary one via `addSuppressed` and can be read with `getSuppressed()`, so no failure is lost.
```

```question
In what order are resources closed?

---

Reverse order of declaration — the last opened is closed first, like a stack — and before any `catch` or `finally` block of that statement runs.
```
