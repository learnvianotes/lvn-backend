---
id: ad263af1-02e7-7247-b665-a4878cc3714b
key: topic:operating-systems/cpu_scheduling
subject: operating-systems
topic: cpu_scheduling
title: CPU Scheduling
slug: cpu-scheduling
order: 1
---

CPU allocation algorithms, Gantt chart scheduling evaluations, and queue strategies.

# 1. Scheduling Terms &amp; Definitions

> [!INFO]
>
> • <strong>Preemption:</strong> The OS can interrupt a running process to allocate CPU to another process.<br> • <strong>Non-preemption:</strong> A process holds the CPU until it terminates or blocks (voluntarily relinquishes control).<br> • <strong>Arrival Time (AT):</strong> Time when a process enters the ready queue.<br> • <strong>Burst Time (BT):</strong> CPU execution time required by the process.<br> • <strong>Completion Time (CT):</strong> Time when the process finishes execution.<br> • <strong>Turnaround Time (TAT):</strong> Total time from arrival to completion. `TAT = CT - AT`.<br> • <strong>Waiting Time (WT):</strong> Time spent waiting in the ready queue. `WT = TAT - BT`.<br> • <strong>Response Time (RT):</strong> Time from arrival to the first CPU allocation. `RT = First Allocation - AT`.

# 2. Numerical Scheduling Trace Examples

> [!NOTE]
>
> <strong>Sample Dataset:</strong> Let's evaluate the following processes across multiple scheduling algorithms:
>
> <strong>Process</strong> | <strong>Arrival Time (AT)</strong> | <strong>Burst Time (BT)</strong> | <strong>Priority (Lower = Higher)</strong>
>
> P1 | 0 | 4 | 2
>
> P2 | 1 | 3 | 1
>
> P3 | 2 | 1 | 3
>
> P4 | 3 | 2 | 2

> [!NOTE] First-Come, First-Served (FCFS)
>
> <strong>Definition:</strong> Non-preemptive scheduling where the process that requests the CPU first is allocated the CPU first, managed via a standard FIFO queue.
>
> <strong>Pros</strong>
>
> - Simple to understand, code, and maintain.
> - Fairness in terms of order of requests; guarantees no starvation.
>
> <strong>Cons</strong>
>
> - <strong>Convoy Effect:</strong> Short processes get stuck waiting behind long CPU-bound processes.
> - Poor average waiting and response times; unsuitable for interactive systems.
>
> <strong>Use Case:</strong> Batch systems where turnaround time is secondary to CPU utilization, or simple microcontroller task queues.
>
> <strong>Gantt Chart (Execution Trace):</strong>
>
> `P1 | P2 | P3 | P4`
>
> `0 4 7 8 10`
>
> • <strong>CT:</strong> P1=4, P2=7, P3=8, P4=10.<br> • <strong>TAT (CT - AT):</strong> P1=4, P2=6, P3=6, P4=7. (Avg: <strong>5.75</strong>)<br> • <strong>WT (TAT - BT):</strong> P1=0, P2=3, P3=5, P4=5. (Avg: <strong>3.25</strong>)

> [!NOTE] Shortest Job First (SJF)
>
> <strong>Definition:</strong> Non-preemptive scheduling that selects the waiting process with the smallest CPU burst time for the next execution slot.
>
> <strong>Pros</strong>
>
> - Provably minimizes average waiting time for a given set of processes.
> - Good for short interactive processes which finish quickly.
>
> <strong>Cons</strong>
>
> - <strong>Starvation:</strong> Long processes can wait indefinitely if short processes are constantly submitted.
> - Impossible to know next CPU burst length beforehand (must be predicted).
>
> <strong>Use Case:</strong> Long-term scheduler in mainframe environments where execution time limits are declared in job attributes.
>
> <strong>Gantt Chart (Execution Trace):</strong>
>
> At t=4, P2 (BT=3), P3 (BT=1), and P4 (BT=2) are ready. P3 is selected first because it has the shortest burst time.
>
> `P1 | P3 | P4 | P2`
>
> `0 4 5 7 10`
>
> • <strong>CT:</strong> P1=4, P3=5, P4=7, P2=10.<br> • <strong>TAT:</strong> P1=4, P2=9, P3=3, P4=4. (Avg: <strong>5.00</strong>)<br> • <strong>WT:</strong> P1=0, P2=6, P3=2, P4=2. (Avg: <strong>2.50</strong>)

