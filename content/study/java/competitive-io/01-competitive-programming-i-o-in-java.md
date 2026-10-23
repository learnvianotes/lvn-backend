---
id: 3ed0c79c-a4f5-7c9e-a2e6-24f4b53f6539
key: topic:java/competitive-io
subject: java
topic: competitive-io
title: Competitive Programming I/O in Java
slug: competitive-programming-i-o-in-java
order: 1
---

Java is fast enough for contests <em>if</em> you avoid slow input, per-line output and a few well-known traps.

# Scanner is slow

`Scanner` uses regular expressions for every token — fine for 10³ numbers, too slow for 10⁶. Read lines with `BufferedReader` and split them with `StringTokenizer`; buffer the output with `PrintWriter`.

| Tool | Speed | Use |
| --- | --- | --- |
| `Scanner(System.in)` | Slow (regex per token) | Small inputs, quick scripts |
| `BufferedReader` + `StringTokenizer` | Fast | The standard contest template |
| `DataInputStream` custom byte reader | Fastest | Huge inputs (10⁷ numbers) |
| `System.out.println` in a loop | Slow (flushes / locks) | Avoid for many lines |
| `PrintWriter` / `StringBuilder` | Fast | Build output, flush once |

# The standard template

```java filename:Java
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));

        int t = Integer.parseInt(br.readLine().trim());          // number of test cases
        while (t-- > 0) {
            int n = Integer.parseInt(br.readLine().trim());
            StringTokenizer st = new StringTokenizer(br.readLine());
            long sum = 0;                                        // long: sums overflow int
            int max = Integer.MIN_VALUE;
            for (int i = 0; i < n; i++) {
                int x = Integer.parseInt(st.nextToken());
                sum += x;
                max = Math.max(max, x);
            }
            out.println(sum + " " + max);
        }
        out.flush();                                             // forget this → no output!
    }
}
```

```text filename:Output
6 3
3000000000 1000000000
```

```text filename:Input%20(stdin)
2
3
1 2 3
3
1000000000 1000000000 1000000000
```

# A reusable FastReader

```java filename:Java
import java.io.*;
import java.util.*;

public class Main {
    static final class FastReader {
        private final BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        private StringTokenizer st;

        String next() throws IOException {
            while (st == null || !st.hasMoreTokens()) {
                st = new StringTokenizer(br.readLine());   // tokens may span lines
            }
            return st.nextToken();
        }
        int nextInt() throws IOException { return Integer.parseInt(next()); }
        long nextLong() throws IOException { return Long.parseLong(next()); }
    }

    public static void main(String[] args) throws IOException {
        FastReader in = new FastReader();
        int n = in.nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = in.nextInt();

        StringBuilder sb = new StringBuilder();
        for (int i = n - 1; i >= 0; i--) sb.append(a[i]).append(i > 0 ? ' ' : '\n');
        System.out.print(sb);                                   // one write
    }
}
```

```text filename:Output
5 4 3 2 1
```

# Overflow: when to use long

```java filename:Java
public class Main {
    static final int MOD = 1_000_000_007;

    static long power(long base, long exp, long mod) {      // fast exponentiation, O(log exp)
        long result = 1;
        base %= mod;
        while (exp > 0) {
            if ((exp & 1) == 1) result = result * base % mod;
            base = base * base % mod;
            exp >>= 1;
        }
        return result;
    }

    public static void main(String[] args) {
        int a = 1_000_000;
        System.out.println(a * a);              // int overflow, silently wraps
        System.out.println((long) a * a);       // widen BEFORE multiplying
        System.out.println((long) (a * a));     // too late: already overflowed
        System.out.println(power(2, 1_000_000_000L, MOD));
        System.out.println(Math.floorMod(-7, 3) + " " + (-7 % 3));   // % keeps the sign
    }
}
```

```text filename:Output
-727379968
1000000000000
-727379968
140625001
2 -1
```

# The Arrays.sort(int\[\]) trap

> [!WARNING] Hackable sort
>
> `Arrays.sort(int[])` uses dual-pivot quicksort: O(n log n) on average but <strong>O(n²) on adversarial input</strong>, and contest “anti-Java” tests exploit that. `Arrays.sort(Object[])` (e.g. `Integer[]`) uses TimSort, which is always O(n log n).

```java filename:Java
import java.util.*;

public class Main {
    static void safeSort(int[] a) {
        Random rnd = new Random(42);
        for (int i = a.length - 1; i > 0; i--) {       // shuffle first → no adversarial order
            int j = rnd.nextInt(i + 1);
            int tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        Arrays.sort(a);
    }

    public static void main(String[] args) {
        int[] a = {5, 1, 4, 2, 3};
        safeSort(a);
        System.out.println(Arrays.toString(a));

        Integer[] boxed = {5, 1, 4, 2, 3};             // alternative: object sort = TimSort
        Arrays.sort(boxed, Collections.reverseOrder());
        System.out.println(Arrays.toString(boxed));
    }
}
```

```text filename:Output
[1, 2, 3, 4, 5]
[5, 4, 3, 2, 1]
```

# Contest checklist

- Class name: most judges require `public class Main` (Codeforces accepts any; check the rules).
- Use `long` for sums, products and anything that can exceed \~2.1 × 10⁹.
- Recursion depth &gt; \~10⁴ may overflow the default stack — iterate, or run the solver in `new Thread(null, task, "", 1 << 26)`.
- `ArrayDeque` over `Stack`/`LinkedList`; `int[]` over `List<Integer>` in hot loops (boxing is slow).
- Compare boxed values with `equals` — `Integer == Integer` fails above 127.
- Flush `PrintWriter` at the end (or use `try-with-resources`).

```question
Why is BufferedReader faster than Scanner?

---

`BufferedReader` reads large chunks and hands back raw lines; `StringTokenizer` splits on whitespace with a simple loop. `Scanner` has a smaller buffer and parses every token with regular expressions and locale-aware number parsing, which is several times slower on large inputs.
```
