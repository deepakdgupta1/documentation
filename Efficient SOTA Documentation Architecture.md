# **SOTA Documentation Architecture: A Guide for Agentic Systems**

This guide establishes the structural standard for codebases designed for dual-consumption: human engineers and autonomous AI agents. The objective is to maximize structural legibility, ensure precise retrieval context, and eliminate documentation drift through continuous integration automation.  
Treat documentation not as a static wiki, but as the foundational **Agentic Memory** of the software system, ready to be parsed by multi-agent coordination frameworks and RAG pipelines.

## **1\. The B2A (Business-to-Agent) Interface**

Before an agent or human dives into the repository, there must be a standard entry point that broadcasts the entire documentation schema.

* /llms.txt: A clean, plain-text Markdown index at the root of the project. It summarizes the repository's purpose and provides a routing map to critical documentation files.  
* /llms-full.txt: A single, consolidated Markdown document containing the entire project's documentation, delimited by files. This allows an AI agent to ingest the entire system state in one request rather than crawling disparate pages.

With the starlight-llms-txt plugin already handling this generation at build time, the focus shifts entirely to ensuring the source Markdown files are perfectly structured for this pipeline.

## **2\. The Semantic Chunking Standard**

AI agents read markdown by breaking it into chunks for RAG vector embeddings. Disorganized headings create noisy, inaccurate retrieval.

* **Linear Heading Hierarchy:** Strictly follow \# (Page Title) $\\rightarrow$ \#\# (Major Section) $\\rightarrow$ \#\#\# (Sub-section). Never skip levels to ensure predictable DOM-like parsing.  
* **Context-Independent Headers:** Write headers that carry their own context. Instead of generic headers like \#\# How it works, write \#\# How the Data Pipeline Processes Securities. This injects keyword-rich context directly into the chunk header, which is essential for vector semantic search.  
* **GitHub-Flavored Markdown (GFM) Alerts:** Use standard blockquote alerts for critical rules. Modern generators render these with visual cards, and AI parsers explicitly weight text inside \[\!IMPORTANT\] or \[\!WARNING\] blocks with higher priority.

## **3\. The Metadata Schema (YAML Frontmatter)**

Every documentation file must begin with YAML frontmatter. This acts as the structured schema that enables agents to perform hybrid search, metadata filtering, and intent-classification before parsing the body text.

YAML  
\---  
title: "Agentic Mission Control Architecture"  
description: "Detailed system diagram and data flow of the multi-agent coordination engine."  
category: "architecture"  
status: "approved"  
last\_modified: 2026-06-27  
tags: \[backend, harness, autonomous\]  
diagrams: \[system-architecture\]  
\---

## **4\. The Core Topography**

The documentation footprint relies on a highly modular architecture designed for precise context retrieval, utilizing the semantic chunking and metadata standards above.

### **The Context Anchor: README.md**

The entry point for repository scanning. It must prioritize high-level topology and executable bootstrapping over exhaustive tutorials.

* **System Objective:** A single-sentence definition of the software's purpose.  
* **Repository Map:** A flat, text-based directory tree with one-line descriptions for critical modules.  
* **Bootstrapping:** A single command reference (e.g., just bootstrap or make init) to spin up the environment.

### **The System Boundary: architecture.md**

This document defines the structural legibility of the codebase. It maps how components interact without detailing the internal mechanics of those components.

* **Domain Glossary:** Strict definitions of domain-specific terminology.  
* **Text-Based Mermaid.js Diagrams:** Code blocks containing raw Mermaid syntax. Starlight/Docusaurus automatically render these into beautiful, zoomable vector SVGs for humans, while AI agents read the raw structural logic to understand system relationships directly.  
* **Core Invariants:** Non-negotiable architectural rules.

### **The Immutable Ledger: Architecture Decision Records (ADRs)**

A dedicated /docs/decision-log/ directory enforces radical accountability for technical evolution. Agents parse this to understand the historical context behind the architecture.

* **Append-Only:** Files are named sequentially (e.g., 0015-implement-zfs-storage.md). Old decisions are never edited; they are superseded by new ADRs.  
* **Standardized Schema:** Every record must contain Context, Alternatives Considered, Decision, and Consequences.

### **The Ground Truth: Inline Semantics**

The codebase itself must carry the bulk of operational documentation. Agents rely on structural definitions over prose.

* **Strict Typing:** Comprehensive type hints, interfaces, or structs acting as the primary contract.  
* **Intention-Based Docstrings:** Function and class documentation that explains the intent and constraints of the logic.

## **5\. The Drift Automation Engine**

Documentation that requires human discipline to maintain will inevitably drift from reality. The architecture must be enforced via blocking CI pipeline checks.

* **Architectural Conformance Testing:** Translate the boundaries defined in architecture.md into executable unit tests (using tools like pytest-archon or dependency-cruiser) to block code that violates dependency rules.  
* **Strict Linter Enforcement:** Configure strict linting tools (e.g., Ruff) to demand type hints and properly formatted docstrings for all public-facing interfaces before commits are accepted.  
* **Executable Task Runners:** Encapsulate all operational commands within a task runner file. If a configuration changes, the setup script must be updated, or the local development environment will fail to initialize.

## **Dual-Consumption Matrix**

| Feature | Human Benefit (Starlight/Docusaurus) | AI Agent Benefit (RAG / LLMs) |
| :---- | :---- | :---- |
| **YAML Frontmatter** | Controls page routing, sidebar ordering, and SEO templates. | Enables metadata filtering, hybrid search, and status validation. |
| **Semantic Headings** | Creates readable tables of contents and scannable pages. | Generates clean, context-rich chunks for accurate vector embedding. |
| **Mermaid.js Diagrams** | Renders into interactive, zoomable UI graphics in the browser. | Preserves architectural relationships as plain text for logical parsing. |
| **llms.txt Standard** | N/A (Invisible to human users navigating the site). | Provides a single, consolidated entry point to map the entire system state. |

