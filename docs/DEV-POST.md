---
title: "FinePrint: checking eligibility with Sanity Context and quoted project facts"
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*Prepared for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

Can this project enter this event? Where exactly do the rules say so?

FinePrint starts with the part I’m unsure about. I can ask, “I started my app in August. I added Sanity this week. Can I enter Path One?” The agent reads a Sanity Knowledge Base, proposes facts with exact quotes from my question, then calls a typed checker. The answer shows its sources, the facts it accepted and the steps it actually ran.

I picked this challenge as the first rule pack. Its FAQ allows one submission per path; its contest rules say entries are unlimited. FinePrint keeps both statements visible and marks the issue **Rules unclear**. It gives me a precise question to take to the organizer.

The review desk checks 19 requirements across entry eligibility, path conditions, prizes and submission readiness. Each check can be Supported, Blocked, Missing fact, Rules unclear or Not applicable. Changing a fact highlights the affected findings. Reports can be saved in the browser and downloaded as Markdown.

## Demo

[Try FinePrint](https://fineprint-kappa.vercel.app) · [Open the review desk](https://fineprint-kappa.vercel.app/review) · [Source code](https://github.com/himanshu748/fineprint)

On the desk, choose **Two entries, one path** and press **Ask FinePrint**. Open the tool trace after the answer, then inspect the source interpretation beside the typed result. Choose **Review these facts below** to apply the extracted facts to the desk.

The homepage replays a dated, recorded source explanation. Its final example lets you change whether an entire application or only its components existed before the event. The origin check changes, while the August development date remains blocked.

Live requests share a limit of five runs per ten minutes in a Vercel regional bucket. The question and any form facts explicitly included with it go to the model provider. They are not written to the public Sanity dataset.

## How I Used Sanity

The public `production` dataset in project `cxbqxkq6` contains one competition, 19 requirements and three source versions. The requirements reference the official FAQ, event rules and general rules. A GROQ query loads the pack, and Zod validates it before the checker uses it.

Sanity Context built Knowledge Base `kbyrY7h8fTnL` from those 23 curated records. The dedicated `fineprint` MCP endpoint exposes nine entries, including `eligibility/development_timing`, `entry_limits_and_prizes` and `source_authority`. The app uses a server-side Context Viewer token.

For a question, the agent follows this sequence:

1. Call `initial_context` to get the Knowledge Base outline.
2. Select relevant paths and call `knowledge_base_read`. The server validates each path against the outline before reading it.
3. Call `check_requirements` with quoted project facts and an independent interpretation of the relevant rules.
4. Validate those proposals and run the typed conditions. Return the model’s interpretation alongside the checker’s result, including disagreements.
5. Write the answer and cite retrieved entry paths. The question flow removes and discloses citation paths that were never read, and rejects an answer if no valid citations remain.

The question flow allows four model rounds, six entry reads and 45,000 source characters. The trace shows the actual calls and elapsed times. A provider error produces an error state with the completed steps.

The Knowledge Base currently uses curated dataset records. The September 20 source capture remains visible; loading those records live does not imply that the official websites have been refreshed.

## What the live runs showed

In a September 22 local run against the real Sanity and Modal services, the August question completed in 12.8 seconds. The agent read four entries and accepted three quoted facts. The date remained a month, with the inferred challenge year disclosed. It refused to treat “started in August” as proof that the whole application already existed. The model still interpreted the prior-work rule as blocked, while the typed check needed that missing fact. Both results were visible.

A second run took 11.4 seconds and read three entries. For “I am planning two entries in Path One,” both the source interpretation and the typed checker kept the submission limit unclear.

After deployment, the same question ran in a browser without an access code in 6.4 seconds. Its trace showed eight actual steps, including three Knowledge Base reads and the requirement check. A separate hosted check verified that the per-finding explanation still worked.

Those runs test particular questions. They do not establish general eligibility accuracy.

## Code and checks

FinePrint uses Next.js, TypeScript, Zod, Sanity Content Lake and Context MCP. DeepSeek V4.1 Flash runs on an existing Modal endpoint. Vercel hosts the app.

Start with [`question-agent.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-agent.ts) for the tool loop, [`question-facts.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-facts.ts) for quote validation and [`engine.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/engine.ts) for the checks.

The automated suite has 131 passing tests, plus a type check, production build and seven production smoke checks. The engine matches 42 authored regression scenarios. A recorded model baseline, given all nine Knowledge Base entries, matches 39 of those labels. I wrote the fixtures and the rule pack; that comparison measures agreement with my labels, not independent accuracy or retrieval quality.

## Working with coding agents

I started with a broader pitch for a pre-submission checking agent, then chose “Revise the concept together before building.” My next instruction was “uncertain eligibility.” That narrowed the project to one event and a concrete applicability problem.

Codex built the first version. I chose Modal when it asked for a model provider, approved a public rules dataset and connected a read-only Context token. I initially asked for a Three.js landing page. After reviewing it, I chose Claude’s product-focused replacement without 3D, along with a public question flow and visible tool calls. Claude stopped at its session limit partway through that upgrade. Codex recovered the unfinished work and continued it.

The hardest boundary is deciding what a person actually stated. An English question does not establish an English submission; planning an integration does not establish a working integration. FinePrint rejects several such shortcuts, keeps unknown facts visible and lets the person inspect the quoted facts before applying them to the desk.
