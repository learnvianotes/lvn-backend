---
id: 6dac5312-91ab-769d-be68-7259be38fcb8
key: topic:deep-learning/neuron-perceptron
subject: deep-learning
topic: neuron-perceptron
title: The Neuron & Perceptron
slug: the-neuron-perceptron
order: 1
---

An artificial neuron takes a weighted sum of its inputs, adds a bias and passes the result through an activation function. The perceptron is the oldest version — and its failure on XOR explains why we need hidden layers.

`z = w₁x₁ + w₂x₂ + … + wₙxₙ + b = w · x + b a = f(z)`

| Part | Role |
| --- | --- |
| Inputs `x` | Features (pixel values, measurements, outputs of the previous layer) |
| Weights `w` | How much each input matters — learned |
| Bias `b` | Shifts the threshold — lets the neuron fire even when all inputs are 0 |
| Activation `f` | A non-linearity (step, sigmoid, ReLU…) applied to the sum `z` |

```python filename:Python
import numpy as np

x = np.array([0.5, -1.0, 2.0])     # inputs
w = np.array([0.4, 0.3, -0.2])     # weights
b = 0.1                            # bias

z = w @ x + b                      # weighted sum: 0.2 - 0.3 - 0.4 + 0.1
a = 1 / (1 + np.exp(-z))           # sigmoid activation
print(round(z, 2), round(a, 3))    # -0.4 0.401
```

# The perceptron learning rule

Rosenblatt's perceptron (1958) uses a <strong>step</strong> activation (output 1 if `z > 0`, else 0) and a simple rule: after each example, nudge the weights toward the right answer.

`w ← w + η (y − ŷ) x b ← b + η (y − ŷ)`

```python filename:Python
import numpy as np

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])

def train_perceptron(X, y, epochs=20, lr=0.1):
    w, b = np.zeros(2), 0.0
    for _ in range(epochs):
        for xi, yi in zip(X, y):
            pred = int(xi @ w + b > 0)
            w += lr * (yi - pred) * xi          # no change when the prediction is right
            b += lr * (yi - pred)
    return (X @ w + b > 0).astype(int).tolist()

print(train_perceptron(X, np.array([0, 0, 0, 1])))       # [0, 0, 0, 1] ← AND: learned
print(train_perceptron(X, np.array([0, 1, 1, 1])))       # [0, 1, 1, 1] ← OR: learned
print(train_perceptron(X, np.array([0, 1, 1, 0]), 1000)) # [1, 1, 0, 0] ← XOR: wrong, whatever the epochs
```

# Why XOR breaks it

A single neuron draws one straight line (a hyperplane) through the input space. AND and OR are <strong>linearly separable</strong>; XOR is not — no single line puts (0,1) and (1,0) on one side and (0,0), (1,1) on the other. Minsky &amp; Papert's 1969 book made this point and helped cause the first “AI winter”.

> [!NOTE] Key point
>
> The fix is a <strong>hidden layer</strong>: two neurons each draw a line, and a third combines them. That is a multi-layer perceptron (next topics), trained with backpropagation.

|  | Biological neuron | Artificial neuron |
| --- | --- | --- |
| Inputs | Dendrites receive signals | Numbers `x₁…xₙ` |
| Integration | Cell body sums charge | Weighted sum `w · x + b` |
| Firing | Spikes past a threshold | Activation function `f(z)` |

> [!WARNING] Watch out
>
> The biological analogy is loose inspiration only. Modern networks are best understood as differentiable functions optimised by gradient descent.

```question
What is the role of the bias term?

---

Without it, `w · x` is 0 whenever `x` is 0, so the decision boundary must pass through the origin. The bias shifts the boundary (or the activation's threshold), giving the neuron one more degree of freedom.
```

```question
Can a single perceptron learn XOR?

---

No. It can only separate classes with a straight line, and XOR isn't linearly separable. One hidden layer with a non-linear activation is enough.
```
