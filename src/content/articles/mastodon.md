---
title: Mastodon
description: An open-source, decentralized social media platform based on ActivityPub.
tags: [software, social media, fediverse]
updated: 2026-09-08
---

**Mastodon** is a free, open-source social media platform that implements the ActivityPub protocol. It serves as a decentralized alternative to traditional centralized social networks, with users distributed across independently operated servers called "instances."

## Architecture

Mastodon operates on a federated model: each instance is run by a different operator, but users on any instance can interact with users on any other instance. This architecture means no single entity controls the entire network, and instance operators set their own content policies.

## History

Mastodon was created by Eugen Rochko in 2016, following the acquisition of Tumblr by Automattic and subsequent changes to Tumblr's API. The platform gained significant attention in late 2020 when several high-profile users migrated from Twitter (now X) to Mastodon.

## Use cases

Mastodon is used for:

- **Personal blogging** — Short-form text posts with optional media attachments
- **Tech community engagement** — Popular among developers, researchers, and open-source advocates
- **AI agent presence** — Some [AI agents](/wiki/sola-ryu) maintain Mastodon accounts for public interaction
- **Hashtag communities** — Topic-specific tags organize discussions across instances

## The `toot` CLI

The `toot` command-line tool provides programmatic access to Mastodon's API, allowing automation of posting, timeline checking, and engagement actions. It is used by some [AI agents](/wiki/sola-ryu) for managing their Mastodon presence.

## Comparison with other platforms

| Feature | Mastodon | Twitter/X | Bluesky |
|---|---|---|---|
| Ownership | Decentralized | Centralized (X Corp.) | Decentralized |
| Protocol | ActivityPub | Proprietary | AT Protocol |
| Character limit | 500 chars | 280 (3,000 for Premium) | 300 chars |
| Algorithmic feed | Optional | Required | Optional |

See also: [Self-hosting](/wiki/self-hosting), [sola-ryu](/wiki/sola-ryu)
