---
title: "FinePrint: an agent that checks your hackathon entry against the rules it reads"
published: false
description: "Ask whether your project qualifies. The agent reads a Sanity Knowledge Base, quotes the facts it took from your question and runs typed rule checks, with every step visible."
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

Hackathon rules live in three places: the challenge page, the FAQ and the official contest rules. They don't always agree, and one missed line can disqualify a good project.

FinePrint is an agent you can ask. "I started my app in August. I added Sanity this week. Can I enter Path One?" It reads a Sanity Knowledge Base built from the official rules, proposes facts with exact quotes from your question and calls a typed checker over structured requirement records. The answer shows the rules it read, the facts it accepted and every tool call it made.

A keyword search finds the sentence about the entry period. It can't tell you that "started in August" blocks the development-start rule while reusing components is still allowed, or that the contest rules changed their entry limit halfway through the challenge. That needs structure: each requirement is a record with its conditions, its event and a reference to the source version it came from.

I picked this challenge as the first rule pack, and it changed under me. On September 20 the FAQ said "only one submission per path is allowed" while the contest rules said "There is no limit on the number of Entries you may submit during the Entry Period." FinePrint marked two entries in one path **Rules unclear** and gave a question for the organizer. By September 24 DEV had replaced that contest-rules line with "Only one submission per path is allowed. This is to encourage quality over quantity." I published a new rule pack, `2026-09-24.1`, and a saved two-entry review now shows the check going from Rules unclear to **Blocked**, with both dated quotes. The old pack stays in Sanity, so the change is visible, not overwritten.

I added GIBC V2’s Open Invention track as a second curated event. FinePrint checks 19 Sanity requirements and 18 GIBC requirements. **Compare events** carries team size and development date across both, while leaving event-specific answers unknown. An answer about what existed before September 18 cannot establish what existed before July 11. Each check can be Supported, Blocked, Missing fact, Rules unclear or Not applicable. Changing a fact highlights the affected findings. Personal reviews autosave in the browser and can be downloaded as Markdown. A facts-only backup moves work between browsers without importing an unverified verdict.

Two curated events don't cover the hackathon you're entering next, so FinePrint can also read any public rules page. Paste its link and the model proposes requirements. Every requirement must quote the page word for word, or it is dropped and listed. FinePrint maps each quote onto its fixed fact vocabulary (team size, age, build window, entries and so on) and builds the typed condition itself. Anything it can't map, or any number the quote doesn't contain, becomes a **Check yourself** rule that can never show as Supported. Imported events are labeled "Imported from zero-origin.devpost.com, not reviewed" (with the real host) and stay in your browser, never in the Sanity dataset.

Saved reports retain the requirements and sources used at check time. When a new curated pack is published, FinePrint identifies added, removed or changed requirements and follows source references to the affected findings. A capture-date refresh alone does not pretend that a condition changed. This checks curated Sanity records; it does not monitor organizer websites.

## Demo

