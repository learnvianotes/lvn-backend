---
id: 55c4ae40-fa10-708d-822c-c5d9d80389b0
key: topic:computer-networks/commands
subject: computer-networks
topic: commands
title: Command-Line Reference
slug: command-line-reference
order: 1
---

Every networking command worth knowing from a terminal, with what it actually shows you.

# Find your public IP address

```bash filename:Shell
$ curl ifconfig.me -s
# returns your machine's public-facing IP address
```

# Ping — round-trip time &amp; packet loss

```
$ ping google.com

PING google.com (142.250.77.238): 56 data bytes
64 bytes from 142.250.77.238: icmp_seq=0 ttl=118 time=8.518 ms
64 bytes from 142.250.77.238: icmp_seq=1 ttl=118 time=9.610 ms
...
--- google.com ping statistics ---
11 packets transmitted, 11 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 7.685/9.245/11.478/1.016 ms
```

> [!INFO] What it measures
>
> <strong>Ping</strong> measures the round-trip time (RTT) for a small message sent from your machine to a destination and echoed straight back — it's the fastest way to check if a host is reachable and how much latency exists on the path. The `ttl=118` shown is the Time-To-Live value remaining when the reply arrived, and `0.0% packet loss` confirms every packet round-tripped successfully.

# DNS lookup

```bash filename:Shell
$ dig google.com          # full DNS resolution trace
$ man dig                 # manual / all available flags
$ dig -type=mx gmail.com  # find a domain's mail servers (MX records)
```

# Packet capture

```bash filename:Shell
$ tcpdump -c 5
# captures the next 5 packets crossing a network interface, live
```

# Quick reference table

| Command | Purpose |
| --- | --- |
| `curl ifconfig.me -s` | Show public IP address |
| `ping <host>` | Test reachability + measure RTT |
| `dig <domain>` | DNS lookup / resolution trace |
| `tcpdump -c N` | Capture N live packets |
