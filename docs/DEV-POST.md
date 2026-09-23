---
title: "Five people, two hackathons: building FinePrint with Sanity"
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*Prepared for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

I tested the same five-person team and August 23 start date against two hackathons. Sanity blocked both checks. GIBC V2 supported both. The rest of the review still had unanswered questions.

Those are illustrative project facts, checked against the two events’ curated official rules. They make the problem concrete: choosing another event can change the answer even when the project stays the same.

FinePrint starts with the part I’m unsure about. I can ask, “I started my app in August. I added Sanity this week. Can I enter Path One?” The agent reads a Sanity Knowledge Base, proposes facts with exact quotes from my question, then calls a typed checker. The answer shows its sources, the facts it accepted and the steps it actually ran.

I picked this challenge as the first rule pack. Its FAQ allows one submission per path; its contest rules say entries are unlimited. FinePrint keeps both statements visible and marks the issue **Rules unclear**. It gives me a precise question to take to the organizer.

I added GIBC V2’s Open Invention track as a second curated event. FinePrint checks 19 Sanity requirements and 18 GIBC requirements. **Compare events** carries team size and development date across both, while leaving event-specific answers unknown. An answer about what existed before September 18 cannot establish what existed before July 11. Each check can be Supported, Blocked, Missing fact, Rules unclear or Not applicable. Changing a fact highlights the affected findings. Personal reviews autosave in the browser and can be downloaded as Markdown. A facts-only backup moves work between browsers without importing an unverified verdict.

Saved reports retain the requirements and sources used at check time. When a new curated pack is published, FinePrint identifies added, removed or changed requirements and follows source references to the affected findings. A capture-date refresh alone does not pretend that a condition changed. This checks curated Sanity records; it does not monitor organizer websites.

## Demo

