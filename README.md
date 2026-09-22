# FinePrint

[Live app](https://fineprint-kappa.vercel.app) · [Review desk](https://fineprint-kappa.vercel.app/review)

Ask which Sanity Challenge rules apply to your project. FinePrint reads a Sanity Knowledge Base through Context MCP, extracts quoted facts from your question, calls a typed rules checker and returns a cited answer. Source interpretation and the typed result stay visible together, including disagreements.

## Try it

1. Open the review desk and choose **An earlier project** or **Two entries, one path**.
2. Ask FinePrint. The live agent runs without an access code on the public deployment.
3. Inspect the accepted facts and actual tool/model steps. Unknown facts remain missing.
4. Choose **Review these facts below** to apply the result to the desk. This preserves the previous report for comparison.
5. Change a fact, recheck and inspect the official sources behind the changed finding.

The homepage contains a clearly labeled recorded source explanation, an expandable official source, the real FAQ/contest submission-limit conflict and an interactive check comparison. It makes no live model request. The old Three.js scene has been removed.

## Scope and evidence

FinePrint covers selected requirements of one event, the [DEV Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16). Nineteen requirements distinguish entry eligibility, path conditions, prize conditions and submission readiness. Project facts are declarations, not independent verification. A supported check is not an organizer decision or an eligibility certificate.

The official FAQ and contest rules disagree on entries per path. FinePrint preserves that discrepancy. The rule pack is dated September 20, 2026; live loading from Content Lake does not mean the official websites were automatically refreshed.

The typed engine matches 42 authored regression scenarios. The recorded Modal baseline matches 39 of those 42 labels with all nine Knowledge Base entries in context. These fixtures share the curated rule pack and are not an independent accuracy study or a retrieval-quality benchmark. The broader automated suite checks parsing, source boundaries, routes, authentication and request limits.

## Architecture

- **Content Lake:** one competition, 19 requirements and three source versions linked by references.
- **Sanity Context:** a dedicated MCP endpoint backed by Knowledge Base `kbyrY7h8fTnL`; the agent reads `initial_context` and selected `knowledge_base_read` paths.
- **Modal:** DeepSeek V4.1 Flash selects source entries and proposes quoted facts and interpretations.
- **Typed check:** the agent invokes `check_requirements`. Zod validates proposals, conservative guards reject unsupported quotes, then the condition engine evaluates the facts. The agent cannot overwrite the resulting statuses.
- **Output:** the question flow retains only citation paths actually read and discloses removed paths. Per-finding explanations reject any unretrieved citation. Provider failures stay errors.
- **Storage:** at most 12 report snapshots in the browser, with Markdown export. The question and optionally selected facts are sent to Modal during a live run. They are not saved to the public Sanity dataset.

The question flow is bounded to four model rounds, six retrieved entries and 45,000 source characters. Explanations use up to three rounds. Both routes share the existing Vercel Firewall rule: five requests per ten minutes in a shared regional bucket. This is not a hard global spend cap. An additional process-local guard allows two concurrent runs and 20 requests per hour.

## Local development

Use Node.js 24.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The desk works with a dated local rule pack without provider credentials. Live questions require a read-only Sanity Context token and a Modal endpoint. The existing authenticated Modal CLI can be used only in local development; production requires a server-side invocation credential.

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
- `src/lib/rules.ts`: dated source snapshot and illustrative dossiers.
- `src/components/ask-fineprint.tsx`: public question flow and inspectable results.
- `src/components/landing/`: product demonstrations, without WebGL.
- `sanity/`: schema for the structured rules.
- `evaluation/`: authored scenarios and recorded provider results.

Sanity project: `cxbqxkq6`. Dataset: `production` (public, curated rules only).
