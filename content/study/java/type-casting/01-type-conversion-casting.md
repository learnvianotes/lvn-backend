---
id: 284441f0-677b-7704-93da-2f0953cd9b98
key: topic:java/type-casting
subject: java
topic: type-casting
title: Type Conversion & Casting
slug: type-conversion-casting
order: 1
---

Widening conversions happen automatically; narrowing ones need an explicit cast and may silently lose information.

# Widening (implicit) vs narrowing (explicit)

`byte → short → int → long → float → double (char → int)`

|  | Widening | Narrowing |
| --- | --- | --- |
| Direction | Smaller → larger type | Larger → smaller type |
| Syntax | Automatic: `long l = i;` | Cast required: `int i = (int) l;` |
| Data loss? | No (except precision: `long`/`int` → `float`/`double`) | Possibly: high bits dropped, fraction truncated |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int i = 100;
        long l = i;              // widening
        double d = l;            // widening
        System.out.println(l + " " + d);

        double price = 9.99;
        int whole = (int) price;         // truncates toward zero, not rounds
        System.out.println(whole + " " + (int) -9.99 + " " + Math.round(9.5));

        int big = 300;
        byte b = (byte) big;             // keeps only the low 8 bits: 300 - 256
        System.out.println(b);
        System.out.println((int) 3_000_000_000L);   // high 32 bits dropped
        System.out.println((int) 1e20);             // double → int saturates
        System.out.println((char) 97 + " " + (int) 'a');

        long precise = 123_456_789_123L;
        float f = precise;                          // widening but loses precision
        System.out.println((long) f);
    }
}
```

```text filename:Output
100 100.0
9 -9 10
44
-1294967296
2147483647
a 97
123456790528
```

# Numeric promotion in expressions

- In arithmetic, `byte`, `short` and `char` are first promoted to `int`.
- If either operand is `long` → `long`; `float` → `float`; `double` → `double`.
- So `byte + byte` is an `int` and must be cast back — but compound assignments (`+=`) cast implicitly.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        byte a = 10, b = 20;
        // byte c = a + b;          // compile error: int cannot be converted to byte
        byte c = (byte) (a + b);
        a += 5;                     // OK: means a = (byte) (a + 5)
        byte x = 120;
        x += 10;                    // silently overflows!
        System.out.println(c + " " + a + " " + x);
        System.out.println(5 / 2 + " " + 5 / 2.0 + " " + (double) 5 / 2 + " " + (double) (5 / 2));
        System.out.println('a' + 'b' + " vs " + "" + 'a' + 'b');
    }
}
```

```text filename:Output
30 15 -126
2 2.5 2.5 2.0
195 vs ab
```

> [!WARNING] Watch out
>
> `(double) (5 / 2)` is `2.0` — the integer division happens <em>before</em> the cast. Cast an operand, not the result.

# Converting to and from String

| Conversion | How |
| --- | --- |
| `String` → `int` / `double` | `Integer.parseInt(s)`, `Double.parseDouble(s)` (throw `NumberFormatException`) |
| `String` → wrapper | `Integer.valueOf(s)` |
| anything → `String` | `String.valueOf(x)`, `Integer.toString(n)`, `"" + x` |
| `char` ↔ digit | `c - '0'`, `(char) ('0' + d)`, `Character.getNumericValue(c)` |
| radix | `Integer.parseInt("ff", 16)`, `Integer.toString(255, 2)` |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(Integer.parseInt("42") * 2);
        System.out.println(String.valueOf(3.5) + "!");
        System.out.println('7' - '0' + 1);
        System.out.println(Integer.parseInt("ff", 16) + " " + Integer.toString(10, 2));
        try {
            Integer.parseInt("4 2");
        } catch (NumberFormatException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
84
3.5!
8
255 1010
For input string: "4 2"
```

# Reference casting (preview)

Objects are cast along the inheritance tree: <strong>upcasting</strong> (`Object o = "hi";`) is implicit and always safe; <strong>downcasting</strong> (`String s = (String) o;`) is checked at run time and throws `ClassCastException` if wrong. Use `instanceof` pattern matching — see <em>Polymorphism</em>.

```question
What is the result of (byte) 200?

---

`-56`. Only the low 8 bits are kept: 200 is `11001000` in binary, which as a signed two's-complement byte is 200 − 256 = −56.
```

```question
Why does short s = 1; s = s + 1; fail but s += 1; compile?

---

`s + 1` is promoted to `int`, and assigning an `int` to a `short` needs an explicit cast. Compound assignment operators include an implicit cast back to the left-hand type.
```

```question
Is converting long to float widening? Can it lose data?

---

Yes, it's a widening conversion (allowed implicitly), but `float` has only 24 bits of mantissa, so large `long` values lose precision.
```
