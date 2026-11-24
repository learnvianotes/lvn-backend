---
id: 31a0cd51-3bf0-7619-9668-400de984bd03
key: topic:system-design/spof
subject: system-design
topic: spof
title: High Availability
slug: high-availability
order: 1
---

A component whose failure causes the entire system to fail. Eliminating SPOFs is the foundation of high availability.

# Definition

> [!INFO]
>
> A <strong>Single Point of Failure (SPOF)</strong> is any component that, if it fails, takes down the entire system. High-availability design is fundamentally the exercise of identifying and eliminating SPOFs through redundancy.

# Common SPOFs and Solutions

> [!NOTE] Single DB Server
>
> Solution: Primary-replica setup with automatic failover. Use managed services (RDS Multi-AZ) that handle failover automatically.

> [!NOTE] Single Load Balancer
>
> Solution: Active-active or active-passive LB pairs. DNS failover. Use cloud-managed LBs (AWS ALB) with built-in redundancy.

> [!NOTE] Single Data Center
>
> Solution: Multi-region deployment. Active-active or active-passive across regions. DNS routing via latency/health checks.

> [!NOTE] Single Network Provider
>
> Solution: Multi-homing — connect to multiple ISPs. BGP routing for automatic failover.

> [!NOTE]
>
> <strong>Five Nines (99.999%):</strong> Only 5.26 minutes of downtime per year. Achieving this requires redundancy at every layer — compute, network, storage, DNS — with automated health checks and failover.
