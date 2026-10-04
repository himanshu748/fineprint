---
title: "FinePrint: an agent that checks your hackathon entry against the rules it reads"
published: true
description: "Check your entry against the hackathon rules. The agent reads a Sanity Knowledge Base, quotes the facts it took from your question and runs typed rule checks, with every step visible."
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

FinePrint checks a saved hackathon entry as the rules and your project facts change. When this challenge changed its entry-limit wording, the same two-entry plan went from **Rules unclear** to **Blocked**. The review keeps the old and new dated sources and identifies the finding that needs rechecking.

Sanity Context caught the rule change before I noticed it. After I added the official DEV pages to the Knowledge Base, Context flagged my September 20 "no limit" record against the revised one-submission-per-path wording. I reviewed the conflict, resolved it in favor of the live contest page and published the September 24 pack. Content Lake keeps both dated versions and their linked requirements, so FinePrint can trace the source change to a saved finding and recheck the same project facts.

Ask, “I am planning two entries in Path One.” The agent reads the Knowledge Base, quotes your fact and runs the typed check, showing the source reads and condition.

[Try FinePrint](https://fineprint-kappa.vercel.app) · [Open the guided demo](https://fineprint-kappa.vercel.app/demo) · [Watch the 65-second demo](https://youtu.be/Vy0qynByqZ4) · [Source code](https://github.com/himanshu748/fineprint)

The challenge page, FAQ and contest rules can disagree. I wanted an answer I could check, including “I still need a fact” and “these sources disagree.”

Each requirement links an event, a typed condition and a dated source. The model proposes facts and explains sources; the checker evaluates conditions. On September 20 the FAQ limited entries to one per path while the contest rules allowed unlimited entries. FinePrint returned Rules unclear and a question for the organizer. The September 24 pack, `2026-09-24.1`, keeps both dated quotes and makes the same two-entry declaration Blocked.

GIBC V2’s Open Invention track is the second curated event, with 18 requirements alongside Sanity’s 19. **Compare events** carries team size and development date across both, leaving event-specific answers unknown: what existed before September 18 cannot establish what existed before July 11. Findings can be Supported, Blocked, Missing fact, Rules unclear or Not applicable. Reviews autosave in the browser and export as Markdown; a facts-only backup moves answers between browsers without importing a verdict.

You can also import a public rules page. The model proposes requirements, but each must quote the page word for word or be dropped and listed. FinePrint maps quotes onto a fixed fact vocabulary and builds the conditions itself. Unmapped rules and numbers absent from the quote become **Check yourself**, which can never show as Supported. Imports carry the real host and an “unreviewed” label, and stay in your browser.

For your own code, [review a public GitHub repository](https://fineprint-kappa.vercel.app/repository) against three curated judging rubrics: Sanity Path One, Path Two or GIBC Open Invention. FinePrint fixes the review to the current default-branch commit, reads up to ten files and 60,000 characters of selected text, and checks citations against inspected lines. Selected public code goes to Modal, never the public Sanity dataset. It runs no code and gives evidence, gaps and next steps; runtime behavior and judging scores remain outside this review.

Saved reports retain their requirements and sources. New curated packs identify added, removed or changed rules and affected findings. Capture-date refreshes alone do not change conditions. FinePrint checks curated Sanity records; it does not monitor organizer websites.

## Demo

Start with the [guided demo](https://fineprint-kappa.vercel.app/demo). It follows **Two entries, one path** without spending the live-agent allowance and labels its recorded evidence.

Inspect the entry-limit requirement through three states:

| Selected rules and declared fact | Entry-limit finding |
| --- | --- |
| September 20 pack; two entries in Path One | Rules unclear: the FAQ and contest rules disagree |
| September 24 pack; the same two entries | Blocked: one entry per path is now stated in both sources |
| September 24 pack; change the declaration to one entry | Supported for this requirement; any other requirements with missing facts stay visible |

The dated packs are stored in Sanity. The guide replays this sequence locally; its optional live question makes a fresh Context and model request. Changing the declaration does not edit either rule pack or certify the whole submission.

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

The homepage labels its recorded source explanation and four comparison runs. Expand their source reads to inspect the Knowledge Base entries and structured records. The GIBC date example preserves a model/checker disagreement; the prior-work example lets you change whether an application or only its components existed before the event.

Live requests share a five-run allowance per ten minutes in a Vercel regional bucket, with additional checks that can limit repeated requests from the same network. The question and any form facts explicitly included with it go to the model provider. Personal reviews stay out of the public Sanity dataset.

## Code

FinePrint uses Next.js, TypeScript, Zod, Sanity Content Lake and Context MCP. DeepSeek V4.1 Flash runs on an existing Modal endpoint. Vercel hosts the app.

Start with [`question-agent.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-agent.ts) for the tool loop, [`question-facts.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/question-facts.ts) for quote validation and [`engine.ts`](https://github.com/himanshu748/fineprint/blob/main/src/lib/engine.ts) for the checks.

Tests cover review migration, event isolation, unknown facts, source changes, rule additions/removals, deadlines and bounded requests. The engine matches 42 authored scenarios; an earlier model baseline given the then-current nine Knowledge Base entries matches 39. I authored the labels and pack, so this measures agreement, not independent accuracy or retrieval quality.

## How I Used Sanity

The public `production` dataset in project `cxbqxkq6` contains two competitions whose current packs hold 37 requirements, plus the dated source versions each pack quotes. Superseded packs stay in the dataset. Each requirement references its event’s official sources. Event IDs, pack versions and explicit source references keep identical concepts such as team size separate. A GROQ query loads the pack, and Zod validates it before the checker uses it.

The content model:

```text
Competition → versioned Requirement → dated SourceVersion
Knowledge Base → Context reads → quoted project facts
Validated facts + Requirement conditions → typed findings
```

A saved finding records its requirement and source versions. Changing a team-size requirement identifies the team finding for review; refreshing a capture date leaves the condition unchanged. Content Lake supplies the records and relationships used for retrieval, comparisons and report updates.

Knowledge Base `kbyrY7h8fTnL` reads the public dataset through the dedicated `fineprint` MCP endpoint. Its purpose now covers Sanity and GIBC Open Invention, with separate event paths, exact rule titles and source versions. The app uses a server-side Context Viewer token. The browser never receives that credential.

For each question:

1. Call `initial_context` to get the Knowledge Base outline.
2. Select relevant paths and call `knowledge_base_read`. The server validates each path against the outline before reading it.
3. Call `check_requirements` with quoted project facts and an independent interpretation of the relevant rules.
4. Validate those proposals and run the typed conditions. Return the model’s interpretation alongside the checker’s result, including disagreements.
5. Write the answer and cite retrieved entry paths. The question flow removes and discloses citation paths that were never read, and rejects an answer if no valid citations remain.

![A live run on the deployed app: the agent reads the Sanity Context outline, three Knowledge Base entries and the structured requirements, then answers Blocked for two Path One entries with both its reading and the rule check shown](https://fineprint-kappa.vercel.app/docs/agent-trace.png)

*Live run on the deployed app, September 28: 5.7 seconds, eight recorded steps.*

The question flow allows four model rounds, six entry reads and 45,000 source characters. The trace shows the actual calls and elapsed times. A provider error produces an error state with the completed steps.

The Knowledge Base reads four sources: the current curated `production` packs and three website sources, the [challenge page](https://dev.to/challenges/sanity-2026-09-16), [Sanity contest rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules) and [official hackathon rules](https://dev.to/page/official-hackathon-rules). Adding those pages exposed the stale entry-limit record described above. Context also flagged my “after the opening moment” wording against “during, and not prior to, the Entry Period”; the checker accepts the opening moment. I resolved both conflicts against the official sources and added a standing instruction dating the old entry-limit wording as a rule change.

For an imported event, the agent still reads the Knowledge Base for how FinePrint weighs sources, and uses a separate `imported_rules_read` tool over the quoted requirements. The trace names both, and citations are limited to what was actually read in that run.

## What the live runs showed

The September 29 production check asked about a five-person team entering Path One. The agent read the Knowledge Base, accepted the quoted team-size fact and returned the correct **Blocked** finding. Its nine-step trace completed in about 6.3 seconds. A separate cited explanation completed in about 6.0 seconds, and a third request from the same network in that window returned the rate-limit message without starting a model call. The release passed 345 automated tests, the production build and 13 checks with providers disabled. Those checks cover different boundaries; a passing local test alone does not establish a working hosted agent.

The guided-demo browser check showed the three entry-limit states and completed its optional live question in 8.3 seconds: nine steps, four retrieved entries, the quoted fact and Blocked finding. Desktop and 390-pixel checks passed.

Earlier integration runs exposed disagreements. Four real Sanity Context/Modal calls checked team size and development date for both events. All typed checks matched my authored labels; the model agreed on three. Calls took 9.2–14.9 seconds and cited retrieved entries. On the GIBC date question the model requested a timezone despite August 23 being well inside the build window; the checker supported the date. The [questions, answers and traces](https://github.com/himanshu748/fineprint/blob/main/evaluation/multi-event-context.json) retain that failure. Four questions cannot establish general accuracy.

A September 22 local run against real services also kept a missing fact visible: “started in August” did not establish that the whole application already existed. The model called prior work blocked; the checker required that fact. A second run returned Rules unclear for two Path One entries against the September 20 pack. That historical result changes to Blocked under the September 24 pack.

I tested the importer on three real pages on September 24, before the stricter September 29 guards. These are historical counts, not a remeasurement of the current importer:

| Page | Rules found | Mapped to a check | Check yourself | Quotes dropped |
| --- | --- | --- | --- | --- |
| Zero Origin (Devpost rules) | 18 | 4 | 14 | 0 |
| This challenge's DEV page | 16 | 8 | 8 | 0 |
| A lablab.ai event plus its guidelines page | 9 | 2 | 7 | 0 |

The first importer mapped “AI tools are permitted” to “AI use disclosed” and placed a start date nine hours early. I required timezone wording and words supporting the chosen fact mapping. A production Zero Origin import took 4.3 seconds; a local question against real services (“We are a team of five and the youngest of us is 16”) took 18.5 seconds over three rounds. Both agent and checker blocked team size.

The September 29 guards require a numeric bound and its direction, and a full quoted calendar date, time and timezone for date checks. Optional wording cannot become mandatory; a denial elsewhere in a sentence cannot negate an affirmative project fact. Ambiguous claims stay unresolved. Imported questions prefer server-cached rules; answers using only browser-supplied quotes disclose that they were not rechecked against the website.

JavaScript-rendered pages may expose little text: one lablab event returned about 1,000 characters and needed its guidelines page. Model mappings vary and remain unreviewed. These runs test particular questions and pages, not general eligibility accuracy.

## Working with coding agents

I began with a pre-submission agent, chose “Revise the concept together before building” and narrowed it with “uncertain eligibility.” Codex built the first version using Modal, a public rules dataset and a read-only Context token. I requested a Three.js landing page, then chose Claude’s product-focused replacement and public question flow. Codex continued when Claude reached its session limit.

I pushed for multi-event comparison, rule-change impact and “all of the hacks if possible.” Claude built the importer; the live runs exposed its loose mappings. These additions made the boundaries concrete: team size can travel between events, event-specific declarations usually cannot. An English question cannot prove an English submission; a planned integration cannot prove a working one. Users inspect quoted facts before applying them.

## Sanity Project Details

- Project ID: `cxbqxkq6`, dataset `production` (public, read-only rule records)
- Public dataset query: [competitions with their requirement counts](https://cxbqxkq6.api.sanity.io/v2025-02-19/data/query/production?query=*%5B_type%3D%3D%22competition%22%5D%7Btitle%2C%22requirements%22%3Acount(requirements)%7D)
- Document types: `competition`, `requirement`, `sourceVersion`, `reviewRubric`
- Knowledge Base: `kbyrY7h8fTnL`, served through the named Context MCP endpoint `fineprint`

No login is needed to try FinePrint. Rule checks run without the model. Live answers share a five-run allowance per ten minutes, with additional checks for repeated requests from the same network. A supported finding describes the selected rules and declared facts; the organizer makes the eligibility decision.

## Agent Session

{% agent_session building-fineprint-with-codex-a-rules-agent-over-sanity-context-9s5kte %}
