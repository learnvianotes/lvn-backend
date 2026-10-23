---
id: 0d2e6b9e-36dc-748e-b192-288eef219c6b
key: topic:computer-networks/datalink
subject: computer-networks
topic: datalink
title: MAC, ARP & Framing
slug: mac-arp-framing
order: 1
---

The last logical hop before data becomes a raw electrical signal.

# DHCP — getting an address automatically

> [!INFO] Definition
>
> <strong>DHCP</strong> (Dynamic Host Configuration Protocol) automatically assigns IP addresses to new devices joining a network, from a pool of available addresses managed by a DHCP server.

New device joins LAN → DHCP server (address pool) → Device receives an IP address

# MAC Addresses

> [!INFO] Definition
>
> A <strong>MAC address</strong> (Media Access Control address) is a hardware identifier permanently assigned to a network interface — every network-capable device has one, distinct from its (changeable) IP address.

Within a LAN, devices at the Data Link layer communicate using these MAC addresses, not IP addresses.

# ARP — Address Resolution Protocol

> [!INFO] Definition
>
> <strong>ARP</strong> bridges the gap between Layer 3 and Layer 2 — it resolves a known IP address into the corresponding MAC address needed to actually deliver a frame on the local network. Resolved mappings are cached locally in what's called the <strong>ARP cache</strong>, avoiding repeated lookups for the same address.

# Frame anatomy

Before a network-layer packet can hit the physical wire, the Data Link Layer wraps it into a <strong>frame</strong> containing (at minimum):

- The sender's Data Link layer address (MAC)
- The IP address of the destination, carried inside the encapsulated packet

Network-layer packet → wrapped into → Data Link frame
