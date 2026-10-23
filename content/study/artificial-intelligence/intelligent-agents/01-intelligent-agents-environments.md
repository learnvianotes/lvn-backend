---
id: 938c55b9-fe9c-7e21-8e5b-eed569a4509c
key: topic:artificial-intelligence/intelligent-agents
subject: artificial-intelligence
topic: intelligent-agents
title: Intelligent Agents & Environments
slug: intelligent-agents-environments
order: 1
---

An <strong>agent</strong> perceives its environment through sensors and acts on it through actuators. Describing an AI problem starts by pinning down four things — its <strong>PEAS</strong> — and the properties of its environment, which decide which techniques will work.

Environment → Sensors → percept → Agent program → Actuators → action → Environment

> [!INFO]
>
> <strong>Agent function</strong> — a mapping from every possible <strong>percept sequence</strong> (everything the agent has perceived so far) to an action. The <strong>agent program</strong> is the concrete code that implements it on a machine.

> [!INFO]
>
> <strong>Rational agent</strong> — for each possible percept sequence, selects the action expected to maximise its <strong>performance measure</strong>, given the evidence of the percepts and its built-in knowledge.

> [!WARNING] Watch out
>
> Rational ≠ omniscient ≠ perfect. A rational agent maximises <em>expected</em> performance with the information it has; bad luck doesn't make it irrational. It should also gather information (look before crossing) and <strong>learn</strong> to compensate for incomplete prior knowledge.

# The vacuum world

The textbook toy: two squares, A and B, each clean or dirty. The agent perceives `(location, status)` and can `Suck`, move `Left` or `Right`. The performance measure awards one point per clean square per time step:

```python filename:Python
def reflex_vacuum_agent(percept):
    location, status = percept
    if status == "Dirty":
        return "Suck"
    return "Right" if location == "A" else "Left"

def run(agent, world, location="A", steps=6):
    score, actions = 0, []
    for _ in range(steps):
        action = agent((location, world[location]))
        actions.append(action)
        if action == "Suck":
            world[location] = "Clean"
        elif action in ("Left", "Right"):
            location = "B" if action == "Right" else "A"
        score += sum(s == "Clean" for s in world.values())   # performance measure
    return actions, score

actions, score = run(reflex_vacuum_agent, {"A": "Dirty", "B": "Dirty"})
print(actions)    # ['Suck', 'Right', 'Suck', 'Left', 'Right', 'Left']
print(score)      # 10 ← 1 + 1 + 2 + 2 + 2 + 2
```

# PEAS — specifying the task

| Agent | Performance measure | Environment | Actuators | Sensors |
| --- | --- | --- | --- | --- |
| Self-driving taxi | Safe, fast, legal, comfortable trip; profit | Roads, traffic, pedestrians, weather, passengers | Steering, accelerator, brake, signals, display | Cameras, LiDAR, radar, GPS, speedometer, odometer |
| Medical diagnosis system | Healthy patient, low cost, few tests | Patient, hospital, staff | Display questions, tests, diagnoses, treatments | Keyboard entry of symptoms, test results |
| Chess program | Win / draw / loss | Board, opponent, clock | Moves on the board | Board state |
| Spam filter | Spam caught, legitimate mail kept | Mail stream, users | Mark as spam / deliver | Message text, headers, sender reputation |

# Properties of task environments

| Dimension | Easy end | Hard end | What it changes |
| --- | --- | --- | --- |
| Observability | <strong>Fully observable</strong> — sensors show the whole relevant state | <strong>Partially observable</strong> — noisy sensors, hidden state | Hidden state → agent must keep internal state / beliefs |
| Agents | <strong>Single-agent</strong> | <strong>Multi-agent</strong> — competitive or cooperative | Opponents → game theory, adversarial search |
| Determinism | <strong>Deterministic</strong> — next state fixed by state + action | <strong>Stochastic</strong> (nondeterministic) — outcomes uncertain | Uncertainty → probabilities, expected utility |
| Episodes | <strong>Episodic</strong> — each decision independent (classify one image) | <strong>Sequential</strong> — actions affect the future (chess) | Sequential → planning ahead |
| Change | <strong>Static</strong> — world waits while agent thinks | <strong>Dynamic</strong> — world changes meanwhile | Dynamic → time pressure, anytime algorithms |
| State/time | <strong>Discrete</strong> — finite states and actions | <strong>Continuous</strong> — positions, speeds | Continuous → optimisation, control theory |
| Knowledge | <strong>Known</strong> — rules/physics given | <strong>Unknown</strong> — must learn how the world works | Unknown → exploration, learning |

| Task | Observable | Agents | Deterministic | Episodic | Static | Discrete |
| --- | --- | --- | --- | --- | --- | --- |
| Crossword puzzle | Fully | Single | Yes | Sequential | Static | Discrete |
| Chess with a clock | Fully | Multi | Yes | Sequential | Semi | Discrete |
| Poker | Partially | Multi | Stochastic | Sequential | Static | Discrete |
| Taxi driving | Partially | Multi | Stochastic | Sequential | Dynamic | Continuous |
| Image classification | Fully | Single | Yes | Episodic | Static | Continuous |

> [!NOTE] Key point
>
> The real world is the hard end of every dimension: partially observable, multi-agent, stochastic, sequential, dynamic, continuous and unknown. Most techniques in these notes relax one or more dimensions — search assumes fully observable + deterministic + known; MDPs drop determinism; reinforcement learning drops “known”.

```question
What does PEAS stand for?

---

Performance measure, Environment, Actuators, Sensors — the four things to specify before designing an agent.
```

```question
Is a rational agent always successful?

---

No. It maximises <em>expected</em> performance given its percepts and knowledge. With partial information or a stochastic world it can make the best possible choice and still get a bad outcome.
```

```question
What's the difference between the agent function and the agent program?

---

The agent function is the abstract mathematical mapping from percept histories to actions (often an infinite table). The agent program is the finite code running on the agent's architecture that implements it.
```
