---
id: f04fa633-58e7-743b-a077-6e6d470b6a6d
key: topic:deep-learning/evaluating-models
subject: deep-learning
topic: evaluating-models
title: Evaluating Deep Learning Models
slug: evaluating-deep-learning-models
order: 1
---

Measure on data the model never trained on, in eval mode, with the metric that matches the real goal. Loss tells you how training is going; task metrics tell you whether the model is useful.

# Three splits

| Split | Used for | Touched |
| --- | --- | --- |
| Training | Computing gradients | Every step |
| Validation | Early stopping, hyper-parameters, model selection | Every epoch |
| Test | Final, unbiased estimate | <strong>Once</strong>, at the end |

> [!WARNING] Watch out
>
> Tuning on the test set turns it into a second validation set — the final number becomes optimistic. Also watch for leakage: near-duplicate images, the same patient/user in two splits, or time series split randomly instead of by time.

# From logits to metrics

```python filename:Python
import torch

logits = torch.tensor([[2.0, 0.1, -1.0], [0.2, 1.5, 0.3], [1.2, 0.8, 0.1],
                       [-0.5, 0.2, 2.2], [0.1, 2.0, -0.3], [0.3, 0.1, 0.9]])
y_true = torch.tensor([0, 1, 1, 2, 1, 0])

probs = torch.softmax(logits, dim=1)
y_pred = probs.argmax(dim=1)
print(y_pred.tolist())                                   # [0, 1, 0, 2, 1, 2]
print(round((y_pred == y_true).float().mean().item(), 3))   # 0.667 ← accuracy

k = 3
cm = torch.zeros(k, k, dtype=torch.long)                 # rows = true class, cols = predicted
for t, p in zip(y_true, y_pred):
    cm[t, p] += 1
print(cm.tolist())                                       # [[1, 0, 1], [1, 2, 0], [0, 0, 1]]

tp = cm.diag().float()
precision = tp / cm.sum(dim=0).clamp(min=1)              # per predicted column
recall = tp / cm.sum(dim=1).clamp(min=1)                 # per true row
print([round(v, 2) for v in precision.tolist()], [round(v, 2) for v in recall.tolist()])   # [0.5, 1.0, 0.5] [0.5, 0.67, 1.0]

top2 = logits.topk(2, dim=1).indices
print(round((top2 == y_true[:, None]).any(dim=1).float().mean().item(), 3))   # 1.0 ← top-2 accuracy
```

| Task | Metrics |
| --- | --- |
| Classification | Accuracy, precision/recall/F1 (per class, macro/weighted), ROC-AUC, top-k accuracy, confusion matrix |
| Regression | MAE, RMSE, R² |
| Detection / segmentation | mAP (mean average precision), IoU, Dice |
| Language models | Perplexity = `exp(mean cross-entropy)`, plus task benchmarks |
| Generation | FID (images), BLEU/ROUGE (text), human or LLM-judge evaluation |

```python filename:Python
import math
mean_ce = 2.0                     # average cross-entropy per token, in nats
print(round(math.exp(mean_ce), 2))   # 7.39 ← perplexity: as unsure as choosing among ~7.4 tokens
```

# Beyond one number

- <strong>Calibration</strong> — does 90% confidence mean right 90% of the time? Deep nets are often over-confident; temperature scaling on the validation set fixes much of it.
- <strong>Slices</strong> — accuracy per class, per demographic, per data source; averages hide failures.
- <strong>Error analysis</strong> — look at the worst mistakes (see <strong>Error Analysis</strong> in the Machine Learning notes).
- <strong>Variance</strong> — rerun with a few seeds; differences smaller than seed-to-seed noise aren't real.
- <strong>Cost</strong> — latency, memory and throughput at inference matter as much as accuracy in production.

```question
Why is accuracy misleading on imbalanced data?

---

If 99% of transactions are legitimate, predicting “legit” for everything scores 99% while catching zero fraud. Use per-class precision/recall, F1, PR-AUC and a confusion matrix instead.
```

```question
What is perplexity?

---

The exponential of the average per-token cross-entropy of a language model. It's the effective number of equally likely choices the model is torn between at each step — lower is better.
```