[Try FinePrint](https://fineprint-kappa.vercel.app) · [Open the review desk](https://fineprint-kappa.vercel.app/review) · [Source code](https://github.com/himanshu748/fineprint)

![FinePrint compares an illustrative five-person project against the Sanity and GIBC rule packs. Team size and the August start date are blocked for Sanity and supported for GIBC.](https://fineprint-kappa.vercel.app/docs/event-comparison.png)

*Browser capture from September 22. The example also declares that every member is a student. Both reviews retain unanswered questions.*

Create a Sanity review, enter a team size of five and a development date of August 23, 2026, then open **Compare events**. Both checks are blocked for Sanity and supported for GIBC. GIBC still needs answers to its other requirements. Create a separate GIBC review to continue.

Open **Try a rule-change rehearsal** to lower a hypothetical team limit from six to three. One of the eighteen checks is affected. The rehearsal is labeled and local; it never changes an official source or saved review.

To try the agent, open any Sanity review. **Ask FinePrint** sits at the top of the desk. Choose **Two entries, one path** and press **Ask FinePrint**; the answer now cites the September 24 rule and the typed check is Blocked. Inspect the actual trace and the source interpretation beside the typed result. **Add these facts to my review** preserves the other answers.

To check another event, start a review and pick **Another hackathon (paste its rules link)**. Try `https://zero-origin.devpost.com/rules`, then press **Read the rules**. You get a review of that event's requirements, with the ones FinePrint could not map listed as Check yourself. **Ask FinePrint** works on it too.

The homepage replays a dated, recorded source explanation. Another example lets you change whether an entire application or only its components existed before the event. The origin check changes, while the August development date remains blocked.

The landing page includes the four recorded comparison runs. Switch between team size and development date, then expand a source read to see which Sanity Knowledge Base entry and structured records were used. The GIBC date example keeps the model disagreement visible.

Live requests share a limit of five runs per ten minutes in a Vercel regional bucket. The question and any form facts explicitly included with it go to the model provider. They are not written to the public Sanity dataset.

## How I Used Sanity

The public `production` dataset in project `cxbqxkq6` contains two competitions whose current packs hold 37 requirements, plus the dated source versions each pack quotes. Superseded packs stay in the dataset. Each requirement references its event’s official sources. Event IDs, pack versions and explicit source references keep identical concepts such as team size separate. A GROQ query loads the pack, and Zod validates it before the checker uses it.

These relationships also make the change review possible. A saved finding records the requirement and source versions it used. If a curator changes the team-size requirement, FinePrint follows those references to the team finding. If only the capture date changes, it leaves the condition unchanged. Sanity holds the content and its relationships; the app uses them for retrieval, comparisons and report updates.

Knowledge Base `kbyrY7h8fTnL` reads the public dataset through the dedicated `fineprint` MCP endpoint. Its purpose now covers Sanity and GIBC Open Invention, with separate event paths, exact rule titles and source versions. The app uses a server-side Context Viewer token. The browser never receives that credential.

For a question, the agent follows this sequence:

1. Call `initial_context` to get the Knowledge Base outline.
2. Select relevant paths and call `knowledge_base_read`. The server validates each path against the outline before reading it.
3. Call `check_requirements` with quoted project facts and an independent interpretation of the relevant rules.
4. Validate those proposals and run the typed conditions. Return the model’s interpretation alongside the checker’s result, including disagreements.
5. Write the answer and cite retrieved entry paths. The question flow removes and discloses citation paths that were never read, and rejects an answer if no valid citations remain.

The question flow allows four model rounds, six entry reads and 45,000 source characters. The trace shows the actual calls and elapsed times. A provider error produces an error state with the completed steps.

The Knowledge Base reads the curated dataset records plus three official pages as website sources: the challenge page, the contest rules and DEV's general hackathon rules. When those sources were added, Context raised two conflicts. One was mine: an entry said development had to start after the opening moment, while the rules say "during, and not prior to, the Entry Period" and the checker accepts the opening moment. I resolved it in favor of the source. The other was the entry limit. The contest rules page Context crawled that day already said one submission per path, while my September 20 dataset record still quoted "no limit". Context flagged the stale record before I had noticed the change myself. I resolved it in favor of the live page, added a standing instruction that dates the old wording as a rule change and published the new pack.

For an imported event, the agent still reads the Knowledge Base for how FinePrint weighs sources, and uses a separate `imported_rules_read` tool over the quoted requirements. The trace names both, and citations are limited to what was actually read in that run.

## What the live runs showed

The two-event test made four real calls to Sanity Context and Modal: team size and development date, once for each event. All four typed checks matched my authored labels. The model agreed on three. Every answer cited a relevant retrieved entry, and the calls took 9.2 to 14.9 seconds.

On the fourth question, the model asked for a timezone even though August 23 was well inside GIBC’s July-to-October build window. It called the result unclear; the typed checker supported the supplied date. FinePrint kept the disagreement visible. That is a failure I want to inspect before relying on the explanation.

The [recorded questions, answers and tool traces](https://github.com/himanshu748/fineprint/blob/main/evaluation/multi-event-context.json) include that disagreement. Four questions are a small integration check, not an accuracy study.

In a September 22 local run against the real Sanity and Modal services, the August question completed in 12.8 seconds. The agent read four entries and accepted three quoted facts. The date remained a month, with the inferred challenge year disclosed. It refused to treat “started in August” as proof that the whole application already existed. The model still interpreted the prior-work rule as blocked, while the typed check needed that missing fact. Both results were visible.

A second run took 11.4 seconds and read three entries. For “I am planning two entries in Path One,” both the source interpretation and the typed checker kept the submission limit unclear. That was correct against the September 20 rules; against the September 24 pack the same question is Blocked.

After deployment, the same question ran in a browser without an access code in 6.4 seconds. Its trace showed eight actual steps, including three Knowledge Base reads and the requirement check. A separate hosted check verified that the per-finding explanation still worked.

I tested the importer on three real pages:

| Page | Rules found | Mapped to a check | Check yourself | Quotes dropped |
| --- | --- | --- | --- | --- |
| Zero Origin (Devpost rules) | 18 | 4 | 14 | 0 |
| This challenge's DEV page | 16 | 8 | 8 | 0 |
| A lablab.ai event plus its guidelines page | 9 | 2 | 7 | 0 |

The first runs mapped too loosely. "AI tools are permitted" became "AI use disclosed", and a start date quoted without a timezone came out nine hours early. I added two deterministic guards: a date quote must name a timezone, and a quote must contain words for the requirement it's mapped to. Those guards are why most rules end up as Check yourself. On production, the Zero Origin import took 4.3 seconds. In a local run against the real Sanity and Modal services, a question on that imported review ("We are a team of five and the youngest of us is 16") took three model rounds and 18.5 seconds, and team size came out Blocked from both the agent and the checker.

The importer's limits are real. Pages that render their rules with JavaScript expose little text, so a lablab event page gives about 1,000 characters and you need to add its rules page. The model's mappings aren't reviewed and vary between runs; the labels and quote checks keep that visible.

Those runs test particular questions and pages. They do not establish general eligibility accuracy.

## Code

FinePrint uses Next.js, TypeScript, Zod, Sanity Content Lake and Context MCP. DeepSeek V4.1 Flash runs on an existing Modal endpoint. Vercel hosts the app.

Start with [`question-agent.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-agent.ts) for the tool loop, [`question-facts.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-facts.ts) for quote validation and [`engine.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/engine.ts) for the checks.

The automated suite includes migration of older reviews, event isolation, unknown facts, changed source dependencies, added and removed rules, deadline changes and bounded API requests. Production smoke checks also exercise anonymous comparisons with cloud providers disabled. The engine matches 42 authored regression scenarios. An earlier recorded model baseline, given the nine Knowledge Base entries that existed at that time, matches 39 of those labels. I wrote the fixtures and the rule pack; that comparison measures agreement with my labels, not independent accuracy or retrieval quality.

## Working with coding agents

I started with a broader pitch for a pre-submission checking agent, then chose “Revise the concept together before building.” My next instruction was “uncertain eligibility.” That narrowed the project to one event and a concrete applicability problem.

Codex built the first version. I chose Modal when it asked for a model provider, approved a public rules dataset and connected a read-only Context token. I initially asked for a Three.js landing page. After reviewing it, I chose Claude’s product-focused replacement without 3D, along with a public question flow and visible tool calls. Claude stopped at its session limit partway through that upgrade. Codex recovered the unfinished work and continued it.

I then asked for a product people could keep using and chose multi-event comparison plus rule-change impact. That introduced another boundary: a project fact can travel between events, but a declaration about an event’s requirements usually cannot.

The last addition was mine to push for: "fineprint should be able to work towards all of the hacks if possible". Claude built the importer, and the live runs above are where its first mappings fell short.

The hardest boundary is deciding what a person stated. An English question does not establish an English submission; planning an integration does not establish a working integration. FinePrint rejects several such shortcuts, keeps unknown facts visible and lets the person inspect the quoted facts before applying them to the desk.

## Sanity Project Details

- Project ID: `cxbqxkq6`, dataset `production` (public, read-only rule records)
- Public dataset query: [competitions with their requirement counts](https://cxbqxkq6.api.sanity.io/v2025-02-19/data/query/production?query=*%5B_type%3D%3D%22competition%22%5D%7Btitle%2C%22requirements%22%3Acount(requirements)%7D)
- Document types: `competition`, `requirement`, `sourceVersion`, `reviewRubric`
- Knowledge Base: `kbyrY7h8fTnL`, served through the named Context MCP endpoint `fineprint`

No login is needed to try FinePrint. Rule checks run without the model; live agent answers share a limit of five runs per ten minutes.
