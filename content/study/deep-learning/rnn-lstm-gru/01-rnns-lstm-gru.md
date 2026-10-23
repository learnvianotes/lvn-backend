---
id: f28b32d9-2309-7480-b9e1-391187879b81
key: topic:deep-learning/rnn-lstm-gru
subject: deep-learning
topic: rnn-lstm-gru
title: RNNs, LSTM & GRU
slug: rnns-lstm-gru
order: 1
---

Recurrent networks read a sequence one step at a time, carrying a hidden state that summarises everything seen so far. LSTMs and GRUs add gates so that memory survives over long sequences.

| Pattern | Input → output | Example |
| --- | --- | --- |
| Many-to-one | Sequence → one label | Sentiment of a review, activity from sensor data |
| One-to-many | One input → sequence | Image captioning, music generation |
| Many-to-many (aligned) | One output per step | Part-of-speech tagging, frame labelling |
| Many-to-many (seq2seq) | Sequence → different-length sequence | Translation, summarisation (encoder–decoder) |

# The vanilla RNN

`hₜ = tanh(W_x xₜ + W_h hₜ₋₁ + b) the same weights at every time step`

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
d_in, d_h, T = 3, 4, 5
W_x, W_h, b = rng.normal(0, 0.5, (d_in, d_h)), rng.normal(0, 0.5, (d_h, d_h)), np.zeros(d_h)
xs = rng.normal(size=(T, d_in))            # a sequence of 5 steps, 3 features each

h = np.zeros(d_h)
for x_t in xs:                             # unroll through time
    h = np.tanh(x_t @ W_x + h @ W_h + b)
print(h.shape, h.round(3).tolist())        # (4,) [0.403, -0.613, 0.626, 0.503] ← final state summarises the sequence
```

Training unrolls the loop and backpropagates through every step (<strong>backpropagation through time</strong>, BPTT). The gradient reaching step 1 has been multiplied by `W_h` and a tanh slope once per step — so over long sequences it vanishes (or explodes). A plain RNN effectively remembers only the last few steps.

# LSTM and GRU

|  | LSTM | GRU |
| --- | --- | --- |
| State | Hidden `h` + separate <strong>cell</strong> `c` (long-term memory) | Hidden `h` only |
| Gates | Forget, input, output (+ candidate) | Update, reset (+ candidate) |
| Key update | `c ← f ⊙ c + i ⊙ c̃` — additive, so gradients flow | `h ← (1 − z) ⊙ h + z ⊙ h̃` |
| Parameters | 4× a vanilla RNN | 3× a vanilla RNN |
| Use | The default for long dependencies | Slightly faster, often as good |

Gates are sigmoid layers (outputs between 0 and 1) that decide what to erase, what to write and what to expose. Because the cell state is updated by <strong>addition</strong> rather than repeated multiplication, information and gradients can travel across many steps — the forget gate set near 1 keeps a memory intact.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
x = torch.randn(2, 7, 10)                      # (batch, time steps, features) with batch_first=True
lstm = nn.LSTM(input_size=10, hidden_size=20, num_layers=1, batch_first=True)
out, (h_n, c_n) = lstm(x)
print(out.shape, h_n.shape, c_n.shape)         # torch.Size([2, 7, 20]) torch.Size([1, 2, 20]) torch.Size([1, 2, 20])
print(torch.allclose(out[:, -1], h_n[0]))      # True ← last output = final hidden state

count = lambda m: sum(p.numel() for p in m.parameters())
print(count(nn.RNN(10, 20)), count(nn.GRU(10, 20)), count(lstm))   # 640 1920 2560 ← 1× : 3× : 4×
```

```python filename:Python
import torch
from torch import nn

class SentimentLSTM(nn.Module):                 # many-to-one classifier
    def __init__(self, vocab, emb=32, hidden=64, classes=2):
        super().__init__()
        self.embed = nn.Embedding(vocab, emb, padding_idx=0)
        self.lstm = nn.LSTM(emb, hidden, batch_first=True, bidirectional=True)
        self.head = nn.Linear(2 * hidden, classes)     # forward + backward directions

    def forward(self, tokens):
        _, (h_n, _) = self.lstm(self.embed(tokens))
        return self.head(torch.cat([h_n[0], h_n[1]], dim=1))

torch.manual_seed(0)
model = SentimentLSTM(vocab=1000)
print(model(torch.randint(1, 1000, (4, 12))).shape)   # torch.Size([4, 2]) ← 4 reviews of 12 tokens
```

> [!WARNING] Watch out
>
> RNNs process steps sequentially, so they can't parallelise over time and are slow on long sequences. For most language tasks Transformers replaced them; RNNs remain useful for streaming, small on-device models and some time-series work.

```question
How does an LSTM solve the vanishing gradient problem?

---

Its cell state is updated additively (`c = f·c + i·c̃`) and controlled by gates. When the forget gate is near 1 the gradient flows back through the cell almost unchanged, instead of being squashed by a matrix and tanh at every step.
```

```question
LSTM vs GRU?

---

GRU merges the cell and hidden state and uses two gates instead of three, so it has \~25% fewer parameters and trains faster. Performance is usually similar; LSTM can be better on very long dependencies.
```
