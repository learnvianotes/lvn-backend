---
id: 25a9be75-1b3f-79ce-8b83-396d81683f4c
key: topic:system-design/youtube
subject: system-design
topic: youtube
title: YouTube Video
slug: youtube-video
order: 1
---

A video platform with 2B users, 500 hours of video uploaded per minute. Core challenges: video transcoding at scale, global video delivery.

# Requirements

> [!NOTE] Functional
>
> Upload videos · Stream videos at multiple resolutions · Search · Subscribe and recommended feed · Like/comment

> [!NOTE] Non-Functional
>
> 2B MAU · 500hrs video/min uploaded · Read-heavy (100:1) · Smooth streaming globally · Video must never be lost

# Video Upload &amp; Processing Pipeline

Creator Upload → Raw Storage (S3) → Message Queue → Transcoding Workers

x → x → x ↓ Multiple Resolutions (360p, 720p, 1080p, 4K) → CDN

# Adaptive Bitrate Streaming

> [!INFO]
>
> Video is split into small chunks (2-10 seconds). Each chunk is encoded at multiple bitrates. The player downloads a manifest file listing all available qualities and dynamically selects chunks based on current bandwidth. This is <strong>HLS (HTTP Live Streaming)</strong> or <strong>DASH</strong>. Why it matters: smooth playback even on variable connections.
