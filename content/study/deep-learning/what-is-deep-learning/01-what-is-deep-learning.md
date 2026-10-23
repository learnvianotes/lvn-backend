---
id: 326c0d7a-a2d8-7847-895a-d1c5969de1a7
key: topic:deep-learning/what-is-deep-learning
subject: deep-learning
topic: what-is-deep-learning
title: What Is Deep Learning?
slug: what-is-deep-learning
order: 1
---

Deep learning is machine learning with <strong>neural networks of many layers</strong> that learn their own features from raw data — pixels, audio samples, characters — instead of relying on hand-crafted ones.

> [!INFO]
>
> <strong>Deep learning</strong> — a family of ML methods that stack many simple, differentiable layers. Each layer transforms its input into a slightly more useful <em>representation</em>; the whole stack is trained end-to-end with gradient descent.

Artificial Intelligence → Machine Learning → Neural Networks → Deep Learning (many layers)

In classic ML (see the <strong>Machine Learning</strong> notes) a person designs the features — word counts, edge histograms, ratios — and a model such as a random forest learns from them. A deep network learns the features too: early layers of an image model detect edges, middle layers textures and parts, late layers whole objects.

# Deep learning vs classic ML

|  | Classic ML | Deep learning |
| --- | --- | --- |
| Features | Hand-engineered | <strong>Learned</strong> from raw data |
| Best on | Tabular data, small datasets | Images, audio, text, video — unstructured data |
| Data needed | Hundreds to thousands of rows | Usually thousands to billions of examples (or a pretrained model) |
| Compute | CPU, seconds to minutes | GPUs/TPUs, minutes to months |
| Interpretability | Often readable (trees, coefficients) | Hard — millions of weights |
| Scaling with data | Plateaus | Keeps improving with more data and bigger models |

# A network is a stack of functions

Each layer is a matrix multiply plus a non-linearity. Stacking them turns a raw input vector into a prediction:

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
x = rng.normal(size=(1, 784))                  # one 28×28 image, flattened
W1, W2, W3 = rng.normal(size=(784, 128)), rng.normal(size=(128, 64)), rng.normal(size=(64, 10))

h1 = np.maximum(0, x @ W1)                     # layer 1: 784 → 128 features
h2 = np.maximum(0, h1 @ W2)                    # layer 2: 128 → 64 features
logits = h2 @ W3                               # output: 64 → 10 class scores
print(h1.shape, h2.shape, logits.shape)        # (1, 128) (1, 64) (1, 10)
print(W1.size + W2.size + W3.size)             # 109184   ← weights to learn (biases left out)
```

# The training recipe

Every deep learning model — from a 3-layer classifier to a large language model — is trained with the same loop:

Batch of data → Forward pass → prediction → Loss (how wrong?) → Backprop → gradients → Optimizer updates weights

# Why now?

> [!NOTE] Data
>
> The web, phones and sensors produced labelled datasets such as ImageNet (1.2 M images) and huge text corpora.

> [!NOTE] Compute
>
> GPUs do thousands of matrix multiplies in parallel; AlexNet (2012) trained on two gaming GPUs.

> [!NOTE] Algorithms
>
> ReLU, good initialisation, dropout, BatchNorm, Adam, residual connections, attention — tricks that make deep stacks trainable.

> [!NOTE] Software
>
> PyTorch, TensorFlow and JAX compute gradients automatically, so a new model is a few dozen lines.

# Where it's used

| Domain | Typical architecture | Examples |
| --- | --- | --- |
| Vision | CNNs, Vision Transformers | Classification, detection, segmentation, medical imaging |
| Language | Transformers | Translation, chatbots, search, code completion |
| Speech &amp; audio | CNNs + Transformers | Speech recognition, text-to-speech |
| Generation | Diffusion models, GANs, VAEs, LLMs | Image generation, text generation |
| Sequences &amp; time series | RNNs/LSTMs, Transformers | Forecasting, anomaly detection |

> [!WARNING] Watch out
>
> Deep learning is not automatically the best choice. On small <strong>tabular</strong> datasets, gradient-boosted trees (XGBoost, LightGBM) usually match or beat a neural network with far less effort.

```question
When would you not use deep learning?

---

When data is small or tabular, when you need a simple interpretable model (credit decisions, regulated settings), or when compute and latency budgets are tight. Start with a simple baseline; reach for deep learning when the data is unstructured or plentiful — or when a pretrained model can be fine-tuned.
```

```question
What does “deep” mean?

---

Many layers between input and output. Depth lets the network build features hierarchically — edges → textures → parts → objects — which is far more parameter-efficient than one enormous layer.
```
