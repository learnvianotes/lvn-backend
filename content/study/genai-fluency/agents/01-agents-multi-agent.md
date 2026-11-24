---
id: 67736eda-d696-77ce-b55d-75cf3ba5ce83
key: topic:genai-fluency/agents
subject: genai-fluency
topic: agents
title: Agents & Multi-Agent
slug: agents-multi-agent
order: 1
---

Shifting from single-turn prompts to autonomous loops that plan, retrieve, and execute tools.

# Core Agentic Loop components

> [!NOTE] 1. Planning
>
> Decomposing large tasks into sub-goals. Techniques like ReAct (Reason + Act) combine reasoning steps with tool execution.

> [!NOTE] 2. Memory
>
> \- <strong>Short-term</strong>: Context window chat history. <br>- <strong>Long-term</strong>: External vector store summarizing past user interactions.

> [!NOTE] 3. Reflection
>
> Self-correction loop. The agent evaluates its own output against criteria and rewrites it if it fails verification.

> [!NOTE] 4. Guardrails
>
> Input/output validation layers checking for prompt injection, toxic outputs, or PII leaks before execution.

# Multi-Agent Frameworks

> [!INFO]
>
> Frameworks like <strong>CrewAI</strong> and <strong>LangGraph</strong> orchestrate multiple specialized agents, reducing complex tasks into task delegations.

> [!NOTE] Supervisor Pattern
>
> A central router LLM evaluates user inputs and delegates work to specific sub-agents. Sub-agents execute and return results to the supervisor, who decides if the task is complete.

> [!NOTE] Planner-Worker-Critic
>
> A Planner agent breaks the goal down; Worker agents execute specific tasks (coding, searching); a Critic agent audits the outputs and requests fixes from the workers if flaws are detected.

> [!NOTE] Shared Memory / State
>
> Agents share a common graph state (like in LangGraph). Any agent can read from or write to the shared memory, allowing asynchronous parallel execution with deterministic state transitions.
