---
title: "FinePrint: an agent that checks your hackathon entry against the rules it reads"
published: false
description: "Check your entry against the hackathon rules. The agent reads a Sanity Knowledge Base, quotes the facts it took from your question and runs typed rule checks, with every step visible."
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

FinePrint checks a hackathon entry before you submit it. Ask, "I am planning two entries in Path One," and it reads a Sanity Knowledge Base, quotes the fact it took from your question and checks it against the event's structured rules. You can inspect the source reads, the accepted facts and the condition that produced **Blocked**.

[Try FinePrint](https://fineprint-kappa.vercel.app) · [Open the guided demo](https://fineprint-kappa.vercel.app/demo) · [Watch the 65-second demo](https://youtu.be/Vy0qynByqZ4) · [Source code](https://github.com/himanshu748/fineprint)

Hackathon rules live in three places: the challenge page, the FAQ and the official contest rules. They don't always agree, and one missed line can disqualify a good project. I wanted an answer I could check, including the cases where the answer is "I still need a fact" or "these sources disagree."

Each Sanity requirement has a condition, an event and a reference to the dated source version it came from. That lets FinePrint evaluate your facts, keep uncertainty visible and show which finding needs another check when a rule changes. The model proposes facts and explains the sources; the typed checker evaluates the conditions.

I picked this challenge as the first rule pack, and it changed under me. On September 20 the FAQ limited entries to one per path while the contest rules allowed unlimited entries. FinePrint marked two entries in one path **Rules unclear** and gave a question for the organizer. By September 24 DEV had changed the contest rules to "Only one submission per path is allowed." I published a new rule pack, `2026-09-24.1`, and a saved two-entry review now shows the check going from Rules unclear to **Blocked**, with both dated quotes. The old pack stays in Sanity, so the change remains visible.

I added GIBC V2’s Open Invention track as a second curated event. FinePrint checks 19 Sanity requirements and 18 GIBC requirements. **Compare events** carries team size and development date across both, while leaving event-specific answers unknown. An answer about what existed before September 18 cannot establish what existed before July 11. Each check can be Supported, Blocked, Missing fact, Rules unclear or Not applicable. Changing a fact highlights the affected findings. Personal reviews autosave in the browser and can be downloaded as Markdown. A facts-only backup moves work between browsers without importing an unverified verdict.

Two curated events don't cover the hackathon you're entering next, so FinePrint can also import a public rules page. Paste its link and the model proposes requirements. Every requirement must quote the page word for word, or it is dropped and listed. FinePrint maps each quote onto its fixed fact vocabulary (team size, age, build window, entries and so on) and builds the typed condition itself. Anything it can't map, or any number the quote doesn't contain, becomes a **Check yourself** rule that can never show as Supported. Imported events are labeled "Imported from zero-origin.devpost.com, not reviewed" (with the real host) and stay in your browser, never in the Sanity dataset.

Saved reports retain the requirements and sources used at check time. When a new curated pack is published, FinePrint identifies added, removed or changed requirements and follows source references to the affected findings. A capture-date refresh alone does not pretend that a condition changed. This checks curated Sanity records; it does not monitor organizer websites.

## Demo

Start with the [guided demo](https://fineprint-kappa.vercel.app/demo). It follows **Two entries, one path** without spending the live-agent allowance and labels its recorded evidence.

For a live run, [open the review desk](https://fineprint-kappa.vercel.app/review), create a Sanity review and use **Ask FinePrint** at the top:

1. Choose **Two entries, one path** and press **Ask FinePrint**.
2. Expand the trace to see `initial_context`, the Knowledge Base reads and `check_requirements`.
3. Inspect the quoted fact, the cited September 24 entry-limit rule and the typed **Blocked** finding. **Add these facts to my review** preserves your other answers and notes.

The manual review desk remains available if the shared live-agent allowance is busy. Sample and recorded runs are labeled; they do not start a live model request.

A 65-second run on the deployed app, recorded September 25 with nothing sped up: the dated rule change, the agent answering a two-entries question through Sanity Context and an imported Devpost rules page.

{% embed https://www.youtube.com/watch?v=Vy0qynByqZ4 %}

![FinePrint compares an illustrative five-person project against the Sanity and GIBC rule packs. Team size and the August start date are blocked for Sanity and supported for GIBC.](https://fineprint-kappa.vercel.app/docs/event-comparison.png)

*Browser capture from September 22. The example also declares that every member is a student. Both reviews retain unanswered questions.*

Create a Sanity review, enter a team size of five and a development date of August 23, 2026, then open **Compare events**. Both checks are blocked for Sanity and supported for GIBC. GIBC still needs answers to its other requirements. Create a separate GIBC review to continue.

Open **Try a rule-change rehearsal** to lower a hypothetical team limit from six to three. One of the eighteen checks is affected. The rehearsal is labeled and local; it never changes an official source or saved review.

To check another event, start a review and pick **Another hackathon (paste its rules link)**. Try `https://zero-origin.devpost.com/rules`, then press **Read the rules**. You get a review of that event's requirements, with the ones FinePrint could not map listed as Check yourself. **Ask FinePrint** works on it too.

The homepage replays a dated, recorded source explanation. Another example lets you change whether an entire application or only its components existed before the event. The origin check changes, while the August development date remains blocked.

The landing page includes the four recorded comparison runs. Switch between team size and development date, then expand a source read to see which Sanity Knowledge Base entry and structured records were used. The GIBC date example keeps the model disagreement visible.

Live requests share a five-run allowance per ten minutes in a Vercel regional bucket, with additional checks that can limit repeated requests from the same network. The question and any form facts explicitly included with it go to the model provider. Personal reviews stay out of the public Sanity dataset.

## Code

FinePrint uses Next.js, TypeScript, Zod, Sanity Content Lake and Context MCP. DeepSeek V4.1 Flash runs on an existing Modal endpoint. Vercel hosts the app.

Start with [`question-agent.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-agent.ts) for the tool loop, [`question-facts.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-facts.ts) for quote validation and [`engine.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/engine.ts) for the checks.

The automated suite includes migration of older reviews, event isolation, unknown facts, changed source dependencies, added and removed rules, deadline changes and bounded API requests. Production smoke checks also exercise anonymous comparisons with cloud providers disabled. The engine matches 42 authored regression scenarios. An earlier recorded model baseline, given the nine Knowledge Base entries that existed at that time, matches 39 of those labels. I wrote the fixtures and the rule pack; that comparison measures agreement with my labels, not independent accuracy or retrieval quality.

## How I Used Sanity

The public `production` dataset in project `cxbqxkq6` contains two competitions whose current packs hold 37 requirements, plus the dated source versions each pack quotes. Superseded packs stay in the dataset. Each requirement references its event’s official sources. Event IDs, pack versions and explicit source references keep identical concepts such as team size separate. A GROQ query loads the pack, and Zod validates it before the checker uses it.

The content model is small enough to inspect:

```text
Competition → versioned Requirement → dated SourceVersion
Knowledge Base → Context reads → quoted project facts
Validated facts + Requirement conditions → typed findings
```

The requirement and its source are records that the agent retrieves and the checker uses. These relationships also make the change review possible. A saved finding records the requirement and source versions it used. If a curator changes the team-size requirement, FinePrint follows those references to the team finding. If only the capture date changes, it leaves the condition unchanged. Sanity holds the content and its relationships; the app uses them for retrieval, comparisons and report updates.

Knowledge Base `kbyrY7h8fTnL` reads the public dataset through the dedicated `fineprint` MCP endpoint. Its purpose now covers Sanity and GIBC Open Invention, with separate event paths, exact rule titles and source versions. The app uses a server-side Context Viewer token. The browser never receives that credential.

For a question, the agent follows this sequence:

1. Call `initial_context` to get the Knowledge Base outline.
2. Select relevant paths and call `knowledge_base_read`. The server validates each path against the outline before reading it.
3. Call `check_requirements` with quoted project facts and an independent interpretation of the relevant rules.
4. Validate those proposals and run the typed conditions. Return the model’s interpretation alongside the checker’s result, including disagreements.
5. Write the answer and cite retrieved entry paths. The question flow removes and discloses citation paths that were never read, and rejects an answer if no valid citations remain.

![A live run on the deployed app: the agent reads the Sanity Context outline, three Knowledge Base entries and the structured requirements, then answers Blocked for two Path One entries with both its reading and the rule check shown](https://fineprint-kappa.vercel.app/docs/agent-trace.png)

*Live run on the deployed app, September 28: 5.7 seconds, eight recorded steps.*

The question flow allows four model rounds, six entry reads and 45,000 source characters. The trace shows the actual calls and elapsed times. A provider error produces an error state with the completed steps.

The Knowledge Base has four sources. The first is the curated FinePrint `production` dataset, filtered to the current rule packs. The other three are DEV pages added as website sources: the [challenge page](https://dev.to/challenges/sanity-2026-09-16), the [Sanity contest rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules) and the [official hackathon rules](https://dev.to/page/official-hackathon-rules). When those sources were added, Context raised two conflicts. One was mine: an entry said development had to start after the opening moment, while the rules say "during, and not prior to, the Entry Period" and the checker accepts the opening moment. I resolved it in favor of the source. The other was the entry limit. The contest rules page Context crawled that day already said one submission per path, while my September 20 dataset record still quoted "no limit". Context flagged the stale record before I had noticed the change myself. I resolved it in favor of the live page, added a standing instruction that dates the old wording as a rule change and published the new pack.

For an imported event, the agent still reads the Knowledge Base for how FinePrint weighs sources, and uses a separate `imported_rules_read` tool over the quoted requirements. The trace names both, and citations are limited to what was actually read in that run.

## What the live runs showed

The September 29 production check asked about a five-person team entering Path One. The agent read the Knowledge Base, accepted the quoted team-size fact and returned the correct **Blocked** finding. Its nine-step trace completed in about 6.3 seconds. A separate cited explanation completed in about 6.0 seconds, and a third request from the same network in that window returned the rate-limit message without starting a model call. The release passed 345 automated tests, the production build and 13 checks with providers disabled. Those checks cover different boundaries; a passing local test alone does not establish a working hosted agent.

The latest guided-demo browser check also ran the optional live question. It completed in 8.3 seconds with nine recorded steps and four retrieved entries, and the entry-limit requirement appeared beside its quoted fact and Blocked finding. The guided sequence separately showed Rules unclear, Blocked and Supported for that selected requirement. Desktop and 390-pixel browser checks passed; the demonstration kept personal saved reviews untouched.

The following earlier runs preserve the disagreements and importer failures that shaped the current implementation.

The two-event test made four real calls to Sanity Context and Modal: team size and development date, once for each event. All four typed checks matched my authored labels. The model agreed on three. Every answer cited a relevant retrieved entry, and the calls took 9.2 to 14.9 seconds.

On the fourth question, the model asked for a timezone even though August 23 was well inside GIBC’s July-to-October build window. It called the result unclear; the typed checker supported the supplied date. FinePrint kept the disagreement visible. That is a failure I want to inspect before relying on the explanation.

The [recorded questions, answers and tool traces](https://github.com/himanshu748/fineprint/blob/main/evaluation/multi-event-context.json) include that disagreement. Four questions are a small integration check, not an accuracy study.

In a September 22 local run against the real Sanity and Modal services, the August question completed in 12.8 seconds. The agent read four entries and accepted three quoted facts. The date remained a month, with the inferred challenge year disclosed. It refused to treat “started in August” as proof that the whole application already existed. The model still interpreted the prior-work rule as blocked, while the typed check needed that missing fact. Both results were visible.

A second run took 11.4 seconds and read three entries. For “I am planning two entries in Path One,” both the source interpretation and the typed checker kept the submission limit unclear. That was correct against the September 20 rules; against the September 24 pack the same question is Blocked.

After deployment, the same question ran in a browser without an access code in 6.4 seconds. Its trace showed eight actual steps, including three Knowledge Base reads and the requirement check. A separate hosted check verified that the per-finding explanation still worked.

I tested the importer on three real pages on September 24, before the stricter September 29 guards. These are historical counts, not a remeasurement of the current importer:

| Page | Rules found | Mapped to a check | Check yourself | Quotes dropped |
| --- | --- | --- | --- | --- |
| Zero Origin (Devpost rules) | 18 | 4 | 14 | 0 |
| This challenge's DEV page | 16 | 8 | 8 | 0 |
| A lablab.ai event plus its guidelines page | 9 | 2 | 7 | 0 |

The first runs mapped too loosely. "AI tools are permitted" became "AI use disclosed", and a start date quoted without a timezone came out nine hours early. I added two deterministic guards: a date quote must name a timezone, and a quote must contain words for the requirement it's mapped to. Those guards are why most rules end up as Check yourself. On production, the Zero Origin import took 4.3 seconds. In a local run against the real Sanity and Modal services, a question on that imported review ("We are a team of five and the youngest of us is 16") took three model rounds and 18.5 seconds, and team size came out Blocked from both the agent and the checker.

The September 29 audit tightened the same boundary. A numeric rule must state the bound and its direction. A retained date must match the full quoted calendar date, time and timezone. Optional wording cannot become a mandatory requirement, and a denial elsewhere in a sentence cannot turn an affirmative project fact into a false one. Ambiguous claims stay unresolved. Questions on imported events prefer the server's cached rules; when only browser-supplied quotes are available, the answer says they have not been rechecked against the website.

The importer's limits are real. Pages that render their rules with JavaScript expose little text, so a lablab event page gives about 1,000 characters and you need to add its rules page. The model's mappings aren't reviewed and vary between runs; the labels and quote checks keep that visible.

Those runs test particular questions and pages. They do not establish general eligibility accuracy.

## Working with coding agents

I started with a broader pitch for a pre-submission checking agent, then chose “Revise the concept together before building.” My next instruction was “uncertain eligibility.” That narrowed the project to one event and a concrete applicability problem.

Codex built the first version. I chose Modal when it asked for a model provider, approved a public rules dataset and connected a read-only Context token. I initially asked for a Three.js landing page. After reviewing it, I chose Claude’s product-focused replacement without 3D, along with a public question flow and visible tool calls. Claude stopped at its session limit partway through that upgrade. Codex recovered the unfinished work and continued it.

I then asked for a product people could keep using and chose multi-event comparison plus rule-change impact. That introduced another boundary: a project fact can travel between events, but a declaration about an event’s requirements usually cannot.

Another addition was mine to push for: "fineprint should be able to work towards all of the hacks if possible". Claude built the importer, and the live runs above are where its first mappings fell short.

The hardest boundary is deciding what a person stated. An English question does not establish an English submission; planning an integration does not establish a working integration. FinePrint rejects several such shortcuts, keeps unknown facts visible and lets the person inspect the quoted facts before applying them to the desk.

## Sanity Project Details

- Project ID: `cxbqxkq6`, dataset `production` (public, read-only rule records)
- Public dataset query: [competitions with their requirement counts](https://cxbqxkq6.api.sanity.io/v2025-02-19/data/query/production?query=*%5B_type%3D%3D%22competition%22%5D%7Btitle%2C%22requirements%22%3Acount(requirements)%7D)
- Document types: `competition`, `requirement`, `sourceVersion`, `reviewRubric`
- Knowledge Base: `kbyrY7h8fTnL`, served through the named Context MCP endpoint `fineprint`

No login is needed to try FinePrint. Rule checks run without the model. Live answers share a five-run allowance per ten minutes, with additional checks for repeated requests from the same network. A supported finding describes the selected rules and declared facts; the organizer makes the eligibility decision.

## Agent Session

{% agent_session building-fineprint-with-codex-a-rules-agent-over-sanity-context-9s5kte %}
