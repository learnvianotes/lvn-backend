---
id: 844a020f-756f-7852-b66f-d312b5e5fa04
key: topic:artificial-intelligence/agent-types
subject: artificial-intelligence
topic: agent-types
title: Types of Agents
slug: types-of-agents
order: 1
---

Agent programs range from simple lookup rules to systems that plan, weigh trade-offs and improve themselves. Each type adds one capability to the previous one.

| Agent type | Decides using | Strength | Limitation | Example |
| --- | --- | --- | --- | --- |
| <strong>Simple reflex</strong> | Condition–action rules on the <em>current</em> percept | Fast, simple | Fails when the world is partially observable; can loop forever | Thermostat, the vacuum agent above |
| <strong>Model-based reflex</strong> | Rules + an internal <strong>state</strong> updated by a model of how the world evolves | Handles partial observability | Still has no explicit goals | Car tracking vehicles it can't currently see |
| <strong>Goal-based</strong> | A model + <strong>goals</strong>; searches/plans for action sequences that reach them | Flexible — change the goal, not the rules | Goals are binary: all paths to the goal look equally good | Route planner, puzzle solver |
| <strong>Utility-based</strong> | A <strong>utility function</strong> scoring how <em>desirable</em> each state is; maximises expected utility | Trades off speed, safety, cost; handles uncertainty | Utility is hard to specify; heavy computation | Self-driving car choosing a route |
| <strong>Learning agent</strong> | Any of the above + components that improve it from experience | Works in unknown environments; gets better | Needs data/experience; can learn wrong things | Spam filter, game-playing RL agent |

# Why internal state matters

Add a cost of 1 point per move to the vacuum world. The simple reflex agent can't remember that B is already clean, so it shuttles back and forth forever. A model-based agent remembers both squares and stops (`NoOp`):

```python filename:Python
def reflex_agent(percept):
    location, status = percept
    if status == "Dirty":
        return "Suck"
    return "Right" if location == "A" else "Left"

def make_model_based_agent():
    model = {"A": None, "B": None}               # internal state: what we believe about each square
    def agent(percept):
        location, status = percept
        model[location] = status                 # update the model from the percept
        if status == "Dirty":
            model[location] = "Clean"            # predict the effect of our own action
            return "Suck"
        if model["A"] == model["B"] == "Clean":
            return "NoOp"
        return "Right" if location == "A" else "Left"
    return agent

def run(agent, steps=10):
    world, location, score = {"A": "Dirty", "B": "Dirty"}, "A", 0
    for _ in range(steps):
        action = agent((location, world[location]))
        if action == "Suck":
            world[location] = "Clean"
        elif action in ("Left", "Right"):
            location = "B" if action == "Right" else "A"
            score -= 1                                          # moving costs energy
        score += sum(s == "Clean" for s in world.values())
    return score

print(run(reflex_agent))               # 10 ← keeps paying for pointless moves
print(run(make_model_based_agent()))   # 17 ← stops once it knows both squares are clean
```

# Goals vs utilities

A goal-based agent asks <em>“does this reach the goal?”</em>; a utility-based agent asks <em>“how good is this outcome?”</em>. Utility is needed whenever goals conflict (speed vs safety) or success is uncertain — the agent then maximises <strong>expected utility</strong> (see <strong>Utility &amp; Markov Decision Processes</strong>).

# The learning agent

> [!NOTE] Performance element
>
> The agent proper — selects actions (any of the four designs above).

> [!NOTE] Critic
>
> Judges how well the agent is doing against a fixed performance standard and gives feedback (e.g. a reward).

> [!NOTE] Learning element
>
> Uses the critic's feedback to improve the performance element.

> [!NOTE] Problem generator
>
> Suggests exploratory actions that lead to new, informative experiences — exploration.

> [!NOTE] Key point
>
> LLM-based “AI agents” fit this template: the LLM is the performance element choosing actions (tool calls), a memory/scratchpad is the internal state, the user's task is the goal, and feedback loops play the critic. See the <strong>Generative AI</strong> notes.

```question
When is a simple reflex agent enough?

---

When the environment is fully observable and the right action depends only on the current percept — e.g. a thermostat. With partial observability it needs internal state (model-based) or it may loop forever.
```

```question
Why would you prefer a utility-based agent over a goal-based one?

---

Goals only distinguish success from failure. A utility function ranks outcomes, so the agent can trade off conflicting objectives and weigh the probability of success — essential under uncertainty.
```
