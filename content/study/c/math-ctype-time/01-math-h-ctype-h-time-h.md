---
id: eee003b6-c51a-7317-9715-955e20ae4b0c
key: topic:c/math-ctype-time
subject: c
topic: math-ctype-time
title: math.h, ctype.h & time.h
slug: math-h-ctype-h-time-h
order: 1
---

Three small headers you reach for constantly: floating-point maths, character classification, and dates &amp; times.

# math.h

```c filename:C%20%E2%80%94%20macOS%20output%20(Linux%20glibc%20may%20print%20-nan%20for%20sqrt(-1))
#include <stdio.h>
#include <math.h>

int main(void) {
    printf("sqrt=%.4f pow=%.0f cbrt=%.1f hypot=%.1f\n", sqrt(2.0), pow(2, 10), cbrt(27), hypot(3, 4));
    printf("floor=%.0f ceil=%.0f round=%.0f trunc=%.0f\n", floor(-2.5), ceil(-2.5), round(-2.5), trunc(-2.5));
    printf("fabs=%.1f fmod=%.1f\n", fabs(-3.5), fmod(10.5, 3));
    printf("exp(1)=%.5f log=%.4f log10=%.1f log2=%.1f\n", exp(1), log(10), log10(1000), log2(8));
    double pi = acos(-1.0);
    printf("pi=%.6f sin(pi/6)=%.2f atan2(1,1)=%.4f\n", pi, sin(pi / 6), atan2(1, 1));
    printf("%f %f %d %d\n", sqrt(-1.0), INFINITY, isnan(sqrt(-1.0)), isinf(-INFINITY));
    return 0;
}
```

```text filename:Output
sqrt=1.4142 pow=1024 cbrt=3.0 hypot=5.0
floor=-3 ceil=-2 round=-3 trunc=-2
fabs=3.5 fmod=1.5
exp(1)=2.71828 log=2.3026 log10=3.0 log2=3.0
pi=3.141593 sin(pi/6)=0.50 atan2(1,1)=0.7854
nan inf 1 1
```

> [!WARNING] Watch out
>
> Trig functions take <strong>radians</strong>. `abs()` is for `int` — `abs(-2.5)` silently truncates; use `fabs` for doubles. On Linux, link with `-lm`.

# ctype.h

```c filename:C
#include <stdio.h>
#include <ctype.h>

int main(void) {
    const char *s = "Hi 42_x!";
    for (const char *p = s; *p; p++) {
        unsigned char c = (unsigned char)*p;        /* the cast avoids UB for negative chars */
        printf("'%c' alpha=%d digit=%d space=%d punct=%d upper=%d -> '%c'\n",
               c, !!isalpha(c), !!isdigit(c), !!isspace(c), !!ispunct(c), !!isupper(c), toupper(c));
    }
    return 0;
}
```

```text filename:Output
'H' alpha=1 digit=0 space=0 punct=0 upper=1 -> 'H'
'i' alpha=1 digit=0 space=0 punct=0 upper=0 -> 'I'
' ' alpha=0 digit=0 space=1 punct=0 upper=0 -> ' '
'4' alpha=0 digit=1 space=0 punct=0 upper=0 -> '4'
'2' alpha=0 digit=1 space=0 punct=0 upper=0 -> '2'
'_' alpha=0 digit=0 space=0 punct=1 upper=0 -> '_'
'x' alpha=1 digit=0 space=0 punct=0 upper=0 -> 'X'
'!' alpha=0 digit=0 space=0 punct=1 upper=0 -> '!'
```

| Function | True for |
| --- | --- |
| `isalpha` / `isdigit` / `isalnum` | letters / `0-9` / either |
| `isspace` | space, `\t`, `\n`, `\v`, `\f`, `\r` |
| `isupper` / `islower` | case |
| `ispunct` | printable, not alnum, not space |
| `isxdigit` | `0-9a-fA-F` |
| `toupper` / `tolower` | convert (other characters unchanged) |

> [!NOTE] Key point
>
> The `is…` functions return <em>non-zero</em> for true — not necessarily 1. That is why the sample uses `!!` to normalise.

# time.h

```c filename:C
#include <stdio.h>
#include <time.h>

int main(void) {
    struct tm launch = {0};
    launch.tm_year = 2026 - 1900;       /* years since 1900 */
    launch.tm_mon = 0;                  /* 0 = January */
    launch.tm_mday = 26;
    launch.tm_hour = 9;
    launch.tm_isdst = -1;               /* let mktime work out DST */

    time_t t = mktime(&launch);         /* normalises fields and fills tm_wday / tm_yday */
    char buf[64];
    strftime(buf, sizeof buf, "%A, %d %B %Y %H:%M", &launch);
    printf("%s (day %d of the year)\n", buf, launch.tm_yday + 1);

    struct tm later = launch;
    later.tm_mday += 40;                /* date arithmetic: mktime rolls over months */
    time_t t2 = mktime(&later);
    strftime(buf, sizeof buf, "%Y-%m-%d", &later);
    printf("+40 days = %s, difftime = %.0f days\n", buf, difftime(t2, t) / 86400);
    return 0;
}
```

```text filename:Output
Monday, 26 January 2026 09:00 (day 26 of the year)
+40 days = 2026-03-07, difftime = 40 days
```

```c filename:C%20%E2%80%94%20current%20time%20and%20timing%20(output%20varies)
#include <stdio.h>
#include <time.h>

int main(void) {
    time_t now = time(NULL);                       /* seconds since 1970-01-01 UTC */
    printf("now: %s", ctime(&now));

    clock_t start = clock();                       /* CPU time, not wall time */
    volatile double x = 0;
    for (int i = 0; i < 10000000; i++) x += i;
    printf("loop took %.3f s of CPU\n", (double)(clock() - start) / CLOCKS_PER_SEC);
    return 0;
}
```

```question
What is the difference between time() and clock()?

---

`time()` returns wall-clock calendar time (seconds since the Unix epoch). `clock()` returns the processor time used by the program, in `CLOCKS_PER_SEC` units — it does not advance while the process sleeps. For precise wall-clock intervals use POSIX `clock_gettime(CLOCK_MONOTONIC, …)` or C11 `timespec_get`.
```
