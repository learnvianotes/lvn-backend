---
id: 3f855b10-2cad-71c1-ba32-5331665bad6f
key: topic:artificial-intelligence/ai-ethics-safety
subject: artificial-intelligence
topic: ai-ethics-safety
title: AI Ethics, Safety & Fairness
slug: ai-ethics-safety-fairness
order: 1
---

AI systems make or influence decisions about loans, jobs, medical care and what people see. Building them responsibly means asking not only <em>does it work?</em> but <em>for whom, with what failures, and who is accountable?</em>

# Core principles

> [!NOTE] Fairness
>
> Outcomes shouldn't systematically disadvantage groups defined by race, gender, age, disability…

> [!NOTE] Transparency & explainability
>
> People affected should know AI is used and get understandable reasons for decisions.

> [!NOTE] Privacy
>
> Data is collected with consent, minimised and protected; models shouldn't leak training data.

> [!NOTE] Safety & robustness
>
> Systems behave reliably under distribution shift, adversarial inputs and misuse.

> [!NOTE] Accountability
>
> A human or organisation is answerable for the system's decisions; there are audit trails and appeals.

> [!NOTE] Human oversight
>
> Humans can monitor, override or switch off the system, especially in high-stakes uses.

# Where bias comes from

| Source | Example |
| --- | --- |
| <strong>Historical bias</strong> | Past hiring data reflects past discrimination; a model trained on it reproduces it |
| <strong>Representation / sampling bias</strong> | Face datasets with few darker-skinned faces → higher error rates for those groups |
| <strong>Measurement bias</strong> | Using arrests as a proxy for crime, or health spending as a proxy for health need |
| <strong>Proxy features</strong> | Removing “race” doesn't help if postcode or name still encodes it |
| <strong>Feedback loops</strong> | Predictive policing sends officers where arrests were recorded, generating more records there |

# Measuring fairness

```python filename:Python
# (group, true label, model prediction) for a toy loan-approval model; 1 = approve / would repay
data = [("A", 1, 1), ("A", 1, 1), ("A", 1, 0), ("A", 0, 1), ("A", 0, 0), ("A", 0, 0),
        ("B", 1, 1), ("B", 1, 0), ("B", 1, 0), ("B", 0, 0), ("B", 0, 0), ("B", 0, 0)]

def rates(group):
    rows = [(y, p) for g, y, p in data if g == group]
    selection = sum(p for _, p in rows) / len(rows)                   # P(approve)
    positives = [p for y, p in rows if y == 1]
    tpr = sum(positives) / len(positives)                              # P(approve | would repay)
    return selection, tpr

a, b = rates("A"), rates("B")
print([round(x, 2) for x in a], [round(x, 2) for x in b])   # [0.5, 0.67] [0.17, 0.33] ← [selection rate, true-positive rate]
print(round(b[0] / a[0], 2))                          # 0.33 ← disparate impact ratio (the "80% rule" flags < 0.8)
print(round(a[1] - b[1], 2))                          # 0.33 ← equal-opportunity gap in true-positive rate
```

| Criterion | Requires equal across groups | Intuition |
| --- | --- | --- |
| Demographic parity | Selection rate `P(ŷ = 1)` | Same share of each group approved |
| Equal opportunity | True-positive rate `P(ŷ = 1 &#124; y = 1)` | Qualified people approved equally often |
| Equalised odds | TPR <strong>and</strong> false-positive rate | Equal error rates of both kinds |
| Predictive parity / calibration | `P(y = 1 &#124; ŷ = 1)` or scores mean the same | An approval means the same thing for everyone |

> [!WARNING] Watch out
>
> These criteria <strong>cannot all hold at once</strong> when base rates differ between groups (the impossibility results of Kleinberg et al. and Chouldechova, 2016–17). Choosing a fairness metric is a value judgement about the application, not a purely technical choice.

# Safety and alignment

| Risk | What it looks like | Mitigation |
| --- | --- | --- |
| <strong>Specification gaming / reward hacking</strong> | The system optimises the literal objective, not the intent (see <strong>Reinforcement Learning</strong>) | Careful objectives, human feedback, red-teaming |
| <strong>Distribution shift</strong> | A model trained on one hospital's scans fails at another | Monitoring, robust evaluation, domain adaptation |
| <strong>Adversarial examples</strong> | Tiny pixel changes flip a classifier; prompt injection hijacks an LLM agent | Adversarial training, input validation, least-privilege tools |
| <strong>Hallucination / overconfidence</strong> | Fluent but false answers | Retrieval grounding, calibrated uncertainty, citations, human review |
| <strong>Misuse</strong> | Deepfakes, fraud, disinformation, cyber-attacks | Usage policies, watermarking, access controls |
| <strong>Alignment of capable systems</strong> | Goals that diverge from human values; hard to correct once deployed | Interpretability, scalable oversight, evaluations before release |

# Governance

| Framework | Key idea |
| --- | --- |
| <strong>EU AI Act</strong> (in force 2024, phased in to 2026–27) | Risk tiers: <em>unacceptable</em> (banned, e.g. social scoring), <em>high-risk</em> (hiring, credit, medical — strict obligations), <em>limited</em> (transparency, e.g. chatbots must disclose), <em>minimal</em>; extra duties for general-purpose models |
| NIST AI Risk Management Framework (2023) | Voluntary US framework: Govern, Map, Measure, Manage |
| OECD / UNESCO AI principles | International baselines for trustworthy, human-centred AI |
| Model cards &amp; datasheets | Documentation of intended use, training data, evaluation by subgroup and limitations |

> [!TIP] Do
>
> Evaluate performance <strong>per subgroup</strong>, document data and limits, keep a human in the loop for high-stakes decisions, and monitor after deployment.

> [!DANGER] Avoid
>
> Assume a model is fair because the protected attribute was dropped, or ship without a way to appeal or override its decisions.

The <strong>Machine Learning</strong> notes' <em>Responsible AI &amp; Ethics</em> topic covers the practical checklist for ML projects in more depth.

```question
How can a model be biased if it never sees the protected attribute?

---

Other features act as proxies (postcode, name, school), and the labels themselves may encode historical discrimination. Fairness must be measured on outcomes per group, not assumed from the input list.
```

```question
What is the alignment problem?

---

Making sure an AI system pursues the goals its designers and users actually intend, including unstated constraints — rather than a literal proxy objective. It grows harder as systems become more capable and autonomous.
```

```question
Name two fairness metrics and explain why they can conflict.

---

Demographic parity (equal approval rates) and equal opportunity (equal true-positive rates). If qualified-applicant base rates differ between groups, a perfectly accurate model satisfies equal opportunity but violates demographic parity; forcing parity then changes error rates for some group.
```
