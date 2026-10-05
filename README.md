# FinePrint

FinePrint is an agent that checks your hackathon entry against the rules it reads. Ask whether your project qualifies and it reads a Sanity Knowledge Base through Sanity Context MCP, quotes the facts it took from your question and runs typed checks over structured requirement records in Sanity Content Lake, with every tool call visible. Rule checks also run for free without AI, and other hackathons can be imported from readable public rules pages, with explicit unreviewed labels.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Then open http://127.0.0.1:3000. Use Node.js 24 (see `.nvmrc`). With provider variables left blank in `.env.local` the desk uses a dated local rule pack. Setting `SANITY_PROJECT_ID=cxbqxkq6` and `SANITY_DATASET=production` in `.env.local` reads the public curated dataset without a token. Live questions also need `SANITY_CONTEXT_URL`, `SANITY_CONTEXT_TOKEN` and the Modal variables in `.env.example`.

[Live app](https://fineprint-kappa.vercel.app) · [Guided demo](https://fineprint-kappa.vercel.app/demo) · [Review desk](https://fineprint-kappa.vercel.app/review) · [DEV post](https://dev.to/himanshu_748/fineprint-an-agent-that-checks-your-hackathon-entry-against-the-rules-it-reads-5fpa) · [91-second demo](https://youtu.be/Hm8-wydopz8)

Compare selected event rules against your project, save your progress, and return as your project changes. FinePrint guides you through missing facts and links each finding to its official source.

Two events are curated and reviewed. Other hackathons can be imported from readable public rules pages: FinePrint fetches the page, a model proposes requirements, every requirement must quote the page word for word and each one is mapped onto FinePrint's fixed fact vocabulary or left as "check yourself". Imported rules are always labeled "Imported from <host>, not reviewed" and stay in your browser.

## What works from a fresh clone

| Mode                 | Setup                                                          | Available workflow                                                                                                                                         |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local snapshots      | Node 24 and the commands above; leave provider variables blank | Homepage limit check, guided source-change demo, manual review desk, browser saves, backups and recorded Context receipts.                                 |
| Public curated rules | Add the project and dataset IDs above                          | Read the versioned public Content Lake records; this does not refresh official websites.                                                                   |
| Live AI and imports  | Your own Context Viewer token and Modal endpoint credentials   | Live questions, finding explanations, public-page imports and public GitHub rubric assessments. These require network access and can incur provider costs. |

Credentials for the hosted app are not included in this repository. The saved Context receipts and evaluations remain readable without credentials; they are dated evidence, not fresh provider runs. No write token is needed for the web app. Curator seed/publication scripts require separate write authorization and are unnecessary for trying the local workflow.

## Try it

For a quick introduction, open the **Guided demo**. Its three steps use the real dated September 20 and September 24 rule packs and the same typed checker as the review desk: two entries move from Rules unclear to Blocked after the source revision; choosing one entry produces Supported for that selected requirement. A separate September 22 receipt places the exact Context path, linked Team size record, quoted fact and typed result together. The saved receipt makes no new request. Opening the optional live question does not submit it; only **Ask FinePrint** starts a new provider call. The walkthrough does not save or replace personal reviews.

1. Open **My reviews**, enter your project name, and choose an event and track. Leave unknown facts unanswered.
2. Create your review and follow **Add this fact** to the next missing answer. **Check rules** refreshes the findings without using AI.
3. Open a finding to inspect its declared facts and official sources. Changes stay separate from the last checked report until you check again.
4. For help with a rule, use **Ask FinePrint** at the top of the review. Review the cited answer and quoted facts before choosing **Add these facts to my review**; your other answers and notes are preserved.
5. Return through **My reviews**. Drafts, reports, questions and answers autosave in this browser. Download a facts backup to move browsers, or a Markdown report to keep the findings.
6. To check another hackathon, choose **Another hackathon (paste its rules link)** under Event, paste its rules or overview page and optionally up to two more pages on the same site, then **Read the rules**. The summary shows how many requirements were found, how many map to checks, how many you must check yourself and how many quotes were dropped because they were not on the page.
7. Choose **Compare events** to check shared facts against both packs. Create a separate review for the other event to answer its remaining questions. **Refresh rule versions** checks for curated pack updates and shows which saved findings need another check.

No account is required. Archive and restore reviews, or delete an archived review after confirming. Backups preserve existing reviews on import and require a fresh check. An example review is available separately and is always labeled illustrative.

The homepage opens with a working submission-limit check: choose the September 20 or September 24 source pack and declare one or two entries. The same typed checker returns Rules unclear, Blocked or Supported for that requirement. The cool slate/cobalt evidence desk also contains the clearly dated Context receipt, source quotations and recorded comparisons. It makes no live model request. The optional AI form starts collapsed in personal reviews; guided chapters scroll and focus their new explanation.

## Scope and evidence

FinePrint covers 19 selected requirements of the [DEV Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16) and 18 for [GIBC V2 Open Invention](https://gibc-v2.devpost.com/rules). GIBC’s other two tracks and sponsor prize conditions are outside coverage. Select **Compare events** from a review to carry shared facts across both. Event-relative origin, restrictions and submission declarations are left unanswered in the other event. This comparison does not grant permission to submit the same work twice. Project facts are declarations, not independent verification. A supported check is not an organizer decision or an eligibility certificate.

On September 20, 2026 the Sanity FAQ allowed one submission per path while the contest rules said "There is no limit on the number of Entries you may submit during the Entry Period." On September 24 the contest rules say "Only one submission per path is allowed." FinePrint published pack `2026-09-24.1` as new Content Lake records and kept the `2026-09-20.1` records, so a saved two-entry review moves from Rules unclear to Blocked and lists the change under **Refresh rule versions**. The Sanity capture is dated September 24, 2026 and GIBC September 22; live loading from Content Lake does not mean the official websites were automatically refreshed.

The typed engine matches 42 authored regression scenarios. The recorded Modal baseline (September 20, against pack `2026-09-20.1`, when two entries were labeled Rules unclear) matched 39 of those 42 labels with all nine Knowledge Base entries in context. These fixtures share the curated rule pack and are not an independent accuracy study or a retrieval-quality benchmark. The broader automated suite checks parsing, source boundaries, routes, authentication and request limits.

[Four recorded two-event questions](evaluation/multi-event-context.json) exercised the real Context and Modal services. All four typed checks matched authored labels; the model agreed on three and called one in-window date unclear. The record preserves that disagreement and the actual source reads. It is a small integration regression, not independent accuracy evidence. The earlier baseline used the Knowledge Base outline available at the time; rebuilding it can change entry paths.

## Imported hackathons

`POST /api/import` fetches one https page plus at most two more on the same host. Every hop is resolved and refused if any address is private, loopback, link-local or otherwise non-public; the connection is pinned to the checked address, redirects are capped at three and re-checked, the whole fetch is limited to 10 seconds and 2 MB, and only `text/html` or `text/plain` is read. Scripts and styles are stripped before the text goes to the model.

The model returns event details and requirements as JSON. Zod rejects malformed output as a whole; nothing partial is saved. A requirement is dropped and listed when its quote is not in the fetched text (whitespace is normalized, nothing else). A start or deadline is kept only when its quote is on the page and names a timezone. The model picks a condition kind (team size, age, residency, build window, new work, entries, repository, video, demo link, language and others in `src/lib/imported-event.ts`); FinePrint builds the typed condition itself. A kind whose quote does not state it, or a number the quote does not contain, becomes a "check yourself" rule. Those rules use an unresolved condition, so the checker can never report them as supported. Pages are cached in memory by content hash for 24 hours, so importing the same page again does not call the model.

Import fetches count against a per-client rate limit; only a cache miss spends the shared model allowance. Production refuses them when the rate-limit policy or client metadata is unavailable. Imported events are saved with your reviews in browser storage, never in the public Sanity dataset, and review backups carry them. Ask FinePrint on an imported event still reads the Knowledge Base for how FinePrint weighs sources, plus a separate `imported_rules_read` tool over the supplied requirements. When a server cache entry exists, it replaces the browser copy. Otherwise the answer explicitly says the browser-supplied quotes have not been verified against the website. Neither case refreshes the source pages for the answer.

Measured on September 24, 2026, before the stricter September 29 import guards, with three live pages (a Devpost rules page, the DEV Sanity challenge page and a lablab.ai event page with its guidelines page): all proposed quotes were found on the pages, and the guards at that time mapped 4 of 18, 8 of 16 and 2 of 9 requirements to checks. These historical counts have not been remeasured with the current guards. Pages that render their rules with JavaScript (most lablab.ai event pages) expose little text; add the event's rules or FAQ page. The model's mapping is not reviewed and can vary between runs.

## Architecture

- **Content Lake:** two competitions, 37 requirements and five current source versions (eight including superseded) linked by references. Event and version IDs prevent collisions. Refresh rule versions compares saved reports with current curated packs, tracing changed requirements and sources to affected findings. A version-only refresh is distinguished from a changed condition. The local rehearsal never writes an official change.
- **Sanity Context:** a dedicated MCP endpoint backed by Knowledge Base `kbyrY7h8fTnL`; the agent reads `initial_context` and selected `knowledge_base_read` paths.
- **Modal:** DeepSeek V4.1 Flash selects source entries and proposes quoted facts and interpretations.
- **Typed check:** the agent invokes `check_requirements`. Zod validates proposals, conservative guards reject unsupported quotes, then the condition engine evaluates the facts. The agent cannot overwrite the resulting statuses.
- **Output:** the question flow retains only citation paths actually read and discloses removed paths. Per-finding explanations reject any unretrieved citation. Provider failures stay errors.
- **Storage:** up to 30 personal reviews and 12 imported events in browser storage, including archived reviews. Unfinished drafts survive reloads; another tab's changes pause autosave rather than overwrite work. JSON backups contain project facts and imported events, not verdicts or AI answers; Markdown exports retain the checked report. Earlier saved snapshots remain accessible. There is no account or cloud sync. Clearing browser data removes local work.
- **Privacy:** manual checks send declared facts to the application server. Optional questions and included facts are sent to Modal; per-finding explanations send the relevant facts. Personal reviews are not stored in the public Sanity dataset. Anyone using the same browser profile can open its saved reviews.

The question flow is bounded to four model rounds, six retrieved entries and 45,000 source characters. Explanations use up to three rounds. Configure one Vercel Firewall SDK policy, `FINEPRINT_RATE_LIMIT_ID`, with five credits per 600-second fixed window and the SDK counting key `header:x-vercel-rate-limit-key`. The existing `fineprint:source-agent` bucket spends one credit before each model run. A separate namespaced bucket uses the edge client IP and a captured ten-minute application window; ordinary client requests require two sequential credits from its five-credit allowance before accessing the shared model bucket. Login attempts and import fetches spend client credits; cached imports do not spend model credits. Missing policy or client metadata fails closed. Checks that expire or cross the captured application window fail closed, and a timed-out check cannot start a later debit, although an in-flight SDK request cannot be canceled.

The client check is an additional abuse limit, not a promise of two available requests. Concurrent or interrupted attempts can consume partial credits and admit fewer requests. Fixed-window boundaries allow bursts, and counters are regional. These buckets are not a hard global spend cap; IP rotation and distributed clients can still exhaust the shared allowance. An additional process-local guard allows two concurrent runs and 20 requests per hour.

## Local development

Setup commands are at the top of this file. The desk works with a dated local rule pack without provider credentials. Live questions require a read-only Sanity Context token and a Modal endpoint. The existing authenticated Modal CLI can be used only in local development; production requires a server-side invocation credential.

If a hosted rule check cannot reach its source, the desk offers **Use saved rules** with the event-specific date explicitly and labels the resulting report. AI failures and rate limits leave the manual workflow available. Neither mode automatically refreshes the official websites.

Production fails closed when the Vercel request-limit configuration is unavailable. Optional access-code deployments set `FINEPRINT_REQUIRE_ACCESS_CODE=true` and configure the access key and session secret. Otherwise the agent is public, still subject to the request limit.

Never put credentials in `NEXT_PUBLIC_*`, commit environment files or run `vercel link` over a configured local environment: linking may replace `.env.local`.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run verify:production
npm run format:check
```

`verify:production` starts a production server with disposable test credentials and cloud calls disabled. Tests are not proof that external providers or a hosted deployment work; those require separate live runs.

Local verification on October 5, 2026: 346 tests across 19 files and `npm run typecheck` passed with Next.js 16.3.8. This documentation audit did not rerun the build, browser checks or live providers; earlier recorded results remain dated evidence.

## Code guide

- `src/lib/question-agent.ts`: source reads, extracted facts, rule-check tool and cited response.
- `src/lib/question-facts.ts`: quote validation and partial date handling.
- `src/lib/source-agent.ts`: shared Context helpers and finding explanations.
- `src/lib/engine.ts`: applicability, uncertainty, conditions and comparisons.
- `src/lib/rules.ts` and `src/lib/gibc-rules.ts`: dated event snapshots.
- `src/lib/events.ts`: event catalog and conservative fact transfer.
- `src/lib/rule-impact.ts`: changed, added and removed requirements and source dependencies.
- `scripts/publish-event.ts`: version-preserving public rule publication using curator credentials, never production credentials.
- `src/lib/page-fetch.ts`: public-only page fetching and HTML to text.
- `src/lib/rule-import.ts` and `src/lib/imported-event.ts`: model extraction, quote checks, condition vocabulary and the imported pack builder.
- `src/components/import-rules.tsx`: the import form and summary.
- `src/components/ask-fineprint.tsx`: public question flow and inspectable results.
- `src/components/review-library.tsx`: create, resume, archive and transfer personal reviews.
- `src/lib/review-workspace.ts`: draft validation, safe backups, fact merging and storage conflicts.
- `src/components/landing/`: product demonstrations, without WebGL.
- `sanity/`: schema for the structured rules.
- `evaluation/`: authored scenarios and recorded provider results.

Sanity project: `cxbqxkq6`. Dataset: `production` (public, curated rules only).

### GitHub rubric review

`/repository` reviews public GitHub repositories against Sanity Path One, Sanity Path Two or GIBC Open Invention. It resolves the default branch to a fixed commit, selects up to ten readable text files (60,000 characters total, 300 lines and 10,000 characters per file), reads event-specific Sanity Context entries, and checks model citations against the inspected lines. Official rubric names and editorial evidence guidance are separate fields in three `reviewRubric` Content Lake records. Repository contents are sent to Modal, never written to the public Sanity dataset or executed.

The report records coverage, skipped files, truncation, immutable links, source reads and criterion-level next steps. README evidence is classified as documentation even if the model labels it implementation. Unverifiable citations are discarded. The report is a bounded static assessment, not a score, proof of runtime behavior, global originality check or eligibility decision. Only the latest repository report is saved locally and can be downloaded as JSON. Private repositories and imported events are outside repository review. GitHub reads use its unauthenticated public API and can hit a shared IP request limit; retry later if the report says the limit was reached. A successful static assessment does not verify a deployed app, tests, credentials or external integrations.

On access-code deployments, a locked or expired session opens the demo-code form while preserving the repository, selected rubric and previous result. Unlocking has a 20-second timeout and never starts an assessment automatically: select **Review repository** to retry. The linked 91-second demo uses edited browser captures from October 5, 2026 with Deepgram Aura 2 Thalia narration: the dated rule-change walkthrough, a fresh Sanity Context response and a public repository review with its fixed commit, rubric evidence and citations. It is not a continuous real-time recording; `/demo` remains the local source-change walkthrough.

Publish new versioned public rubric records with `node --env-file=.env.local --import tsx scripts/publish-rubrics.ts --use-cli-auth`, then refresh and rebuild the existing Knowledge Base. Never upload repository content in that publishing step. `scripts/verify-repository.ts` makes a real provider call using FinePrint's public repository; its receipt stays in ignored `evidence/`.
