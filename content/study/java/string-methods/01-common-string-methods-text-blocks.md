---
id: 9d7af8cb-dcd9-7c3e-9f2d-2d586bde5316
key: topic:java/string-methods
subject: java
topic: string-methods
title: Common String Methods & Text Blocks
slug: common-string-methods-text-blocks
order: 1
---

The `String` API you use daily — searching, slicing, splitting, formatting — plus Java 15 text blocks for multi-line literals.

# Method cheat sheet

| Method | Returns | Example → result |
| --- | --- | --- |
| `length()` | int | `"hello".length()` → `5` |
| `charAt(i)` | char | `"hello".charAt(1)` → `'e'` |
| `substring(b, e)` | String | `"hello".substring(1, 3)` → `"el"` (end exclusive) |
| `indexOf(x)` / `lastIndexOf(x)` | int | `-1` when not found |
| `contains`, `startsWith`, `endsWith` | boolean | `"hello".startsWith("he")` → `true` |
| `toUpperCase()` / `toLowerCase()` | String | new string |
| `trim()` / `strip()` | String | `strip()` (Java 11) is Unicode-aware |
| `isEmpty()` / `isBlank()` | boolean | `" ".isBlank()` → `true` (Java 11) |
| `replace(a, b)` | String | literal replace of all occurrences |
| `replaceAll(regex, b)` | String | regex-based |
| `split(regex)` | String\[\] | trailing empty strings removed |
| `toCharArray()` / `chars()` | char\[\] / IntStream | iterate characters |
| `compareTo(s)` | int | lexicographic: negative / 0 / positive |
| `repeat(n)` | String | `"ab".repeat(3)` → `"ababab"` (Java 11) |
| `String.valueOf(x)` | String | any type → string (`"null"` for null objects) |
| `String.format` / `formatted` | String | printf-style formatting |

# Searching &amp; slicing

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String s = "Hello, World";
        System.out.println(s.length() + " " + s.charAt(7));
        System.out.println(s.substring(7) + "|" + s.substring(0, 5));
        System.out.println(s.indexOf('o') + " " + s.lastIndexOf('o') + " " + s.indexOf("xyz"));
        System.out.println(s.contains("World") + " " + s.startsWith("Hell"));
        System.out.println(s.toLowerCase().replace('l', 'L'));
        System.out.println("  padded  ".strip() + "|" + "   ".isBlank() + "|" + "".isEmpty());
        System.out.println("apple".compareTo("banana") + " " + "b".compareTo("a"));
        System.out.println("Java".equalsIgnoreCase("JAVA"));
    }
}
```

```text filename:Output
12 W
World|Hello
4 8 -1
true true
heLLo, worLd
padded|true|true
-1 1
true
```

# Splitting &amp; joining

```java filename:Java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        System.out.println(Arrays.toString("a,b,,c,,".split(",")));      // trailing empties dropped
        System.out.println(Arrays.toString("a,b,,c,,".split(",", -1)));  // keep them
        System.out.println(Arrays.toString("1.2.3".split("\\.")));       // "." is a regex!
        System.out.println(Arrays.toString("  one   two three ".trim().split("\\s+")));
        System.out.println(String.join(" | ", Arrays.asList("x", "y", "z")));
    }
}
```

```text filename:Output
[a, b, , c]
[a, b, , c, , ]
[1, 2, 3]
[one, two, three]
x | y | z
```

> [!WARNING] Watch out
>
> `split` takes a <strong>regex</strong>: `split(".")` returns an empty array because `.` matches every character. Escape metacharacters: `"\\."`, `"\\|"`, or use `Pattern.quote(".")`.

# Characters

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String word = "Level42";
        int letters = 0, digits = 0;
        for (char c : word.toCharArray()) {
            if (Character.isLetter(c)) letters++;
            else if (Character.isDigit(c)) digits++;
        }
        System.out.println(letters + " letters, " + digits + " digits");
        System.out.println((int) 'a' + " " + (char) ('a' + 2) + " " + ('7' - '0'));
        System.out.println(new StringBuilder(word).reverse());
        System.out.println(word.chars().filter(Character::isUpperCase).count());
    }
}
```

```text filename:Output
5 letters, 2 digits
97 c 7
24leveL
1
```

# Formatting

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(String.format("%-6s|%5d|%.2f|%05d", "id", 42, 3.14159, 7));
        System.out.println("%s is %d years".formatted("Asha", 30));    // Java 15
        System.out.printf("%x %o %e %b%n", 255, 8, 12345.678, true);
        System.out.println(String.format("%,d", 1234567));
    }
}
```

```text filename:Output
id    |   42|3.14|00007
Asha is 30 years
ff 10 1.234568e+04 true
1,234,567
```

# Text blocks (Java 15)

A text block starts with `"""` followed by a newline. Incidental indentation (the common leading whitespace) is stripped, and line endings are normalised to `\n` — ideal for JSON, SQL and HTML.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String json = """
            {
              "name": "Asha",
              "age": 30
            }
            """;
        System.out.print(json);
        String oneLine = """
            SELECT * \
            FROM users""";                  // \ joins lines
        System.out.println(oneLine);
        System.out.println("""
            Hi %s!""".formatted("Ravi"));
    }
}
```

```text filename:Output
{
  "name": "Asha",
  "age": 30
}
SELECT * FROM users
Hi Ravi!
```

> [!NOTE] Text blocks
>
> The position of the closing `"""` controls indentation: put it on its own line to get a trailing newline; put it after the last text to avoid one.

```question
What is the difference between trim() and strip()?

---

`trim()` removes characters with code point ≤ `U+0020` (ASCII spaces and control chars). `strip()` (Java 11) uses `Character.isWhitespace`, so it also removes Unicode whitespace such as `U+2000`. `stripLeading()` / `stripTrailing()` do one side.
```

```question
What is the difference between replace and replaceAll?

---

Both replace <em>all</em> occurrences. `replace(CharSequence, CharSequence)` treats the target literally; `replaceAll(String regex, String replacement)` interprets a regular expression (and `$` / `\` in the replacement).
```

```question
How do you check if a string is a palindrome?

---

Compare `s` with `new StringBuilder(s).reverse().toString()` using `equals`, or use two indices moving towards the middle — the latter is O(1) extra space.
```