[Try FinePrint](https://fineprint-kappa.vercel.app) · [Open the review desk](https://fineprint-kappa.vercel.app/review) · [Source code](https://github.com/himanshu748/fineprint)

![FinePrint compares an illustrative five-person project against the Sanity and GIBC rule packs. Team size and the August start date are blocked for Sanity and supported for GIBC.](https://fineprint-kappa.vercel.app/docs/event-comparison.png)

*Browser capture from September 22. The example also declares that every member is a student. Both reviews retain unanswered questions.*

Create a Sanity review, enter a team size of five and a development date of August 23, 2026, then open **Compare events**. Both checks are blocked for Sanity and supported for GIBC. GIBC still needs answers to its other requirements. Create a separate GIBC review to continue.

Open **Try a rule-change rehearsal** to lower a hypothetical team limit from six to three. One of the eighteen checks is affected. The rehearsal is labeled and local; it never changes an official source or saved review.

For the source agent, expand **Ask a question about the rules**, choose **Two entries, one path** in a Sanity review and press **Ask FinePrint**. Inspect the actual trace and the source interpretation beside the typed result. **Add these facts to my review** preserves the other answers.

The homepage replays a dated, recorded source explanation. Another example lets you change whether an entire application or only its components existed before the event. The origin check changes, while the August development date remains blocked.

The landing page includes the four recorded comparison runs. Switch between team size and development date, then expand a source read to see which Sanity Knowledge Base entry and structured records were used. The GIBC date example keeps the model disagreement visible.

Live requests share a limit of five runs per ten minutes in a Vercel regional bucket. The question and any form facts explicitly included with it go to the model provider. They are not written to the public Sanity dataset.

## How I Used Sanity

The public `production` dataset in project `cxbqxkq6` contains two competitions, 37 requirements and five source versions. Each requirement references its event’s official sources. Event IDs, pack versions and explicit source references keep identical concepts such as team size separate. A GROQ query loads the pack, and Zod validates it before the checker uses it.

These relationships also make the change review possible. A saved finding records the requirement and source versions it used. If a curator changes the team-size requirement, FinePrint follows those references to the team finding. If only the capture date changes, it leaves the condition unchanged. Sanity holds the content and its relationships; the app uses them for retrieval, comparisons and report updates.

Knowledge Base `kbyrY7h8fTnL` reads the public dataset through the dedicated `fineprint` MCP endpoint. Its purpose now covers Sanity and GIBC Open Invention, with separate event paths, exact rule titles and source versions. The app uses a server-side Context Viewer token. The browser never receives that credential.

For a question, the agent follows this sequence:

1. Call `initial_context` to get the Knowledge Base outline.
2. Select relevant paths and call `knowledge_base_read`. The server validates each path against the outline before reading it.
3. Call `check_requirements` with quoted project facts and an independent interpretation of the relevant rules.
4. Validate those proposals and run the typed conditions. Return the model’s interpretation alongside the checker’s result, including disagreements.
5. Write the answer and cite retrieved entry paths. The question flow removes and discloses citation paths that were never read, and rejects an answer if no valid citations remain.

The question flow allows four model rounds, six entry reads and 45,000 source characters. The trace shows the actual calls and elapsed times. A provider error produces an error state with the completed steps.

The Knowledge Base currently uses curated dataset records. The September 20 Sanity capture and September 22 GIBC capture remain visible; loading those records live does not imply that the official websites have been refreshed.

## What the live runs showed

The two-event test made four real calls to Sanity Context and Modal: team size and development date, once for each event. All four typed checks matched my authored labels. The model agreed on three. Every answer cited a relevant retrieved entry, and the calls took 9.2–14.9 seconds.

On the fourth question, the model asked for a timezone even though August 23 was well inside GIBC’s July-to-October build window. It called the result unclear; the typed checker supported the supplied date. FinePrint kept the disagreement visible. That is a failure I want to inspect before relying on the explanation.

The [recorded questions, answers and tool traces](https://github.com/himanshu748/fineprint/blob/main/evaluation/multi-event-context.json) include that disagreement. Four questions are a small integration check, not an accuracy study.

In a September 22 local run against the real Sanity and Modal services, the August question completed in 12.8 seconds. The agent read four entries and accepted three quoted facts. The date remained a month, with the inferred challenge year disclosed. It refused to treat “started in August” as proof that the whole application already existed. The model still interpreted the prior-work rule as blocked, while the typed check needed that missing fact. Both results were visible.

A second run took 11.4 seconds and read three entries. For “I am planning two entries in Path One,” both the source interpretation and the typed checker kept the submission limit unclear.

After deployment, the same question ran in a browser without an access code in 6.4 seconds. Its trace showed eight actual steps, including three Knowledge Base reads and the requirement check. A separate hosted check verified that the per-finding explanation still worked.

Those runs test particular questions. They do not establish general eligibility accuracy.

## Code and checks

FinePrint uses Next.js, TypeScript, Zod, Sanity Content Lake and Context MCP. DeepSeek V4.1 Flash runs on an existing Modal endpoint. Vercel hosts the app.

Start with [`question-agent.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-agent.ts) for the tool loop, [`question-facts.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-facts.ts) for quote validation and [`engine.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/engine.ts) for the checks.

The automated suite includes migration of older reviews, event isolation, unknown facts, changed source dependencies, added and removed rules, deadline changes and bounded API requests. Production smoke checks also exercise anonymous comparisons with cloud providers disabled. The engine matches 42 authored regression scenarios. An earlier recorded model baseline, given the nine Knowledge Base entries that existed at that time, matches 39 of those labels. I wrote the fixtures and the rule pack; that comparison measures agreement with my labels, not independent accuracy or retrieval quality.

## Working with coding agents

I started with a broader pitch for a pre-submission checking agent, then chose “Revise the concept together before building.” My next instruction was “uncertain eligibility.” That narrowed the project to one event and a concrete applicability problem.

Codex built the first version. I chose Modal when it asked for a model provider, approved a public rules dataset and connected a read-only Context token. I initially asked for a Three.js landing page. After reviewing it, I chose Claude’s product-focused replacement without 3D, along with a public question flow and visible tool calls. Claude stopped at its session limit partway through that upgrade. Codex recovered the unfinished work and continued it.

I then asked for a product people could keep using and chose multi-event comparison plus rule-change impact. That introduced another boundary: a project fact can travel between events, but a declaration about an event’s requirements usually cannot.

The hardest boundary is deciding what a person stated. An English question does not establish an English submission; planning an integration does not establish a working integration. FinePrint rejects several such shortcuts, keeps unknown facts visible and lets the person inspect the quoted facts before applying them to the desk.
