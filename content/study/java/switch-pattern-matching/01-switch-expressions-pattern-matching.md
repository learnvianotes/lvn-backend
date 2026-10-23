---
id: 547d1c0d-6b9a-7bb0-aca6-45069933a48a
key: topic:java/switch-pattern-matching
subject: java
topic: switch-pattern-matching
title: Switch Expressions & Pattern Matching
slug: switch-expressions-pattern-matching
order: 1
---

Modern `switch` (Java 14) is an expression with arrow labels and no fall-through; Java 16–21 add pattern matching for `instanceof`, type patterns in `switch`, guards and record patterns.

# Classic switch statement (fall-through)

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int day = 2;
        switch (day) {
            case 1:
                System.out.println("Mon");
            case 2:
                System.out.println("Tue");      // matches here...
            case 3:
                System.out.println("Wed");      // ...and falls through (no break!)
                break;
            default:
                System.out.println("Other");
        }
    }
}
```

```text filename:Output
Tue
Wed
```

Old-style `switch` works on `int`-like types (`byte`, `short`, `char`, `int` and their wrappers), `String` (Java 7) and `enum` — never on `long`, `float`, `double` or `boolean`.

# Switch expressions (Java 14)

```java filename:Java
public class Main {
    enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

    static int letters(Day d) {
        return switch (d) {                     // an expression — yields a value
            case MON, FRI, SUN -> 6;            // several labels, no fall-through
            case TUE -> 7;
            case THU, SAT -> 8;
            case WED -> {
                int n = "Wednesday".length();
                yield n;                        // yield returns from a block
            }
        };                                      // exhaustive over the enum: no default needed
    }

    public static void main(String[] args) {
        System.out.println(letters(Day.MON) + " " + letters(Day.WED));
        String cmd = "stop";
        String msg = switch (cmd) {
            case "go" -> "moving";
            case "stop" -> "halted";
            default -> "unknown";
        };
        System.out.println(msg);
    }
}
```

```text filename:Output
6 9
halted
```

|  | `case X:` (colon) | `case X ->` (arrow) |
| --- | --- | --- |
| Fall-through | Yes, until `break` | Never |
| As an expression | Yes, with `yield` | Yes |
| Multiple labels | `case 1: case 2:` | `case 1, 2 ->` |
| Exhaustiveness | Only required for switch <em>expressions</em> | Same |

# Pattern matching for `instanceof` (Java 16)

```java filename:Java
public class Main {
    static String describe(Object o) {
        if (o instanceof String s && !s.isEmpty())   // test + cast + bind in one step
            return "String of length " + s.length();
        if (o instanceof Integer i)
            return "Integer doubled " + (i * 2);
        return "something else";
    }

    public static void main(String[] args) {
        System.out.println(describe("hello"));
        System.out.println(describe(21));
        System.out.println(describe(3.5));
    }
}
```

```text filename:Output
String of length 5
Integer doubled 42
something else
```

# Type patterns, guards &amp; null in switch (Java 21)

```java filename:Java
public class Main {
    static String classify(Object o) {
        return switch (o) {
            case null -> "null!";                          // otherwise NPE
            case Integer i when i < 0 -> "negative int";   // guard with `when`
            case Integer i -> "int " + i;
            case String s when s.isBlank() -> "blank string";
            case String s -> "string '" + s + "'";
            case int[] arr -> "int array of " + arr.length;
            default -> "other: " + o.getClass().getSimpleName();
        };
    }

    public static void main(String[] args) {
        Object[] inputs = {-5, 7, " ", "hi", new int[3], 2.5, null};
        for (Object o : inputs) System.out.println(classify(o));
    }
}
```

```text filename:Output
negative int
int 7
blank string
string 'hi'
int array of 3
other: Double
null!
```

> [!WARNING] Watch out
>
> Order matters: a more general pattern before a specific one (`case Integer i` before `case Integer i when i < 0`) is a <em>dominance</em> compile error. Without `case null`, a `null` selector throws `NullPointerException`.

# Record patterns &amp; sealed hierarchies (Java 21)

```java filename:Java
public class Main {
    sealed interface Shape permits Circle, Rect, Square {}
    record Circle(double r) implements Shape {}
    record Rect(double w, double h) implements Shape {}
    record Square(double side) implements Shape {}

    static double area(Shape s) {
        return switch (s) {                        // exhaustive: compiler knows all subtypes
            case Circle(double r) -> Math.PI * r * r;
            case Rect(double w, double h) -> w * h;     // deconstruct the record
            case Square(var side) -> side * side;
        };
    }

    record Point(int x, int y) {}
    record Line(Point from, Point to) {}

    public static void main(String[] args) {
        System.out.printf("%.2f %.1f %.1f%n", area(new Circle(1)), area(new Rect(2, 3)), area(new Square(4)));
        Object o = new Line(new Point(0, 0), new Point(3, 4));
        if (o instanceof Line(Point(var x1, var y1), Point(var x2, var y2)))   // nested patterns
            System.out.println("dx=" + (x2 - x1) + " dy=" + (y2 - y1));
    }
}
```

```text filename:Output
3.14 6.0 16.0
dx=3 dy=4
```

> [!NOTE] Why it matters
>
> Sealed interface + records + pattern `switch` = algebraic data types in Java. Add a new subtype and every non-exhaustive `switch` fails to compile — the compiler finds the code you forgot.

```question
What does yield do in a switch expression?

---

It returns a value from a block-bodied `case` (`case X -> { …; yield v; }`) or from a colon-style case in a switch <em>expression</em>. `return` would try to leave the enclosing method instead.
```

```question
Is a default needed in a switch expression?

---

The switch expression must be <strong>exhaustive</strong>. For an `enum` or a `sealed` type covering every constant/subtype, no `default` is needed; for `int`, `String` or `Object` you need `default` (or an unconditional pattern).
```

```question
What happens if the selector of a switch is null?

---

Traditionally a `NullPointerException`. From Java 21 you can add `case null` (or `case null, default ->`) to handle it explicitly.
```
