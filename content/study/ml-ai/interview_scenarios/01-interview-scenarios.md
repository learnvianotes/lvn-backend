---
id: 4bc6ce8a-d5a1-71f2-86e8-a0fc6c059472
key: topic:ml-ai/interview_scenarios
subject: ml-ai
topic: interview_scenarios
title: Interview Scenarios
slug: interview-scenarios
order: 1
---

Scenario questions test whether you can turn a vague business problem into a working ML system. Use a consistent framework, state assumptions out loud, and always start from a baseline.

# A framework for any ML design question

1. <strong>Clarify the goal</strong>

   What decision does the model drive? Who uses it? What counts as success (business metric)?

2. <strong>Frame the ML task</strong>

   Target definition, prediction time, task type (classification, ranking…), constraints: latency, scale, interpretability, fairness.

3. <strong>Data &amp; labels</strong>

   Sources, how labels are obtained and <strong>how late they arrive</strong>, class balance, biases, privacy.

4. <strong>Features</strong>

   Available at prediction time? Aggregates over history, real-time vs batch features, a feature store.

5. <strong>Model</strong>

   Baseline (rule or logistic regression) → gradient boosting → deep models if data is unstructured or huge.

6. <strong>Evaluation</strong>

   Offline metric that matches the goal, split by time/group, slices; then an online A/B test.

7. <strong>Serving</strong>

   Batch vs real-time, latency budget, fallbacks, shadow/canary rollout.

8. <strong>Monitoring &amp; iteration</strong>

   Drift, data quality, delayed performance, feedback loops, retraining, fairness audits.

# Scenario 1 — Credit-card fraud detection

| Aspect | Answer |
| --- | --- |
| Task | Binary classification per transaction, scored in real time (e.g. &lt; 50 ms) before approval |
| Labels | Chargebacks and analyst decisions — they arrive <strong>weeks later</strong>, so recent data is partly unlabelled; account for label delay in training windows and monitoring |
| Imbalance | Fraud ≈ 0.1%: evaluate with PR-AUC and recall at a precision the review team can handle; never accuracy |
| Features | Amount vs the card's history, merchant category, geo-velocity (distance since last transaction), device, counts in the last minute/hour/day from a low-latency feature store |
| Model | Gradient-boosted trees with class weights; rules as a baseline and safety net |
| Validation | Time-based split (train on earlier months, test on later), grouped so a card isn't in both |
| Decision | Threshold from <strong>costs</strong>: a missed fraud costs the amount; a false decline costs customer goodwill. Possibly three actions: approve / step-up authentication / decline |
| Monitoring | Fraudsters adapt (concept drift): monitor score distributions and precision of reviewed alerts, retrain frequently; shadow-deploy new models to check latency and agreement |

# Scenario 2 — A video recommendation feed

| Aspect | Answer |
| --- | --- |
| Goal | Long-term user satisfaction, measured online by watch time, return visits and explicit feedback — not clicks alone (clicks reward clickbait) |
| Architecture | <strong>Candidate generation</strong> (two-tower embeddings / matrix factorisation / co-watch) retrieves hundreds of videos from millions in milliseconds → <strong>ranking</strong> model scores them with rich features → re-ranking for diversity, freshness and policy |
| Labels | Consistent with the goal: e.g. predict expected watch time or a satisfaction-weighted engagement; treat clicks followed by an immediate exit as negative |
| Features | User history embeddings, video metadata and embeddings, context (device, time), freshness |
| Offline eval | Recall@k for retrieval, NDCG@k for ranking, on a time-based split |
| Online eval | A/B test on watch time and retention with guardrails (diversity, creator coverage, complaints) |
| Pitfalls | Popularity bias and feedback loops (the model only learns from what it showed) → exploration traffic; cold start for new videos → content embeddings |

# Scenario 3 — A CTR model's performance dropped

An ads click-through model was fine for months; this week online CTR and calibration fell. Debug in order — cheapest and most common causes first:

1. <strong>Check the pipeline</strong>

   Recent deploys, schema changes, missing or defaulted features, logging bugs, a feature now computed differently online (training–serving skew).

2. <strong>Check the data</strong>

   Data-quality dashboards: null rates, new categories, value ranges; PSI of key features between training data and this week.

3. <strong>Check the predictions</strong>

   Score distribution and calibration (predicted vs observed CTR) by segment; which slices dropped.

4. <strong>Check the world</strong>

   Seasonality, a new product or campaign, a competitor, a policy change — concept drift.

5. <strong>Fix</strong>

   Roll back if a release caused it; otherwise retrain on recent data (respecting label delay), recalibrate, and add monitors for whatever you missed.

# Scenario 4 — Customer churn

| Aspect | Answer |
| --- | --- |
| Target | No purchase/activity in the 30 days after a prediction date — defined with the retention team |
| Features | Only from before the prediction date: recency, frequency, monetary value, support tickets, plan changes, usage trends |
| Split | Train on earlier prediction dates, validate on later ones |
| Metric | Precision@k for the number of customers the team can contact; uplift if an intervention is tested |
| Model | Logistic regression baseline → gradient boosting; SHAP to explain the main drivers to the business |
| Action | Predicting churn isn't enough — an A/B test of the retention offer measures whether contacting high-risk customers actually changes behaviour (uplift modelling targets those who respond) |

```question
You have only 200 labelled examples. What do you do?

---

Start simple: a regularised linear model or small tree ensemble with cross-validation (repeated stratified K-fold) and strong domain features. Get more labels cheaply — active learning, weak supervision, semi-supervised learning — and use pretrained models/embeddings for text or images (transfer learning). Report confidence intervals: with 200 rows, scores are noisy.
```

```question
Your model is 99% accurate on a medical screening task. The doctors are unhappy. Why?

---

If 99% of patients are healthy, predicting “healthy” always gives 99% accuracy while missing every case. Screening cares about recall (sensitivity) at an acceptable specificity; report the confusion matrix, choose the threshold with clinicians based on the cost of a missed case, and check calibration and performance across patient groups.
```

```question
How would you build a spam filter from scratch?

---

Labels from user reports plus an annotated sample; features from text (TF-IDF or embeddings), sender reputation, links and headers; baseline Naive Bayes or logistic regression, then gradient boosting or a fine-tuned transformer; optimise recall at very high precision because false positives (lost real email) are costly; time-based validation; monitor drift as spammers adapt; retrain frequently.
```
