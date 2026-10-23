---
id: 31c32cf6-acee-71f8-88a0-a008e546b747
key: topic:java/design-patterns-behavioral
subject: java
topic: design-patterns-behavioral
title: "Design Patterns: Strategy, Observer & More"
slug: design-patterns-strategy-observer-more
order: 1
---

Behavioural and structural patterns in modern Java — most of them are a lambda or a small interface away.

# Strategy

> [!INFO]
>
> <strong>Strategy</strong> — define a family of interchangeable algorithms behind one interface and choose one at run time. With functional interfaces, each strategy is just a lambda.

```java filename:Java
import java.util.Map;
import java.util.function.DoubleUnaryOperator;

public class Main {
    static final Map<String, DoubleUnaryOperator> DISCOUNTS = Map.of(
            "none", price -> price,
            "festive", price -> price * 0.8,
            "flat50", price -> Math.max(0, price - 50));

    static double checkout(double price, String code) {
        return DISCOUNTS.getOrDefault(code, DISCOUNTS.get("none")).applyAsDouble(price);
    }

    public static void main(String[] args) {
        System.out.println(checkout(200, "festive"));
        System.out.println(checkout(200, "flat50"));
        System.out.println(checkout(200, "bogus"));
    }
}
```

```text filename:Output
160.0
150.0
200.0
```

`Comparator` is the JDK's best-known strategy: `list.sort(Comparator.comparing(Person::age))` plugs a comparison algorithm into a sort.

# Observer

> [!INFO]
>
> <strong>Observer</strong> — a subject keeps a list of listeners and notifies them of events; listeners don't know about each other. The basis of event buses, GUI listeners and reactive streams.

```java filename:Java
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class Main {
    static final class StockTicker {
        private final List<Consumer<Double>> listeners = new ArrayList<>();

        Runnable subscribe(Consumer<Double> l) {
            listeners.add(l);
            return () -> listeners.remove(l);          // handle to unsubscribe
        }

        void publish(double price) {
            listeners.forEach(l -> l.accept(price));
        }
    }

    public static void main(String[] args) {
        StockTicker ticker = new StockTicker();
        ticker.subscribe(p -> System.out.println("display: " + p));
        Runnable cancel = ticker.subscribe(p -> {
            if (p > 100) System.out.println("alert: above 100");
        });

        ticker.publish(99.5);
        ticker.publish(101.0);
        cancel.run();                                  // stop the alerts
        ticker.publish(120.0);
    }
}
```

```text filename:Output
display: 99.5
display: 101.0
alert: above 100
display: 120.0
```

> [!WARNING] Watch out
>
> Forgotten subscriptions are a classic memory leak — always give listeners a way to unsubscribe. `java.util.Observable` is deprecated (Java 9); use your own listener list, `PropertyChangeSupport` or `java.util.concurrent.Flow`.

# Decorator

Wrap an object in another object with the <em>same interface</em> to add behaviour. `java.io` is built this way: each stream adds one feature (buffering, decoding, line reading).

```java filename:Java
import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;

public class Main {
    interface Coffee { double cost(); String describe(); }

    record Espresso() implements Coffee {
        public double cost() { return 2.0; }
        public String describe() { return "espresso"; }
    }

    record WithMilk(Coffee inner) implements Coffee {
        public double cost() { return inner.cost() + 0.5; }
        public String describe() { return inner.describe() + " + milk"; }
    }

    record WithSyrup(Coffee inner) implements Coffee {
        public double cost() { return inner.cost() + 0.75; }
        public String describe() { return inner.describe() + " + syrup"; }
    }

    public static void main(String[] args) throws IOException {
        Coffee order = new WithSyrup(new WithMilk(new Espresso()));
        System.out.println(order.describe() + " = " + order.cost());

        // the JDK version: a Reader decorated with buffering and readLine()
        try (BufferedReader r = new BufferedReader(new StringReader("line 1\nline 2"))) {
            System.out.println(r.readLine());
        }
    }
}
```

```text filename:Output
espresso + milk + syrup = 3.25
line 1
```

# Template method

An abstract class fixes the <em>skeleton</em> of an algorithm in a `final` method and lets subclasses fill in the steps.

```java filename:Java
public class Main {
    static abstract class Report {
        final String render() {                      // the template — not overridable
            return header() + "\n" + body() + "\n-- end --";
        }
        String header() { return "REPORT"; }         // hook with a default
        abstract String body();                      // step subclasses must supply
    }

    static final class SalesReport extends Report {
        @Override String body() { return "sales: 42 units"; }
    }

    public static void main(String[] args) {
        System.out.println(new SalesReport().render());
    }
}
```

```text filename:Output
REPORT
sales: 42 units
-- end --
```

# Adapter

Convert one interface into another that a client expects. `Arrays.asList` adapts an array to `List`; `InputStreamReader` adapts a byte stream to a character `Reader`.

```java filename:Java
import java.util.function.Supplier;

public class Main {
    static final class LegacyThermometer {                  // can't change this class
        double readFahrenheit() { return 98.6; }
    }

    interface CelsiusSensor { double celsius(); }

    static CelsiusSensor adapt(LegacyThermometer t) {     // the adapter
        return () -> (t.readFahrenheit() - 32) * 5 / 9;
    }

    public static void main(String[] args) {
        CelsiusSensor s = adapt(new LegacyThermometer());
        Supplier<String> fmt = () -> String.format("%.1f C", s.celsius());
        System.out.println(fmt.get());
    }
}
```

```text filename:Output
37.0 C
```

# Where the JDK uses them

| Pattern | Kind | In the JDK |
| --- | --- | --- |
| Strategy | Behavioural | `Comparator`, `ThreadPoolExecutor`'s `RejectedExecutionHandler` |
| Observer | Behavioural | `PropertyChangeListener`, Swing listeners, `Flow.Subscriber` |
| Iterator | Behavioural | `Iterator` / `Iterable` behind every for-each loop |
| Template method | Behavioural | `AbstractList` (`get` + `size` → everything else), `InputStream.read(byte[])` |
| Command | Behavioural | `Runnable`, `Callable` submitted to executors |
| Decorator | Structural | `BufferedInputStream`, `Collections.unmodifiableList`, `synchronizedMap` |
| Adapter | Structural | `Arrays.asList`, `InputStreamReader`, `OutputStreamWriter` |
| Proxy | Structural | `java.lang.reflect.Proxy` (Spring AOP, mocks) |
| Factory / static factory | Creational | `List.of`, `Calendar.getInstance`, `NumberFormat.getInstance` |
| Builder | Creational | `StringBuilder`, `HttpClient.newBuilder()` |
| Singleton | Creational | `Runtime.getRuntime()` |

```question
Strategy vs template method?

---

Both vary part of an algorithm. Template method uses <em>inheritance</em> — subclasses override steps of a fixed skeleton. Strategy uses <em>composition</em> — the varying algorithm is an object (often a lambda) passed in, so it can change at run time and needs no subclass.
```

```question
Decorator vs inheritance for adding behaviour?

---

Inheritance fixes the combination at compile time and explodes into subclasses for every combination (MilkSyrupCoffee…). Decorators compose at run time: wrap in any order and any number, each class adding one responsibility.
```
