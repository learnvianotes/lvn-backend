---
id: 9a2db612-659a-7ca7-a323-bb695c9c1f8e
key: topic:java/file-io
subject: java
topic: file-io
title: File I/O with java.nio.file
slug: file-i-o-with-java-nio-file
order: 1
---

Modern file handling uses `Path` and the static helpers in `Files` — one line for small files, buffered streams for large ones, try-with-resources for everything that must be closed.

# The two generations

|  | `java.io` (1996) | `java.nio.file` (Java 7, NIO.2) |
| --- | --- | --- |
| Path type | `File` | `Path` (`Path.of("a", "b.txt")`) |
| Errors | many methods return `false` silently | descriptive `IOException`s (`NoSuchFileException`…) |
| Helpers | streams and readers only | `Files.readString`, `write`, `lines`, `walk`, `copy`, `move`… |
| Extras | — | symbolic links, attributes, `WatchService`, file systems (zip) |

Streams (`InputStream`/`OutputStream`) move <strong>bytes</strong>; readers/writers (`Reader`/`Writer`) move <strong>characters</strong> and need a charset. Always name it (`StandardCharsets.UTF_8`) — the `Files` methods default to UTF-8.

# `Path` basics

```java filename:Java
import java.nio.file.*;

public class Main {
    public static void main(String[] args) {
        Path p = Path.of("/home/asha/docs/../notes/report.txt");
        System.out.println(p.getFileName());
        System.out.println(p.getParent());
        System.out.println(p.normalize());
        System.out.println(p.getNameCount());
        System.out.println(Path.of("/data").resolve("logs/app.log"));
        System.out.println(Path.of("/a/b").relativize(Path.of("/a/c/d")));
        System.out.println(p.toString().endsWith(".txt"));
    }
}
```

```text filename:Output
report.txt
/home/asha/docs/../notes
/home/asha/notes/report.txt
6
/data/logs/app.log
../c/d
true
```

# Small files: one-liners

```java filename:Java
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        Path file = Files.createTempFile("notes", ".txt");
        try {
            Files.writeString(file, "line one\nline two\n");
            Files.write(file, List.of("line three"), StandardOpenOption.APPEND);

            System.out.print(Files.readString(file));
            List<String> lines = Files.readAllLines(file);
            System.out.println(lines.size() + " lines, last = " + lines.get(lines.size() - 1));
            System.out.println(Files.exists(file) + " " + Files.size(file) + " bytes");
        } finally {
            Files.deleteIfExists(file);
        }
        System.out.println("exists after delete: " + Files.exists(file));
    }
}
```

```text filename:Output
line one
line two
line three
3 lines, last = line three
true 29 bytes
exists after delete: false
```

> [!WARNING] Watch out
>
> `readString` / `readAllLines` load the <strong>whole file</strong> into memory — fine for configs, an `OutOfMemoryError` for a 5 GB log. Stream large files instead.

# Large files: stream line by line

```java filename:Java
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) throws IOException {
        Path log = Files.createTempFile("app", ".log");
        try {
            try (BufferedWriter w = Files.newBufferedWriter(log, StandardCharsets.UTF_8)) {
                for (int i = 1; i <= 5; i++) {
                    w.write((i % 2 == 0 ? "ERROR " : "INFO ") + "event " + i);
                    w.newLine();
                }
            }                                           // closed (and flushed) here

            try (BufferedReader r = Files.newBufferedReader(log)) {
                String line;
                while ((line = r.readLine()) != null) {
                    if (line.startsWith("ERROR")) System.out.println(line);
                }
            }

            try (Stream<String> lines = Files.lines(log)) {   // lazy — must be closed
                System.out.println(lines.filter(l -> l.startsWith("INFO")).count() + " info lines");
            }
        } finally {
            Files.delete(log);
        }
    }
}
```

```text filename:Output
ERROR event 2
ERROR event 4
3 info lines
```

> [!NOTE] Close what you open
>
> `Files.lines`, `Files.list`, `Files.walk` and `Files.newBufferedReader` hold an open file handle. Wrap them in <strong>try-with-resources</strong>, or you leak file descriptors until the GC gets around to it.

# Directories: create, walk, copy, move

```java filename:Java
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) throws IOException {
        Path root = Files.createTempDirectory("demo");
        Files.createDirectories(root.resolve("src/main"));
        Files.writeString(root.resolve("src/main/App.java"), "class App {}");
        Files.writeString(root.resolve("README.md"), "# demo");
        Files.copy(root.resolve("README.md"), root.resolve("src/README.copy"));
        Files.move(root.resolve("README.md"), root.resolve("NOTES.md"));

        try (Stream<Path> all = Files.walk(root)) {
            all.map(p -> root.relativize(p).toString().replace('\\', '/'))
               .filter(s -> !s.isEmpty())
               .sorted()
               .forEach(System.out::println);
        }

        try (Stream<Path> all = Files.walk(root)) {       // delete children before parents
            for (Path p : all.sorted(Comparator.reverseOrder()).toList()) Files.delete(p);
        }
        System.out.println(Files.exists(root));
    }
}
```

```text filename:Output
NOTES.md
src
src/README.copy
src/main
src/main/App.java
false
```

| Task | Call |
| --- | --- |
| Create dir (and parents) | `Files.createDirectories(path)` |
| List one level / whole tree | `Files.list(dir)` / `Files.walk(dir)` / `Files.find(dir, depth, matcher)` |
| Copy / move (overwrite) | `Files.copy(a, b, StandardCopyOption.REPLACE_EXISTING)` / `Files.move(...)` |
| Delete | `Files.delete(p)` (throws if missing) / `Files.deleteIfExists(p)` |
| Checks | `Files.exists`, `isDirectory`, `isRegularFile`, `isReadable`, `size`, `getLastModifiedTime` |
| Binary | `Files.readAllBytes`, `Files.newInputStream` / `newOutputStream` |

```question
Why wrap I/O in try-with-resources?

---

Files, sockets and streams hold OS resources. try-with-resources calls `close()` automatically in reverse order, even when an exception is thrown, and records exceptions from `close()` as <em>suppressed</em> instead of losing the original one. Before Java 7 this took a verbose `finally` block that was easy to get wrong.
```

```question
Why use BufferedReader/BufferedWriter?

---

Unbuffered streams make a system call for every read/write. Buffering batches data in an in-memory buffer (8 KB by default), cutting system calls dramatically; `BufferedReader` also adds `readLine()`. Remember that a `BufferedWriter` must be flushed/closed or the last chunk never reaches the file.
```

```question
Byte streams vs character streams?

---

`InputStream`/`OutputStream` handle raw bytes — images, zip files, serialized objects. `Reader`/`Writer` handle text and decode/encode it with a charset. Bridge them with `InputStreamReader` / `OutputStreamWriter`, always passing an explicit charset.
```