> [!NOTE] Shortest Remaining Time First (SRTF)
>
> <strong>Definition:</strong> Preemptive version of SJF. The currently running process is preempted if a newly arrived process has a shorter remaining burst time.
>
> <strong>Pros</strong>
>
> - Achieves exceptionally low average waiting time and response time.
> - Overcomes the non-preemptive delays of SJF when short jobs arrive.
>
> <strong>Cons</strong>
>
> - High context-switch overhead due to frequent preemption checks.
> - Requires tracking remaining burst times continuously; starvation risk.
>
> <strong>Use Case:</strong> Short-term CPU schedulers in environments where process runtimes are predictable or bounded.
>
> <strong>Gantt Chart (Execution Trace):</strong>
>
> At t=2, P3 (BT=1) arrives and preempts P1 (remaining BT=2).
>
> `P1 | P3 | P1 | P4 | P2`
>
> `0 2 3 5 7 10`
>
> • <strong>CT:</strong> P3=3, P1=5, P4=7, P2=10.<br> • <strong>TAT:</strong> P1=5, P2=9, P3=1, P4=4. (Avg: <strong>4.75</strong>)<br> • <strong>WT:</strong> P1=1, P2=6, P3=0, P4=2. (Avg: <strong>2.25</strong>)

> [!NOTE] Round Robin (RR) — Time Quantum = 2
>
> <strong>Definition:</strong> Preemptive scheduling algorithm where each ready process is assigned the CPU for a fixed time interval (time quantum) in a cyclic order.
>
> <strong>Pros</strong>
>
> - Highly interactive; guarantees excellent response times for all users.
> - Fair distribution of CPU resources; completely starvation-free.
>
> <strong>Cons</strong>
>
> - Heavy performance degradation if the quantum is too small (excessive context switching).
> - Becomes FCFS if the time quantum is larger than the longest burst time.
>
> <strong>Use Case:</strong> Multi-user time-sharing environments, general desktop systems, and network packet routing.
>
> <strong>Gantt Chart (Execution Trace):</strong>
>
> `P1 | P2 | P3 | P1 | P4 | P2`
>
> `0 2 4 5 7 9 10`
>
> • <strong>CT:</strong> P3=5, P1=7, P4=9, P2=10.<br> • <strong>TAT:</strong> P1=7, P2=9, P3=3, P4=6. (Avg: <strong>6.25</strong>)<br> • <strong>WT:</strong> P1=3, P2=6, P3=2, P4=4. (Avg: <strong>3.75</strong>)

> [!NOTE] Preemptive Priority Scheduling
>
> <strong>Definition:</strong> CPU scheduling where tasks are assigned priorities, and a higher priority process preempts a lower priority running process.
>
> <strong>Pros</strong>
>
> - Critical and time-sensitive processes are prioritized and execute immediately.
> - Allows direct control over system responsiveness for important tasks.
>
> <strong>Cons</strong>
>
> - <strong>Indefinite Blocking / Starvation:</strong> Low priority processes may never run if high priority tasks stream in.
> - Requires complex priority assignment; solved by <strong>aging</strong> (gradually increasing priority over wait time).
>
> <strong>Use Case:</strong> Real-time operating systems (RTOS) or critical daemon process scheduling inside modern operating kernels.
>
> <strong>Gantt Chart (Execution Trace):</strong>
>
> At t=1, P2 (priority 1) arrives and preempts P1 (priority 2).
>
> `P1 | P2 | P1 | P4 | P3`
>
> `0 1 4 7 9 10`
>
> • <strong>CT:</strong> P2=4, P1=7, P4=9, P3=10.<br> • <strong>TAT:</strong> P1=7, P2=3, P3=8, P4=6. (Avg: <strong>6.00</strong>)<br> • <strong>WT:</strong> P1=3, P2=0, P3=7, P4=4. (Avg: <strong>3.50</strong>)

# Scheduling Mechanics

> [!NOTE] How to choose Round Robin Quantum?
>
> Choosing the time quantum clock size is a critical trade-off:
>
> - <strong>Too small:</strong> Excessive context switching overhead destroys efficiency.
> - <strong>Too large:</strong> Becomes identical to First-Come First-Served (FCFS), resulting in terrible response times for interactive applications.
> - <strong>Rule of Thumb:</strong> 80% of CPU bursts should be shorter than the time quantum.

> [!NOTE] Multilevel Feedback Queue (MLFQ)
>
> One of the most complex scheduler types. It organizes the ready queue into multiple priority tiers. Processes can migrate dynamically: CPU-bound processes drop to lower priority queues, while I/O-bound processes migrate upwards. This maximizes interactive responsiveness without requiring process profiling.
