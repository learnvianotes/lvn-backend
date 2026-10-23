---
id: 1ae72c46-99a1-7eb6-af88-167e6f3adace
key: topic:c/input-output
subject: c
topic: input-output
title: "Input & Output: printf and scanf"
slug: input-output-printf-and-scanf
order: 1
---

`printf` formats values into text on `stdout`; `scanf` parses text from `stdin` into variables. Both are driven by <em>format specifiers</em> that must match the argument types exactly.

# Format specifiers

| Specifier | Type (printf) | Type (scanf) | Example output |
| --- | --- | --- | --- |
| `%d` / `%i` | `int` | `int *` | `-42` |
| `%u` | `unsigned int` | `unsigned *` | `42` |
| `%ld` / `%lld` | `long` / `long long` | pointer to same | `9000000000` |
| `%zu` | `size_t` | `size_t *` | `8` |
| `%f` | `double` (and `float`, promoted) | `float *` | `3.140000` |
| `%lf` | `double` | `double *` (<strong>required</strong>) | `3.140000` |
| `%e` / `%g` | `double` scientific / shortest | same as `%f` | `3.14e+00` / `3.14` |
| `%c` | `int` (a char) | `char *` | `A` |
| `%s` | `char *` (NUL-terminated) | `char *` (array) | `hello` |
| `%x` / `%X` / `%o` | `unsigned` hex / HEX / octal | `unsigned *` | `ff` / `FF` / `377` |
| `%p` | `void *` | `void **` | `0x16d…` |
| `%%` | a literal `%` | — | `%` |

# Width, precision and flags

```c filename:C
#include <stdio.h>

int main(void) {
    int n = 42;
    double pi = 3.14159265;
    printf("[%d] [%5d] [%-5d] [%05d] [%+d]\n", n, n, n, n, n);
    printf("[%f] [%.2f] [%8.3f] [%e] [%g]\n", pi, pi, pi, pi, pi);
    printf("[%x] [%X] [%#x] [%o] [%#o]\n", 255, 255, 255, 8, 8);
    printf("[%s] [%10s] [%-10s] [%.3s]\n", "hello", "hi", "hi", "truncate");
    printf("[%*d] [%.*f]\n", 6, n, 1, pi);    /* width / precision from args */
    printf("100%% done, char %c, code %d\n", 'A', 'A');
    return 0;
}
```

```text filename:Output
[42] [   42] [42   ] [00042] [+42]
[3.141593] [3.14] [   3.142] [3.141593e+00] [3.14159]
[ff] [FF] [0xff] [10] [010]
[hello] [        hi] [hi        ] [tru]
[    42] [3.1]
100% done, char A, code 65
```

> [!NOTE] Key point
>
> Format: `%[flags][width][.precision][length]specifier`. Flags: `-` left-align, `+` show sign, `0` zero-pad, `#` alternate form (`0x`), space = space for positive numbers.

# Reading input with scanf

```c filename:C
#include <stdio.h>

int main(void) {
    int age;
    double height;
    char name[20];

    /* scanf needs ADDRESSES: &age, &height — but an array name already is one */
    int got = scanf("%19s %d %lf", name, &age, &height);
    printf("read %d items: %s is %d years, %.2f m\n", got, name, age, height);
    return 0;
}
```

```text filename:Output
read 3 items: Asha is 21 years, 1.68 m
```

`scanf` returns the number of items successfully converted (or `EOF`). Always check it — on bad input the variables are left untouched:

```c filename:C
#include <stdio.h>

int main(void) {
    int x = -1;
    if (scanf("%d", &x) != 1) {
        printf("not a number, x still %d\n", x);
    } else {
        printf("x = %d\n", x);
    }
    return 0;
}
```

```text filename:Output
not a number, x still -1
```

# Reading a whole line: fgets

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    char line[64];
    while (fgets(line, sizeof line, stdin) != NULL) {
        line[strcspn(line, "\n")] = '\0';   /* strip the trailing newline */
        printf("got \"%s\" (%zu chars)\n", line, strlen(line));
    }
    return 0;
}
```

```text filename:Output
got "hello world" (11 chars)
got "second line" (11 chars)
```

# Character I/O

```c filename:C
#include <stdio.h>
#include <ctype.h>

int main(void) {
    int c;                         /* int, not char: must hold EOF (-1) too */
    while ((c = getchar()) != EOF) {
        putchar(toupper(c));
    }
    return 0;
}
```

```text filename:Output
SHOUT THIS
```

# Pitfalls

| Mistake | Consequence | Fix |
| --- | --- | --- |
| `scanf("%d", x)` — missing `&` | Writes to a garbage address → crash | `scanf("%d", &x)` |
| `scanf("%s", buf)` with no width | Buffer overflow on long input | `scanf("%19s", buf)` for `char buf[20]` |
| `%f` to read a `double` | Writes only 4 bytes → wrong value | Use `%lf` in `scanf` |
| `gets(buf)` | Unbounded — removed in C11 | `fgets(buf, sizeof buf, stdin)` |
| `scanf("%d")` then `fgets` | `fgets` reads the leftover `\n` → empty line | Consume the rest of the line first |
| `printf(user_input)` | Format-string vulnerability | `printf("%s", user_input)` |

> [!WARNING] Watch out
>
> `stdout` is <em>line-buffered</em> on a terminal but <em>fully buffered</em> when redirected to a file or pipe. Output may appear later than you expect — use `fflush(stdout)` or print to `stderr` (unbuffered) for diagnostics.

```question
Why is getchar's result stored in an int?

---

`getchar` returns every possible `unsigned char` value (0–255) <em>plus</em> `EOF` (a negative value, usually −1). A `char` cannot represent all 257 values, so `EOF` would be confused with a real character (or never detected if `char` is unsigned).
```

```question
Why does printf use %f for both float and double, but scanf needs %lf for double?

---

Arguments to variadic functions undergo <em>default argument promotions</em>: a `float` passed to `printf` is converted to `double`, so `%f` always receives a `double`. `scanf` receives <em>pointers</em>, which are not promoted — it must know whether to write 4 bytes (`float *`, `%f`) or 8 bytes (`double *`, `%lf`).
```
