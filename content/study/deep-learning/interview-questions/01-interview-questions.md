---
id: fdad6f78-3775-7ee7-acbb-4c3415d99904
key: topic:deep-learning/interview-questions
subject: deep-learning
topic: interview-questions
title: Interview Questions
slug: interview-questions
order: 1
---

Deep learning questions that come up in ML engineer and data scientist interviews — short answers you can say out loud, with pointers to the topic that explains each one.

# Fundamentals

```question
What is the difference between machine learning and deep learning?

---

Deep learning is a subset of ML that uses many-layered neural networks to learn features directly from raw data. Classic ML relies on hand-engineered features and shines on small/tabular data; deep learning shines on images, audio and text, and when data and compute are plentiful.
```

```question
Why do neural networks need activation functions?

---

Without non-linearities, stacked linear layers collapse into a single linear map. Activations like ReLU let the network represent non-linear functions. (See <strong>Activation Functions</strong>.)
```

```question
What does the universal approximation theorem say — and not say?

---

A single hidden layer with enough units can approximate any continuous function on a bounded domain. It doesn't say how many units, whether gradient descent will find the weights, or whether the result will generalise; depth is far more efficient in practice.
```

```question
How many parameters does a Conv2d(64, 128, kernel\_size=3) have?

---

`128 × (64 × 3 × 3) + 128 = 73,856`. Parameters don't depend on the image size.
```

# Training

```question
Explain backpropagation.

---

Run a forward pass storing intermediate values, then apply the chain rule from the loss backwards: each operation multiplies the incoming gradient by its local derivative and passes it on. One backward pass yields gradients for all parameters at roughly twice the cost of a forward pass.
```

```question
Batch vs mini-batch vs stochastic gradient descent?

---

Batch uses the whole dataset per step (exact but slow), SGD one example (cheap but noisy), mini-batch a few dozen to a few thousand (the practical default: GPU-efficient with useful noise).
```

```question
How does Adam work? Why AdamW?

---

Adam keeps an exponential average of gradients (momentum) and of squared gradients (per-parameter scale), with bias correction, and steps by `m̂ / (√v̂ + ε)`. AdamW applies weight decay directly to the weights instead of through the gradient, so regularisation isn't distorted by the adaptive scaling.
```

```question
What happens if the learning rate is too high or too low?

---

Too high: the loss oscillates, diverges or becomes `nan`. Too low: training crawls and may stall on plateaus. Use an LR range test, warmup and a decay schedule (cosine is a good default).
```

```question
Why use cross-entropy loss for classification, and what should the initial loss be?

---

It's the negative log-likelihood of the correct class and gives strong gradients (`p − y`) when the model is confidently wrong. With `k` balanced classes and a fresh model, expect about `ln k` (2.30 for 10 classes).
```

# Stability &amp; generalisation

```question
What causes vanishing/exploding gradients and how do you fix them?

---

Gradients are products of per-layer factors; below 1 they shrink exponentially, above 1 they blow up. Fixes: ReLU-family activations, He/Xavier init, BatchNorm/LayerNorm, residual connections, gradient clipping, LSTM/GRU for sequences.
```

```question
How does batch normalization behave differently at train and test time?

---

In training it normalises with the current batch's mean/variance and updates running averages; in eval mode it uses those running averages. Forgetting `model.eval()` is a common bug.
```

```question
How does dropout work?

---

In training each unit is zeroed with probability `p` and survivors are scaled by `1/(1−p)`; at test time it's off. It prevents co-adaptation and acts like an ensemble of sub-networks.
```

```question
Your training accuracy is 99% but validation is 75%. What do you do?

---

Overfitting: add data or augmentation, weight decay, dropout, early stopping, a smaller or pretrained model. Also check for distribution mismatch or leakage between splits.
```

