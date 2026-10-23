---
id: 89958418-8086-74cb-aea7-03a294d85913
key: topic:c/variadic-functions
subject: c
topic: variadic-functions
title: Variadic Functions
slug: variadic-functions
order: 1
---

Functions like `printf` take a variable number of arguments. `<stdarg.h>` lets you write your own: `va_start`, `va_arg`, `va_end` walk the extra arguments — with no type safety at all.

```c filename:C
#include <stdio.h>
#include <stdarg.h>

/* the count is passed explicitly: the callee can't know how many arguments there are */
int sum(int count, ...) {
    va_list ap;
    va_start(ap, count);                 /* start after the last named parameter */
    int total = 0;
    for (int i = 0; i < count; i++)
        total += va_arg(ap, int);        /* you must know each argument's type */
    va_end(ap);
    return total;
}

/* a sentinel (negative number) marks the end instead */
double average(double first, ...) {
    va_list ap;
    va_start(ap, first);
    double s = 0;
    int n = 0;
    for (double x = first; x >= 0; x = va_arg(ap, double)) { s += x; n++; }
    va_end(ap);
    return n ? s / n : 0;
}

int main(void) {
    printf("%d %d\n", sum(3, 10, 20, 30), sum(0));
    printf("%.2f\n", average(1.0, 2.0, 4.5, -1.0));
    return 0;
}
```

```text filename:Output
60 0
2.50
```

# Forwarding to vprintf: a logging function

```c filename:C
#include <stdio.h>
#include <stdarg.h>

/* the format attribute makes the compiler check calls like printf */
__attribute__((format(printf, 2, 3)))
void log_msg(const char *level, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    printf("[%s] ", level);
    vprintf(fmt, ap);                    /* the v- variants take a va_list */
    printf("\n");
    va_end(ap);
}

int main(void) {
    log_msg("INFO", "server started on port %d", 8080);
    log_msg("WARN", "%s is %.1f%% full", "disk", 91.5);
    return 0;
}
```

```text filename:Output
[INFO] server started on port 8080
[WARN] disk is 91.5% full
```

# Rules

- At least one named parameter is required before `...` (until C23).
- <em>Default argument promotions</em> apply to the variadic part: `char`/`short` arrive as `int`, `float` as `double`. So `va_arg(ap, float)` or `va_arg(ap, char)` is wrong.
- The callee must learn the number and types of the arguments some other way: a count, a sentinel, or a format string.
- Reading more arguments than were passed, or with the wrong type, is undefined behaviour.
- Every `va_start` (and `va_copy`) needs a matching `va_end`.

```question
How does printf know how many arguments it received?

---

It doesn’t — it trusts the format string. Each conversion specifier tells it to fetch one more argument of a given type with `va_arg`. Too few arguments, or mismatched types, are undefined behaviour, which is why compilers check `printf` formats (`-Wformat`) and why user-controlled format strings are a security hole.
```

```question
Why can't you use va\_arg(ap, float)?

---

Because a `float` passed through `...` is promoted to `double` by the caller. The callee must read it as `double`; asking for a `float` reads the wrong number of bytes / wrong register — undefined behaviour.
```
