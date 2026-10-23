---
id: a9c828aa-dc2c-775a-b5b5-9ee2d98d8a61
key: topic:java/optional
subject: java
topic: optional
title: Optional
slug: optional
order: 1
---

A container that holds either one value or nothing — a return type that forces callers to think about <em>absence</em> instead of forgetting a null check.

> [!INFO]
>
> <strong>Optional&lt;T&gt;</strong> — an immutable box that is either <em>present</em> (holds a non-null value) or <em>empty</em>. Introduced in Java 8, designed for <strong>method return types</strong> where "no result" is a normal outcome.

# Creating

| Factory | When |
| --- | --- |
| `Optional.of(v)` | `v` is definitely non-null — throws `NullPointerException` otherwise |
| `Optional.ofNullable(v)` | `v` may be `null` → empty |
| `Optional.empty()` | explicitly no value |

# Using the value — don't just call `get()`

```java filename:Java
import java.util.*;

public class Main {
    static Map<String, String> emails = Map.of("asha", "asha@mail.com");

    static Optional<String> findEmail(String user) {
        return Optional.ofNullable(emails.get(user));
    }

    public static void main(String[] args) {
        System.out.println(findEmail("asha"));
        System.out.println(findEmail("ravi"));

        System.out.println(findEmail("ravi").orElse("no-email"));
        System.out.println(findEmail("asha").map(String::toUpperCase).orElse("?"));
        System.out.println(findEmail("asha").filter(e -> e.endsWith(".org")).isPresent());
        findEmail("asha").ifPresent(e -> System.out.println("send to " + e));
        findEmail("ravi").ifPresentOrElse(
                e -> System.out.println("send to " + e),
                () -> System.out.println("nobody to email"));
        try {
            findEmail("ravi").orElseThrow();
        } catch (NoSuchElementException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
Optional[asha@mail.com]
Optional.empty
no-email
ASHA@MAIL.COM
false
send to asha@mail.com
nobody to email
No value present
```

| Method | Does |
| --- | --- |
| `isPresent()` / `isEmpty()` (11+) | test |
| `get()` / `orElseThrow()` (10+) | value or `NoSuchElementException` — prefer the clearer `orElseThrow()` |
| `orElse(x)` | value or `x` (x is <strong>always evaluated</strong>) |
| `orElseGet(supplier)` | value or `supplier.get()` (evaluated <strong>only if empty</strong>) |
| `orElseThrow(() -> new MyEx())` | value or your exception |
| `map(f)` / `flatMap(f)` | transform if present (`flatMap` when `f` already returns an `Optional`) |
| `filter(pred)` | empty unless the predicate holds |
| `ifPresent(c)` / `ifPresentOrElse(c, r)` (9+) | run code |
| `or(supplier)` (9+) | fall back to another `Optional` |
| `stream()` (9+) | 0- or 1-element stream |

# The `orElse` vs `orElseGet` trap

```java filename:Java
import java.util.*;

public class Main {
    static String expensiveDefault() {
        System.out.println("  (computing default...)");
        return "default";
    }

    public static void main(String[] args) {
        Optional<String> name = Optional.of("Asha");
        System.out.println("orElse:");
        System.out.println(name.orElse(expensiveDefault()));      // default is computed anyway!
        System.out.println("orElseGet:");
        System.out.println(name.orElseGet(Main::expensiveDefault)); // lazy — not called
    }
}
```

```text filename:Output
orElse:
  (computing default...)
Asha
orElseGet:
Asha
```

> [!WARNING] Watch out
>
> `orElse(createUser())` runs `createUser()` even when the value is present — wasteful, or a real bug if it has side effects (a DB insert). Use `orElseGet` for anything non-trivial.

# `map` vs `flatMap` — chaining without null checks

```java filename:Java
import java.util.*;

public class Main {
    record Address(String city) {}
    record User(String name, Optional<Address> address) {}

    public static void main(String[] args) {
        User withAddr = new User("Asha", Optional.of(new Address("Pune")));
        User without = new User("Ravi", Optional.empty());

        for (User u : List.of(withAddr, without)) {
            String city = Optional.of(u)
                    .flatMap(User::address)          // already Optional → flatMap
                    .map(Address::city)              // plain value → map
                    .orElse("unknown");
            System.out.println(u.name() + ": " + city);
        }
    }
}
```

```text filename:Output
Asha: Pune
Ravi: unknown
```

> [!NOTE] Demo only
>
> The record above stores an `Optional` field only to demonstrate `flatMap`. In real code, keep the field nullable and expose `Optional<Address> address()` from a getter.

# How <em>not</em> to use Optional

> [!TIP] Do
>
> Return `Optional<T>` from methods that may find nothing (`findById`, `max`). Chain with `map`/`filter`/`orElse`. Return empty collections, not `Optional<List<T>>`.

> [!DANGER] Avoid
>
> Optional fields, method parameters or collection elements; `Optional.get()` without a check; `if (opt.isPresent()) opt.get()` (just a verbose null check); returning `null` from a method whose return type is `Optional`.

`Optional` is not `Serializable`, adds an allocation, and a parameter of type `Optional` can itself be `null` — so it solves nothing there. Primitive versions `OptionalInt`, `OptionalLong`, `OptionalDouble` avoid boxing (returned by `IntStream.max()` etc.).

```question
Why was Optional added?

---

To make "no result" explicit in an API's type. A method returning `Optional<User>` tells callers at compile time that the user may be missing, pushing them to handle it (`orElse`, `orElseThrow`) instead of risking a `NullPointerException`. It was designed primarily for stream results like `findFirst` and `max`.
```

```question
Difference between orElse and orElseGet?

---

`orElse(value)` takes an already-computed value, so its argument is evaluated even when the Optional is present. `orElseGet(supplier)` takes a function that is called only when empty. Use `orElse` for constants, `orElseGet` for anything costly or with side effects.
```

```question
Should you use Optional as a field or method parameter?

---

No. It's intended for return types. As a field it isn't serializable and adds overhead; as a parameter the caller could still pass `null`, and overloading or a nullable parameter is clearer.
```
