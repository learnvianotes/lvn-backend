---
id: d350ef30-a903-7f12-a20d-afdf8d3f8b6c
key: topic:java/compilation-classloading
subject: java
topic: compilation-classloading
title: Compilation, Bytecode & Class Loading
slug: compilation-bytecode-class-loading
order: 1
---

`javac` turns each class into a `.class` file of bytecode; the JVM loads classes <em>lazily</em>, on first use, through a chain of class loaders.

`Main.java` → `javac` → `Main.class` (bytecode) → Class loader → Bytecode verifier → Interpreter / JIT → Native CPU

# Bytecode

> [!INFO]
>
> <strong>Bytecode</strong> — the instruction set of the JVM — a compact, stack-based code stored in `.class` files. Each class (including nested and anonymous classes) gets its own `.class` file, e.g. `Outer$Inner.class`.

You can read the bytecode with `javap -c`:

```filename:Terminal
$ cat Add.java
class Add { static int add(int a, int b) { return a + b; } }
$ javac Add.java && javap -c Add
  static int add(int, int);
    Code:
       0: iload_0        // push local 0 (a)
       1: iload_1        // push local 1 (b)
       2: iadd           // pop two ints, push their sum
       3: ireturn
```

# Class loading: load → link → initialise

1. <strong>Loading</strong>

   A class loader finds the bytes (from the module image, a JAR, the file system, the network…) and creates a `Class` object.

2. <strong>Linking — verify</strong>

   The bytecode verifier checks the code is type-safe and can't corrupt the stack or memory.

3. <strong>Linking — prepare</strong>

   Static fields are allocated and set to <em>default</em> values (`0`, `null`, `false`).

4. <strong>Linking — resolve</strong>

   Symbolic references (names of other classes, methods) become direct references (may be lazy).

5. <strong>Initialisation</strong>

   Static initialisers and static field assignments run, top to bottom — exactly once, on first <em>active use</em>.

# The class loader hierarchy

| Loader | Loads | Notes |
| --- | --- | --- |
| Bootstrap | Core modules: `java.base` (`java.lang`, `java.util`…) | Written in native code; appears as `null` from Java |
| Platform (was Extension) | Other Java SE / JDK modules (`java.sql`…) | Parent is bootstrap |
| Application (System) | Your classes from the class path / module path | Parent is platform |
| Custom | Anything you want (plugins, hot reload, app servers) | Extend `ClassLoader` |

> [!NOTE] Key point
>
> <strong>Parent delegation model:</strong> a loader first asks its parent to load a class, and only loads it itself if the parent can't. So nobody can replace `java.lang.String` with their own version.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(String.class.getClassLoader());              // bootstrap → null
        System.out.println(java.sql.Date.class.getClassLoader().getName());
        ClassLoader app = ClassLoader.getSystemClassLoader();
        System.out.println(app.getName() + " -> parent " + app.getParent().getName());
    }
}
```

```text filename:Output
null
platform
app -> parent platform
```

# Lazy initialisation — classes load on first use

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println("main starts");
        System.out.println(Config.NAME);     // compile-time constant: inlined, no init!
        System.out.println(Config.port);     // first active use → static block runs
        System.out.println(Config.port);     // already initialised
    }
}

class Config {
    static final String NAME = "app";       // constant — copied into the caller
    static int port = 8080;
    static { System.out.println("Config initialised"); }
}
```

```text filename:Output
main starts
app
Config initialised
8080
8080
```

> [!WARNING] Watch out
>
> `static final` fields initialised with a compile-time constant (`"app"`, `42`) are copied into the calling class at compile time. Reading them does <strong>not</strong> initialise the declaring class — and changing the constant requires recompiling the callers.

```question
What triggers class initialisation?

---

An <em>active use</em>: creating an instance (`new`), calling a static method, reading/writing a non-constant static field, reflection like `Class.forName("X")`, initialising a subclass (parent first), or it being the main class. Merely declaring a variable of that type or reading a compile-time constant does not.
```

```question
What is the parent delegation model and why does it exist?

---

Each class loader delegates a load request to its parent first. It guarantees core classes are always loaded by the bootstrap loader (security — you can't shadow `java.lang.Object`) and that a class is loaded only once per hierarchy.
```

```question
ClassNotFoundException vs NoClassDefFoundError?

---

`ClassNotFoundException` is a <em>checked exception</em> when code explicitly loads a class by name (`Class.forName`, `loadClass`) and it isn't found. `NoClassDefFoundError` is an <em>error</em> when a class that was present at compile time is missing (or failed static initialisation) at run time.
```
