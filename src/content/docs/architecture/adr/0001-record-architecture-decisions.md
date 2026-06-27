---
title: 1. Record Architecture Decisions
description: Architectural Decision Record establishing ADR usage for Docs-as-Code.
---

# 1. Record Architecture Decisions

* **Status**: Accepted
* **Date**: 2026-06-26

## Context

We need to record our architectural decisions for the SOTA Docs-as-Code Engine. If we do not document these decisions, the context behind design choices (such as integrating Starlight, React Flow, and GLM-5.2 streaming APIs) will be lost over time, leading to maintenance overhead and disjointed configuration updates.

## Decision

We will use Architectural Decision Records (ADRs) using the Michael Nygard template. 

* The ADRs will reside directly within the documentation repository at `src/content/docs/architecture/adr/`.
* They will be treated with the same rigor as source code: reviewed via Pull Requests and tracked in version control.
* Each ADR will have a sequential number prefix (e.g., `0001-title.md`) to establish chronological order.

## Consequences

* **Clarity**: Future maintainers will understand the "why" behind the technology stack and integration parameters.
* **Traceability**: All architectural shifts will have a distinct, immutable history in version control.
* **Integrity**: Documentation configuration changes will require an accompanying ADR if they deviate from established patterns.