```question
Your training loss is not decreasing. How do you debug?

---

Verify data and labels, check the initial loss (≈ `ln k`), try to overfit a tiny batch, then look for bugs — missing `zero_grad`, softmax before `CrossEntropyLoss`, wrong shapes/dtypes, frozen parameters, bad LR. Inspect gradient norms per layer.
```

# Architectures

```question
Why do CNNs work well for images?

---

Local receptive fields, weight sharing and pooling exploit spatial structure: far fewer parameters than dense layers, translation equivariance, and a hierarchy from edges to objects.
```

```question
What problem do residual connections solve?

---

Very deep plain networks trained worse than shallower ones (degradation). Skip connections `y = F(x) + x` give gradients an identity path and make identity mappings easy, enabling 100+ layer networks. Transformers use them in every block.
```

```question
RNN vs LSTM vs Transformer?

---

RNNs process sequences step by step and struggle with long-range dependencies (vanishing gradients). LSTMs add gates and an additive cell state to remember longer. Transformers use self-attention: any two positions interact directly and training is parallel — at O(n²) cost in sequence length.
```

```question
Explain scaled dot-product attention. Why the scaling?

---

`softmax(QKᵀ/√d_k)V`: each query scores every key, softmax turns scores into weights, and the output is the weighted sum of values. Dot products grow like `√d_k`; without scaling, softmax saturates and gradients vanish.
```

```question
Encoder-only vs decoder-only Transformers?

---

Encoder-only (BERT) uses bidirectional attention and suits understanding tasks — classification, embeddings. Decoder-only (GPT-style LLMs) uses causal attention and is trained to predict the next token — generation. Encoder–decoder (T5) maps one sequence to another.
```

```question
When would you use transfer learning?

---

Almost always when a relevant pretrained model exists and your labelled data is limited: replace the head, train it with the backbone frozen, then optionally fine-tune deeper layers with a small learning rate.
```

# Generative models

```question
Compare VAEs, GANs and diffusion models.

---

VAEs: encoder–decoder with a KL-regularised latent space; stable, but samples are blurry. GANs: generator vs discriminator; sharp samples, unstable training and mode collapse. Diffusion: learn to denoise at every noise level, sample by iterative denoising; high quality and diversity, stable training, slower sampling.
```

```question
What is the reparameterization trick in VAEs?

---

Sampling `z = μ + σ·ε` with `ε ~ N(0, 1)` moves the randomness outside the network, so gradients can flow through `μ` and `σ`.
```

# Practical

```question
What's the difference between model.eval() and torch.no\_grad()?

---

`model.eval()` changes layer behaviour (dropout off, BatchNorm uses running stats). `torch.no_grad()` stops gradient tracking to save memory and time. For inference you want both.
```

```question
How do you train with a batch that doesn't fit in GPU memory?

---

Gradient accumulation (several micro-batches, divide the loss, step once), mixed precision (bf16/fp16), gradient checkpointing, a smaller model, or sharding across GPUs (FSDP).
```

```question
What is mixed precision training?

---

Computing in 16-bit floats with 32-bit master weights to cut memory and speed up tensor-core math; float16 needs a gradient scaler to avoid underflow, bfloat16 usually doesn't.
```

# Quick-fire checklist

Neuron &amp; bias · XOR &amp; hidden layers · ReLU vs sigmoid · Softmax &amp; logits · Cross-entropy · Mini-batch SGD · Chain rule · Gradient check · Momentum · Adam vs AdamW · Warmup + cosine · He / Xavier init · Vanishing gradients · Gradient clipping · BatchNorm vs LayerNorm · Dropout · Weight decay · Early stopping · Data augmentation · zero\_grad → backward → step · train() / eval() · state\_dict · Overfit one batch · Mixed precision · Conv output size · Receptive field · ResNet skip · Transfer learning · LSTM gates · Embeddings · Self-attention · √d\_k scaling · Multi-head · Positional encoding · VAE &amp; KL · GAN minimax · Diffusion denoising
