---
id: 3a4bfcc7-7eb2-7621-9dd0-e9e62775e653
key: topic:genai-fluency/trad_ml
subject: genai-fluency
topic: trad_ml
title: Traditional ML
slug: traditional-ml
order: 1
---

Concepts from classical statistics and data-driven learning that underpin modern AI.

# Core ML paradigms

> [!NOTE] Supervised Learning
>
> Training a model on labeled data (input-output pairs). The model learns a mapping function from input features to known target labels. Example: predicting house prices or classifying emails as spam.

> [!NOTE] Unsupervised Learning
>
> Training a model on unlabeled data. The model must discover hidden structures, groupings, or patterns within the data on its own. Example: customer segmentation or anomaly detection.

> [!NOTE] Reinforcement Learning
>
> Learning through trial and error. An agent interacts with an environment and receives rewards or penalties for actions, learning to maximize cumulative reward. Example: game playing (Chess, Go) and RLHF in LLMs.

# Three Core Task Types

> [!NOTE] Regression
>
> Predicting a continuous numerical value. Output is a real number. Example: predicting tomorrow's temperature (e.g., 28.5°C).

> [!NOTE] Classification
>
> Predicting a discrete categorical class label. Output is a category. Example: classifying an email as Spam or Not Spam.

> [!NOTE] Clustering
>
> Grouping data points such that points in the same group are more similar to each other than to those in other groups. Example: K-Means clustering.

# ML Vocabulary Glossary

> [!NOTE]
>
> 1. <strong>Training vs Testing</strong>
>
>    <strong>Training data</strong> is the subset used to fit the model parameters. <strong>Testing data</strong> is a separate holdout set used to evaluate how well the model generalizes to unseen data.
>
> 2. <strong>Overfitting vs Underfitting</strong>
>
>    <strong>Overfitting</strong> occurs when a model learns the training data's noise and details too well, failing to generalize to new data. <strong>Underfitting</strong> occurs when the model is too simple to capture the underlying pattern.
>
> 3. <strong>Bias vs Variance</strong>
>
>    <strong>Bias</strong> is error from erroneous assumptions in the algorithm (leads to underfitting). <strong>Variance</strong> is error from sensitivity to small fluctuations in the training set (leads to overfitting).
>
> 4. <strong>Features vs Labels</strong>
>
>    <strong>Features</strong> are individual inputs or variables fed into the model (e.g., house size, age). <strong>Labels</strong> are the ground-truth targets or outputs the model is trying to predict (e.g., house price).
>
> 5. <strong>Loss Function</strong>
>
>    A mathematical function that measures how far the model's predictions are from the true labels. The goal of training is to minimize this loss. Examples: Mean Squared Error (MSE), Cross-Entropy.
>
> 6. <strong>Epoch vs Batch</strong>
>
>    A <strong>batch</strong> is the subset of training samples passed through the network in one forward/backward pass. An <strong>epoch</strong> represents one complete pass of the entire training dataset.
>
> 7. <strong>Gradient Descent</strong>
>
>    An optimization algorithm used to minimize the loss function by iteratively updating the model's weights in the opposite direction of the gradient (steepest ascent) of the loss curve.
