---
id: 73913991-5557-719e-8f2c-f0998811b947
key: topic:c/functions
subject: c
topic: functions
title: Functions & Call by Value
slug: functions-call-by-value
order: 1
---

A function packages a computation behind a name and a <em>prototype</em>. C passes every argument <strong>by value</strong> — the function receives copies; to modify the caller’s variable you pass its address.

# Declaration, definition, call

```c filename:C
#include <stdio.h>

double average(const int *values, int count);   /* prototype */

int main(void) {
    int marks[] = {70, 85, 90};
    printf("%.2f\n", average(marks, 3));
    return 0;
}

double average(const int *values, int count) {  /* definition */
    if (count == 0) return 0.0;
    long sum = 0;
    for (int i = 0; i < count; i++) sum += values[i];
    return (double)sum / count;
}
```

```text filename:Output
81.67
```

| Part | Example | Notes |
| --- | --- | --- |
| Return type | `double` | `void` if nothing is returned |
| Name | `average` | External linkage by default; `static` to hide it |
| Parameters | `(const int *values, int count)` | `(void)` means <em>no</em> parameters; `()` means <em>unspecified</em> (pre-C23) |
| Body | `{ … }` | `return expr;` ends the call |

# Call by value

```c filename:C
#include <stdio.h>

void broken_swap(int a, int b) {    /* swaps the copies only */
    int t = a; a = b; b = t;
}

void swap(int *a, int *b) {         /* receives addresses ("call by reference" emulation) */
    int t = *a; *a = *b; *b = t;
}

int main(void) {
    int x = 1, y = 2;
    broken_swap(x, y);
    printf("after broken_swap: %d %d\n", x, y);
    swap(&x, &y);
    printf("after swap:        %d %d\n", x, y);
    return 0;
}
```

```text filename:Output
after broken_swap: 1 2
after swap:        2 1
```

> [!NOTE] Key point
>
> Even the pointer is passed by value: `swap` gets <em>copies</em> of the addresses. It can change what they point to, but not where the caller’s pointer variables point. To change a caller’s pointer, pass a pointer to it (`int **`).

# Arrays and structs as parameters

- An array argument <em>decays</em> to a pointer to its first element: `void f(int a[])` is exactly `void f(int *a)`. The size is lost — pass it separately.
- A `struct` is copied in full. For big structs pass `const struct T *` to avoid the copy.
- Mark pointer parameters you don’t modify as `const` — it documents intent and lets the compiler check it.

# Returning several values

```c filename:C
#include <stdio.h>

/* return a status, deliver results through out-parameters */
int divide(int a, int b, int *quot, int *rem) {
    if (b == 0) return -1;
    *quot = a / b;
    *rem = a % b;
    return 0;
}

int main(void) {
    int q, r;
    if (divide(17, 5, &q, &r) == 0)
        printf("17 = 5 * %d + %d\n", q, r);
    if (divide(1, 0, &q, &r) != 0)
        printf("division by zero rejected\n");
    return 0;
}
```

```text filename:Output
17 = 5 * 3 + 2
division by zero rejected
```

# inline and the order of evaluation

- `static inline int sq(int x) { return x * x; }` — a hint to expand the body at the call site; typical in headers as a type-safe macro replacement.
- The order in which arguments are evaluated is <strong>unspecified</strong>: in `f(g(), h())` either may run first. Never depend on it.
- A function with a non-`void` return type that falls off the end without `return` — and whose value is used — is undefined behaviour (`-Wreturn-type`).

```c filename:C%20%E2%80%94%20rejected%3A%20non-void%20function%20does%20not%20return%20a%20value%20in%20all%20paths
int sign(int x) {
    if (x > 0) return 1;
    if (x < 0) return -1;
}   /* missing return when x == 0 */
```

```question
Does C support call by reference?

---

No — C only has call by value. Passing a pointer <em>emulates</em> call by reference: the pointer is copied, but both copies point to the same object, so the callee can modify it through `*p`.
```

```question
What is a function prototype and why is it needed?

---

A declaration giving the return type and parameter types (`int max(int, int);`). It lets the compiler check calls, convert arguments to the right types and catch mistakes, even if the definition appears later or in another file.
```

```question
What is the difference between f() and f(void) in a declaration?

---

Before C23, `int f();` declares a function taking an <em>unspecified</em> number of arguments (old K&amp;R style — no checking), while `int f(void);` declares a function that takes <em>no</em> arguments. C23 makes them equivalent, but `(void)` is still the portable choice.
```
