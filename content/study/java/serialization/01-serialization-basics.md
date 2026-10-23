---
id: 75c7d5bd-1abe-7d58-953c-2f24c3353ff9
key: topic:java/serialization
subject: java
topic: serialization
title: Serialization Basics
slug: serialization-basics
order: 1
---

Java serialization turns an object graph into bytes (and back) — built into the language, but now considered a legacy mechanism with real security risks.

> [!INFO]
>
> <strong>Serialization</strong> — converting an object's state into a byte stream (`ObjectOutputStream.writeObject`) so it can be stored or sent; <strong>deserialization</strong> rebuilds the object from bytes (`ObjectInputStream.readObject`). A class opts in by implementing the <em>marker interface</em> `java.io.Serializable`.

# A round trip in memory

```java filename:Java
import java.io.*;

public class Main {
    static class User implements Serializable {
        private static final long serialVersionUID = 1L;
        String name;
        int age;
        transient String password;            // not written
        static String company = "Acme";       // static: belongs to the class, not written

        User(String name, int age, String password) {
            this.name = name; this.age = age; this.password = password;
        }
    }

    public static void main(String[] args) throws Exception {
        User original = new User("Asha", 30, "s3cret");

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(original);
        }

        User copy;
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            copy = (User) in.readObject();
        }
        System.out.println(copy.name + " " + copy.age + " " + copy.password);
        System.out.println(copy == original);
    }
}
```

```text filename:Output
Asha 30 null
false
```

> [!NOTE] No constructor
>
> Deserialization does <strong>not</strong> call your class's constructor — fields are filled in directly. `transient` fields come back as their default (`null`, `0`, `false`), and field initialisers don't run for them.

# The rules

| Rule | Detail |
| --- | --- |
| `implements Serializable` | marker interface — no methods. Otherwise `NotSerializableException`. |
| Every field must be serializable | or `transient`/`static`. One non-serializable field fails the whole graph. |
| `transient` | skip this field (passwords, caches, `Thread`s, connections). |
| `static` fields | never serialized — they belong to the class. |
| Superclass | if the parent isn't `Serializable`, it needs an accessible no-arg constructor, which runs on deserialization. |
| Object graph | references are followed; shared objects and cycles are written once. |
| Custom format | `private void writeObject(ObjectOutputStream)` / `readObject(ObjectInputStream)`, or `Externalizable`. |

```java filename:Java
import java.io.*;

public class Main {
    static class Connection {}                     // NOT Serializable

    static class Session implements Serializable {
        private static final long serialVersionUID = 1L;
        String user = "asha";
        Connection conn = new Connection();       // fix: mark it transient
    }

    public static void main(String[] args) throws IOException {
        try (ObjectOutputStream out = new ObjectOutputStream(new ByteArrayOutputStream())) {
            out.writeObject(new Session());
        } catch (NotSerializableException e) {
            System.out.println("NotSerializableException: " + e.getMessage());
        }
    }
}
```

```text filename:Output
NotSerializableException: Main$Connection
```

# `serialVersionUID`

A version number stored in the stream. On deserialization, the JVM compares it with the current class; if they differ you get `InvalidClassException`. If you don't declare one, the compiler computes it from the class's structure — so adding a method can break compatibility with previously saved data.

```java filename:Java
import java.io.Serializable;

class Order implements Serializable {
    private static final long serialVersionUID = 1L;   // declare it explicitly
    private final String id;
    private final int qty;

    Order(String id, int qty) { this.id = id; this.qty = qty; }
    String id() { return id; }
    int qty() { return qty; }
}
```

> [!TIP] Do
>
> Always declare `private static final long serialVersionUID` in a `Serializable` class; bump it only when a change is truly incompatible. (`javac -Xlint:serial` warns when it's missing.)

# Security and modern alternatives

> [!WARNING] Security
>
> <strong>Never deserialize untrusted bytes.</strong> `readObject` can instantiate any serializable class on the classpath and run its hooks — "gadget chains" in common libraries have produced remote-code-execution exploits. If you must, install an `ObjectInputFilter` (Java 9+) allow-list.

> [!NOTE] JSON (Jackson, Gson)
>
> Human-readable, language-neutral, the default for REST APIs. Works well with records.

> [!NOTE] Protocol Buffers / Avro
>
> Compact binary with an explicit schema and versioning rules — service-to-service and event streams.

> [!NOTE] Records + serialization
>
> Serializable records are deserialized through their canonical constructor, so validation still runs — safer than classes.

> [!NOTE] Plain Java serialization
>
> OK for short-lived in-JVM caches or legacy protocols (RMI). Avoid for long-term storage or network input.

```question
What is the purpose of serialVersionUID?

---

It versions the serialized form. When bytes are read back, the stored UID must equal the class's UID or `InvalidClassException` is thrown. Declaring it explicitly keeps compatible changes (adding a field) readable; relying on the computed default makes almost any change incompatible, and the value can differ between compilers.
```

```question
What does transient do? Are static fields serialized?

---

`transient` excludes an instance field from serialization; after deserialization it holds its default value. Static fields are never serialized because they belong to the class, not the object — after deserialization they show whatever the class currently holds.
```

```question
Serializable vs Externalizable?

---

`Serializable` is a marker; the JVM writes all non-transient fields automatically (customisable via `writeObject`/`readObject`). `Externalizable` makes you implement `writeExternal`/`readExternal` yourself — full control and potentially faster, but you must write every field and the class needs a public no-arg constructor.
```

```question
Why is Java serialization considered dangerous?

---

Deserialization builds objects without constructors and can trigger methods (`readObject`, `readResolve`, `hashCode` in hash-based collections) on any class on the classpath. Attackers craft byte streams that chain these into arbitrary code execution. Mitigations: don't accept serialized data from untrusted sources, use `ObjectInputFilter`, prefer JSON/protobuf.
```
