---
id: d609fb0f-6de6-7406-9f9b-81969041cb82
key: topic:java/custom-exceptions
subject: java
topic: custom-exceptions
title: Custom Exceptions & Best Practices
slug: custom-exceptions-best-practices
order: 1
---

Define your own exception types when callers need to react to a specific failure — and always keep the original cause attached.

# Defining one

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Account acc = new Account(100);
        try {
            acc.withdraw(30);
            acc.withdraw(500);
        } catch (InsufficientFundsException e) {
            System.out.println(e.getMessage());
            System.out.println("short by " + e.shortfall());
        }
    }
}

// Checked: the caller can reasonably recover (show a message, offer a smaller amount)
class InsufficientFundsException extends Exception {
    private final long shortfall;
    InsufficientFundsException(long balance, long requested) {
        super("balance " + balance + " < requested " + requested);
        this.shortfall = requested - balance;
    }
    long shortfall() { return shortfall; }
}

class Account {
    private long balance;
    Account(long balance) { this.balance = balance; }
    void withdraw(long amount) throws InsufficientFundsException {
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");  // bug → unchecked
        if (amount > balance) throw new InsufficientFundsException(balance, amount);
        balance -= amount;
    }
}
```

```text filename:Output
balance 70 < requested 500
short by 430
```

# Checked or unchecked?

| Choose | When | Extend |
| --- | --- | --- |
| <strong>Checked</strong> | The caller can and should recover: file missing, payment declined, validation of external input | `Exception` |
| <strong>Unchecked</strong> | Programming errors / violated preconditions, or failures nobody nearby can handle | `RuntimeException` |

Modern code (Spring, most libraries, lambdas and streams) leans unchecked: checked exceptions don't compose with functional interfaces like `Function`, and they leak implementation details up the call chain.

# Exception chaining: keep the cause

```java filename:Java
public class Main {
    static class ConfigException extends RuntimeException {
        ConfigException(String msg, Throwable cause) { super(msg, cause); }
    }

    static int loadPort(String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw new ConfigException("invalid port in config: " + raw, e);   // wrap, keep cause
        }
    }

    public static void main(String[] args) {
        try {
            loadPort("80a");
        } catch (ConfigException e) {
            System.out.println(e.getMessage());
            System.out.println("caused by " + e.getCause().getClass().getSimpleName()
                               + ": " + e.getCause().getMessage());
        }
    }
}
```

```text filename:Output
invalid port in config: 80a
caused by NumberFormatException: For input string: "80a"
```

Translate low-level exceptions into ones that match your layer's abstraction (a repository throws `DataAccessException`, not `SQLException`) — but pass the original as the <strong>cause</strong> so the stack trace still shows the root problem (`Caused by: …`).

# Anti-patterns

| Anti-pattern | Why it hurts | Instead |
| --- | --- | --- |
| `catch (Exception e) {}` | Swallows the failure — the bug disappears silently | Handle it, or let it propagate |
| `e.printStackTrace()` and continue | Output goes to stderr, program runs on with bad state | Log with a logger and rethrow/handle |
| `throw new RuntimeException(e.getMessage())` | Loses the original type and stack trace | `throw new XException("context", e)` |
| Catch-log-rethrow at every layer | The same error is logged five times | Log once, where it's handled |
| Exceptions for control flow | Slow (stack trace capture) and hides intent | Use `if`, `Optional`, return values |
| `throws Exception` on every method | Callers can't tell what can go wrong | Declare specific types |
| Catching `NullPointerException` | Masks a bug | Fix the null source / validate early |

# Best practices

- <strong>Fail fast</strong>: validate arguments at the start of a method (`Objects.requireNonNull`, `IllegalArgumentException`).
- Use <strong>standard exceptions</strong> when they fit: `IllegalArgumentException`, `IllegalStateException`, `UnsupportedOperationException`, `NoSuchElementException`.
- Put useful context in the message: the bad value, the id, the expected range.
- Name custom types `…Exception` and provide `(String message)` and `(String message, Throwable cause)` constructors.
- Restore the interrupt flag if you catch `InterruptedException` and can't rethrow it: `Thread.currentThread().interrupt();`.
- Clean up with try-with-resources, not `finally` blocks.

```question
How do you create a custom exception?

---

Extend `Exception` (checked) or `RuntimeException` (unchecked), add constructors that call `super(message)` and `super(message, cause)`, and optionally add fields carrying extra context (an error code, the invalid value).
```

```question
What is exception chaining and why use it?

---

Wrapping a caught exception as the <em>cause</em> of a new, higher-level one (`new ServiceException("…", e)`). The API stays at the right abstraction level while the full root cause remains available via `getCause()` and in the `Caused by:` part of the stack trace.
```

```question
Why are exceptions expensive?

---

Creating one captures the whole stack trace (`fillInStackTrace`), which walks the stack. That's fine for exceptional cases but wasteful as normal control flow in a hot loop.
```
