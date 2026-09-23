# FinePrint

[Live app](https://fineprint-kappa.vercel.app) · [Review desk](https://fineprint-kappa.vercel.app/review)

Compare selected event rules against your project, save your progress, and return as your project changes. FinePrint guides you through missing facts and links each finding to its official source. Optional AI questions read a Sanity Knowledge Base through Context MCP and compare the source interpretation with a typed rules check.

## Try it

1. Open **My reviews**, enter your project name, and choose an event and track. Leave unknown facts unanswered.
2. Create your review and follow **Add this fact** to the next missing answer. **Check rules** refreshes the findings without using AI.
3. Open a finding to inspect its declared facts and official sources. Changes stay separate from the last checked report until you check again.
4. For help with a rule, expand **Ask a question about the rules**. Review the cited answer and quoted facts before choosing **Add these facts to my review**; your other answers and notes are preserved.
5. Return through **My reviews**. Drafts, reports, questions and answers autosave in this browser. Download a facts backup to move browsers, or a Markdown report to keep the findings.
6. Choose **Compare events** to check shared facts against both packs. Create a separate review for the other event to answer its remaining questions. **Refresh rule versions** checks for curated pack updates and shows which saved findings need another check.

No account is required. Archive and restore reviews, or delete an archived review after confirming. Backups preserve existing reviews on import and require a fresh check. An example review is available separately and is always labeled illustrative.

The homepage contains a clearly labeled recorded source explanation, an expandable official source, the real FAQ/contest submission-limit conflict and an interactive check comparison. It makes no live model request. The old Three.js scene has been removed.

## Scope and evidence

FinePrint covers 19 selected requirements of the [DEV Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16) and 18 for [GIBC V2 Open Invention](https://gibc-v2.devpost.com/rules). GIBC’s other two tracks and sponsor prize conditions are outside coverage. Select **Compare events** from a review to carry shared facts across both. Event-relative origin, restrictions and submission declarations are left unanswered in the other event. This comparison does not grant permission to submit the same work twice. Project facts are declarations, not independent verification. A supported check is not an organizer decision or an eligibility certificate.

The official Sanity FAQ and contest rules disagree on entries per path. FinePrint preserves that discrepancy. The Sanity capture is dated September 20, 2026 and GIBC September 22; live loading from Content Lake does not mean the official websites were automatically refreshed.

The typed engine matches 42 authored regression scenarios. The recorded Modal baseline matches 39 of those 42 labels with all nine Knowledge Base entries in context. These fixtures share the curated rule pack and are not an independent accuracy study or a retrieval-quality benchmark. The broader automated suite checks parsing, source boundaries, routes, authentication and request limits.

[Four recorded two-event questions](evaluation/multi-event-context.json) exercised the real Context and Modal services. All four typed checks matched authored labels; the model agreed on three and called one in-window date unclear. The record preserves that disagreement and the actual source reads. It is a small integration regression, not independent accuracy evidence. The earlier baseline used the Knowledge Base outline available at the time; rebuilding it can change entry paths.

## Architecture

- **Content Lake:** two competitions, 37 requirements and five source versions linked by references. Event and version IDs prevent collisions. Refresh rule versions compares saved reports with current curated packs, tracing changed requirements and sources to affected findings. A version-only refresh is distinguished from a changed condition. The local rehearsal never writes an official change.
- **Sanity Context:** a dedicated MCP endpoint backed by Knowledge Base `kbyrY7h8fTnL`; the agent reads `initial_context` and selected `knowledge_base_read` paths.
- **Modal:** DeepSeek V4.1 Flash selects source entries and proposes quoted facts and interpretations.
- **Typed check:** the agent invokes `check_requirements`. Zod validates proposals, conservative guards reject unsupported quotes, then the condition engine evaluates the facts. The agent cannot overwrite the resulting statuses.
- **Output:** the question flow retains only citation paths actually read and discloses removed paths. Per-finding explanations reject any unretrieved citation. Provider failures stay errors.
- **Storage:** up to 30 personal reviews in browser storage, including archived reviews. Unfinished drafts survive reloads; another tab's changes pause autosave rather than overwrite work. JSON backups contain project facts, not imported verdicts or AI answers; Markdown exports retain the checked report. Earlier saved snapshots remain accessible. There is no account or cloud sync. Clearing browser data removes local work.
- **Privacy:** manual checks send declared facts to the application server. Optional questions and included facts are sent to Modal; per-finding explanations send the relevant facts. Personal reviews are not stored in the public Sanity dataset. Anyone using the same browser profile can open its saved reviews.

The question flow is bounded to four model rounds, six retrieved entries and 45,000 source characters. Explanations use up to three rounds. Both routes share the existing Vercel Firewall rule: five requests per ten minutes in a shared regional bucket. This is not a hard global spend cap. An additional process-local guard allows two concurrent runs and 20 requests per hour.

## Local development

Use Node.js 24.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The desk works with a dated local rule pack without provider credentials. Live questions require a read-only Sanity Context token and a Modal endpoint. The existing authenticated Modal CLI can be used only in local development; production requires a server-side invocation credential.

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

## Code guide

- `src/lib/question-agent.ts`: source reads, extracted facts, rule-check tool and cited response.
- `src/lib/question-facts.ts`: quote validation and partial date handling.
- `src/lib/source-agent.ts`: shared Context helpers and finding explanations.
- `src/lib/engine.ts`: applicability, uncertainty, conditions and comparisons.
- `src/lib/rules.ts` and `src/lib/gibc-rules.ts`: dated event snapshots.
- `src/lib/events.ts`: event catalog and conservative fact transfer.
- `src/lib/rule-impact.ts`: changed, added and removed requirements and source dependencies.
- `scripts/publish-event.ts`: version-preserving public rule publication using curator credentials, never production credentials.
- `src/components/ask-fineprint.tsx`: public question flow and inspectable results.
- `src/components/review-library.tsx`: create, resume, archive and transfer personal reviews.
- `src/lib/review-workspace.ts`: draft validation, safe backups, fact merging and storage conflicts.
- `src/components/landing/`: product demonstrations, without WebGL.
- `sanity/`: schema for the structured rules.
- `evaluation/`: authored scenarios and recorded provider results.

Sanity project: `cxbqxkq6`. Dataset: `production` (public, curated rules only).
