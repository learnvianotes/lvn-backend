---
id: 09e97d56-73bc-75ba-84dc-77d894464108
key: topic:java/encapsulation
subject: java
topic: encapsulation
title: Encapsulation
slug: encapsulation
order: 1
---

Keep fields `private` and expose behaviour through methods, so the class alone guarantees that its state is always valid.

> [!INFO]
>
> <strong>Encapsulation</strong> — bundling data with the methods that operate on it, and <strong>hiding the data</strong> so outside code can change it only through a controlled interface.

# Why it matters

> [!NOTE] Invariants
>
> The class validates every change, so an object can never be in an illegal state (negative balance, empty name).

> [!NOTE] Freedom to change
>
> Internal representation can change (cents instead of double) without breaking callers.

> [!NOTE] Easier debugging
>
> Every mutation passes through a few methods — one place for a breakpoint or log.

> [!NOTE] Thread safety
>
> Controlled access is where you add synchronisation or make the class immutable.

# Getters, setters and validation

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Account acc = new Account("Asha", 1000);
        acc.withdraw(300);
        System.out.println(acc.getOwner() + ": " + acc.getBalance());
        try {
            acc.withdraw(5000);
        } catch (IllegalArgumentException e) {
            System.out.println("rejected: " + e.getMessage());
        }
        System.out.println("balance still " + acc.getBalance());
    }
}

class Account {
    private final String owner;
    private long balance;                  // hidden: no one can set it to -1

    Account(String owner, long opening) {
        if (owner == null || owner.isBlank()) throw new IllegalArgumentException("owner required");
        this.owner = owner;
        this.balance = opening;
    }

    String getOwner() { return owner; }
    long getBalance() { return balance; }  // read-only: no setBalance()

    void withdraw(long amount) {
        if (amount <= 0 || amount > balance)
            throw new IllegalArgumentException("invalid amount " + amount);
        balance -= amount;
    }
}
```

```text filename:Output
Asha: 700
rejected: invalid amount 5000
balance still 700
```

> [!NOTE] Key point
>
> Don't generate a setter for every field. Expose <em>operations</em> (`withdraw`, `rename`) that express intent and enforce rules — a public getter + setter pair on every field is barely better than a public field.

# Leaking mutable state — and defensive copies

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> input = new ArrayList<>(List.of("math", "physics"));
        Leaky leaky = new Leaky(input);
        Safe safe = new Safe(input);

        input.add("hacked");                 // caller mutates its own list
        leaky.getSubjects().clear();         // caller mutates via the getter

        System.out.println("leaky: " + leaky.getSubjects());
        System.out.println("safe:  " + safe.getSubjects());
        try {
            safe.getSubjects().add("x");
        } catch (UnsupportedOperationException e) {
            System.out.println("safe getter is read-only");
        }
    }
}

class Leaky {
    private final List<String> subjects;
    Leaky(List<String> subjects) { this.subjects = subjects; }   // stores caller's list
    List<String> getSubjects() { return subjects; }              // hands out internals
}

class Safe {
    private final List<String> subjects;
    Safe(List<String> subjects) { this.subjects = List.copyOf(subjects); }   // copy in
    List<String> getSubjects() { return subjects; }                          // already unmodifiable
}
```

```text filename:Output
leaky: []
safe:  [math, physics]
safe getter is read-only
```

> [!TIP] Do
>
> Copy mutable arguments on the way in and return copies or unmodifiable views on the way out (`List.copyOf`, `new Date(d.getTime())`).

> [!DANGER] Avoid
>
> Returning a reference to an internal array, list or `Date` — callers can then change your object's state behind its back.

# Encapsulation vs abstraction

|  | Encapsulation | Abstraction |
| --- | --- | --- |
| Focus | <em>How</em> data is protected | <em>What</em> is exposed |
| Mechanism | `private` fields, accessors, validation | Interfaces, abstract classes, simple method names |
| Level | Implementation | Design |

```question
How do you achieve encapsulation in Java?

---

Make fields `private`, provide methods (getters, intention-revealing operations) that validate changes, and avoid leaking references to mutable internals — use defensive copies.
```

```question
Is a class with private fields and public getters/setters for all of them encapsulated?

---

Only nominally. If every setter accepts anything, the class can't protect its invariants. Real encapsulation exposes behaviour and validates every state change.
```

```question
What is a JavaBean?

---

A convention: public no-arg constructor, private fields, `getX`/`setX` (`isX` for booleans) accessors, and usually `Serializable`. Frameworks use reflection on these names.
```
