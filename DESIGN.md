---
name: 'FinePrint'
description: 'A forest-ink review desk with a pale-paper product introduction.'
colors:
  page: '#f5f7f8'
  surface: '#fff'
  ink: '#233139'
  muted: '#617079'
  line: '#e2e8e9'
  line-strong: '#cbd6d7'
  accent: '#155d4b'
  accent-dark: '#104838'
  sage: '#edf5f1'
  red: '#aa4336'
  red-bg: '#fbefed'
  amber: '#845c17'
  amber-bg: '#fcf5e7'
  blue: '#466aa1'
  blue-bg: '#edf2fa'
  supported: '#327146'
  supported-bg: '#edf5ef'
  unclear: '#466392'
  not-applicable: '#66787e'
  not-applicable-bg: '#f0f2f3'
  selected: '#eff6f2'
  selected-line: '#c1d8cb'
  focus: '#4c9981'
  field-bg: '#fafcfb'
  control-hover: '#eaf0ee'
  pane-navigation: '#eaf0ed'
  landing-paper: '#f7f8f3'
  landing-dark: '#123f34'
  landing-copy: '#506456'
  landing-line: '#d8e1d9'
  landing-surface-line: '#cbd6cc'
  conflict-text: '#eff5ed'
  conflict-copy: '#c3d6c9'
  conflict-line: '#608074'
  closing-bg: '#e5eddf'
  recorded-bg: '#eff4f8'
  changed-bg: '#fbf6e4'
typography:
  display:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 'clamp(44px, 4.6vw, 68px)'
    fontWeight: 550
    lineHeight: 1.08
    letterSpacing: '-0.04em'
  display-emphasis:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(44px, 4.6vw, 68px)'
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: '-0.04em'
  headline:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 'clamp(32px, 3.25vw, 48px)'
    fontWeight: 550
    lineHeight: 1.18
    letterSpacing: '-0.035em'
  page-title:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '32px'
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: '-0.035em'
  title:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: '-0.01em'
  body:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.6
  landing-body:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '17px'
    fontWeight: 400
    lineHeight: 1.75
  answer:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.95
  label:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12px'
    fontWeight: 650
    lineHeight: 1.5
  finding-title:
    fontFamily: "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12px'
    fontWeight: 700
    lineHeight: 1.5
  source-quote:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '23px'
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: '-0.02em'
  knowledge-base-path:
    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
    fontSize: '10px'
    fontWeight: 400
    lineHeight: 1.7
rounded:
  tag: '4px'
  small-control: '5px'
  compact-control: '6px'
  field: '7px'
  button: '8px'
  navigation: '9px'
  inset: '10px'
  surface: '14px'
spacing:
  tight: '6px'
  control-gap: '8px'
  compact: '10px'
  small: '12px'
  medium: '16px'
  pane: '20px'
  content: '22px'
  section: '24px'
  panel: '30px'
  page: '36px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.surface}'
    rounded: '{rounded.button}'
    padding: '12px 13px'
    width: '100%'
  button-primary-hover:
    backgroundColor: '{colors.accent-dark}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.accent}'
    rounded: '{rounded.field}'
    padding: '10px 14px'
  button-secondary-hover:
    backgroundColor: '{colors.control-hover}'
  landing-cta:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.surface}'
    rounded: '{rounded.field}'
    padding: '15px 21px'
  landing-cta-hover:
    backgroundColor: '{colors.accent-dark}'
  fact-input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.field}'
    padding: '9px 10px'
    width: '100%'
  question-input:
    backgroundColor: '{colors.field-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.button}'
    padding: '15px 16px'
    width: '100%'
  finding-selected:
    backgroundColor: '{colors.selected}'
    textColor: '{colors.ink}'
    rounded: '{rounded.field}'
    padding: '13px 10px'
    width: '100%'
  pane-navigation:
    backgroundColor: '{colors.pane-navigation}'
    textColor: '{colors.muted}'
    rounded: '{rounded.navigation}'
    padding: '4px'
  workbench:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.surface}'
  recorded-answer:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.surface}'
  source-document:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.surface}'
  agent-citations:
    textColor: '{colors.accent}'
    padding: '12px 0'
  status-supported:
    backgroundColor: '{colors.supported-bg}'
    textColor: '{colors.supported}'
    rounded: '{rounded.tag}'
    padding: '4px 6px'
  status-blocked:
    backgroundColor: '{colors.red-bg}'
    textColor: '{colors.red}'
    rounded: '{rounded.tag}'
    padding: '4px 6px'
  status-missing:
    backgroundColor: '{colors.amber-bg}'
    textColor: '{colors.amber}'
    rounded: '{rounded.tag}'
    padding: '4px 6px'
  status-unclear:
    backgroundColor: '{colors.blue-bg}'
    textColor: '{colors.unclear}'
    rounded: '{rounded.tag}'
    padding: '4px 6px'
  status-not-applicable:
    backgroundColor: '{colors.not-applicable-bg}'
    textColor: '{colors.not-applicable}'
    rounded: '{rounded.tag}'
    padding: '4px 6px'
---

# Design System: FinePrint

## Overview

**Creative North Star: "The Review Desk"**

FinePrint puts a builder’s declared facts, findings, and supporting sources in a calm reading environment. Cool white work surfaces, forest actions, restrained borders, and compact controls make the relationship between those records visible. Written status labels carry meaning alongside color and icons.

The landing extends the desk with pale paper, larger type, readable document panels, and a dark forest source comparison. Its recorded answer, source disclosure, and fact switch use the same evidence vocabulary as the application. Page composition and visitor sequence remain in `.impeccable/surfaces/landing.md`; this record captures the implemented visual system.

**Key Characteristics:**

- Forest actions on cool white and pale paper surfaces.
- Findings stay connected to declared facts and inspectable sources.
- Self-hosted Manrope leads; serif quotations and monospace paths have specific reading roles.
- Compact desk controls expand into a single-pane phone layout.
- Recorded demonstrations and live request states remain visibly distinct.

## Colors

Forest and sage connect the application to the landing; slate neutrals support dense reading. The frontmatter owns the actual values. Generated tonal ramps in the sidecar are panel previews, not additional application tokens.

### Primary

- **Forest Ink** (`accent`, `accent-dark`): check actions, source links, selected navigation, and brand accents; the deeper shade is the primary hover state.
- **Sage** (`sage`, `selected`, `selected-line`): working notices, citation chips, and selected findings.
- **Landing Forest** (`landing-dark`): the dark source-conflict section and landing wordmark.

### Secondary

- **Supported Green** (`supported`, `supported-bg`): a supported finding.
- **Blocked Red** (`red`, `red-bg`): a blocker or request error.
- **Unresolved Amber** (`amber`, `amber-bg`): missing facts, stale reports, and validation notes. The landing’s changed row uses `changed-bg` with a written “Changed” label.
- **Context Blue** (`blue`, `blue-bg`, `unclear`): comparison and uncertainty; the label distinguishes the meanings. `recorded-bg` separates the recorded source answer.

### Neutral

- **Cool Page**, **White Surface**, and **Slate Ink** (`page`, `surface`, `ink`, `muted`): the desk background, panels, primary text, and supporting text.
- **Desk Lines** (`line`, `line-strong`): dividers and control boundaries. `field-bg`, `control-hover`, and `pane-navigation` provide quiet tonal separation.
- **Pale Paper** (`landing-paper`), **Landing Copy**, and **Landing Lines** (`landing-copy`, `landing-line`, `landing-surface-line`): the landing’s reading surface, secondary copy, and document borders.
- **Conflict Text** (`conflict-text`, `conflict-copy`, `conflict-line`): light reading and separators on forest. `closing-bg` gives the closing action a pale green band.
- **Not Applicable** (`not-applicable`, `not-applicable-bg`): the neutral review status.
- **Focus Green** (`focus`): the visible keyboard outline.

**The Status Has Words Rule.** A review state keeps its written label; color and icon reinforce it.

## Typography

**Display and Body Font:** self-hosted Manrope Variable with the system sans fallback stack in the frontmatter.

**Quotation Font:** Georgia with Times New Roman and serif fallbacks. It is used for the italic word in the landing headline and landing source quotations.

**Technical Path Font:** `ui-monospace, SFMono-Regular, monospace` is explicitly implemented for Knowledge Base paths inside the desk’s cited-entry disclosure. SFMono-Regular is a system fallback in this code-path role, not a brand font. Live question citations and traces use native code text; the recorded landing paths deliberately use Manrope.

### Hierarchy

- **Display:** the landing uses the `display` role; the final phone override is 42px. The italic emphasis inherits its size and tracking.
- **Headline:** section headings use `headline`; phone sections use 36px, and the conflict heading uses 35px. The closing headline has its own fluid 32–52px range.
- **Page title and pane title:** the desk uses `page-title` and `title`; its final phone title is 26px. Secondary views use 34px titles before their phone override.
- **Body:** the desk base is `body`. Detailed findings and sources use 11px copy with generous line height; phone finding subtitles and source prose rise to 12px. Hero copy uses `landing-body` with a 34ch maximum; ordinary landing section copy is 15px at 1.8 line height.
- **Answer:** live answers use `answer`, preserve line breaks, and stop at 85ch; phone answers use 13px.
- **Labels:** field labels use `label`. Finding titles use `finding-title`, rising to 13px on phones. Status tags are smaller supporting labels, not headings.

## Layout

The desk has a 78px app bar and a centered container up to 1600px with 36px padding. The workbench is one bordered surface with facts, findings, and sources in 266px / flexible / 294px columns. Its desktop height is viewport-relative with a 560px minimum. Pane headers, report context, and the check action remain visible while long contents scroll.

At 1500px and above, side panes widen to 282px and 324px. At 1190px and below, they narrow to 236px and 265px and outer padding becomes 26px by 20px. At 1000px and below, sources move under the other two panes, the workbench becomes content-height, and internal scrolling is released. At 700px and below, three labeled pane tabs select one visible pane, app navigation wraps to a separate row, and page side padding is 15px.

Ask FinePrint sits above the workbench in a white panel with 26px by 30px padding. Its actions wrap. At 850px and below, the answer comparison becomes two columns with the rule title above them, facts become one column, and the apply row stacks. At 700px and below, panel padding becomes 20px by 17px, form actions become one column, and the submit button fills the width.

The landing uses ordinary document flow beneath an opaque sticky header. The header is 88px, then 76px at 1000px and 70px at 700px. The hero is a two-column grid capped at 1440px, with 5vw side space. Source and change sections cap at 1340px and pair sticky explanatory copy with a document panel; the conflict section uses two parallel source columns. At 700px and below, these become vertical reading sequences with 22px side padding and static section copy. The header keeps “Open the desk” and hides its in-page “How it works” link. Anchor sections retain a 110px scroll margin.

Repeated spacing runs from compact 6–12px gaps to 16–24px pane spacing. Long citations and identifiers wrap within their container. Surface-specific measurements stay local to that layout.

## Elevation & Depth

The desk is mostly flat: borders and pale fills separate records. Small control shadows mark selection; the recorded landing answer has a wider ambient shadow. Source documents and the question panel remain bordered, without a card shadow.

### Shadow Vocabulary

- **Primary control:** `0 3px 9px -4px #17564066`.
- **Selected filter:** `0 1px 3px #28483d16`.
- **Selected phone pane:** `0 2px 5px #24403313`.
- **Recorded answer:** `0 25px 65px -32px #24483955`.
- **Selected fact choice:** `0 2px 8px -3px #20493626`.

## Shapes

The recurring surface radius is 14px. Fields and secondary actions use 7px; primary desk actions and the question field use 8px. Tags use 4px. Smaller segmented controls use 4–6px corners; the phone pane rail uses 9px. Thin borders, horizontal dividers, and uncluttered rows provide structure. Icons use simple line strokes and sit alongside readable labels.

## Components

### Buttons

Desk primary buttons are forest with white text, 12px by 13px padding, 8px corners, and a small control shadow. They deepen on hover. Secondary buttons use white, forest text, a strong border, 10px by 14px padding, and 7px corners; their hover uses the shared pale fill. Text actions remain compact and unboxed.

The landing CTA uses the same forest action color with 7px corners, 15px by 21px padding, and a 54px minimum height. Desk buttons transition background, color, and shadow over 0.17s; the landing CTA transitions its background over 0.2s. Disabled buttons use 0.48 opacity and a not-allowed cursor. Keyboard focus uses a 3px green outline with 3px offset.

### Status tags and selection

Supported, Blocked, Missing fact, Rules unclear, and Not applicable each have a written label and a foreground/background pair. Tags use 4px by 6px padding, 4px corners, and weight 650. Landing tags grow to 11px, then use 10px on phones. Tags are informational; selected findings instead receive a sage background and visible border. The selected filter or fact choice uses a white inset and a restrained shadow.

### Cards / Containers

The workbench joins its three panes inside one bordered 14px surface. Source library cards use the same surface shape with 25px padding. Ask FinePrint adds a full-width question panel. Landing recorded answers, source disclosures, and fact comparisons share 14px corners; only the recorded answer uses ambient lift. Internal headings and rows are separated with rules rather than nested card stacks.

### Inputs / Fields

Desk fields are white, bordered, 7px round, and padded 9px by 10px. Their final desktop text is 12px; at 700px and below, inputs use 16px text and at least 44px height. Hover strengthens the field border. The question textarea has a lightly tinted background, 8px corners, 15px text, 15px by 16px padding, vertical resizing, and a 103–300px height range. On phones its text is 16px and minimum height is 145px.

The question path selector stays visible; the adjacent checkbox explicitly includes desk facts. Busy requests disable the fields and submit action. Errors use a red alert with the actual error text; there is no separate invented field-error style.

### Navigation

Desk navigation uses muted, weight-650 text, a forest active label, and a 2px bottom rule. Hover darkens the label without a fill. Phone pane tabs use a pale rail with a white selected inset and retain all three pane names. The landing’s sticky header pairs the wordmark with an in-page link and a bordered desk link; ordinary links underline on hover. Focus remains visible on links, controls, and disclosure summaries.

### Recorded answer and fact change

The recorded answer keeps its dated caption and “No live request” disclosure. It reveals once when visible and can replay: a 1s stepped question reveal precedes 0.7s source-read and answer arrivals. The source disclosure is a native details element, open initially, with the status, declared date, quotation, official link, and capture metadata visible. The fact switch uses pressed states and a polite result region; only changed rows receive a brief 0.8s amber wash and “Changed” label.

### Live answers, citations, and trace

A working notice reports the request’s actual pending state. Completed answers show elapsed time, retrieved paths, source interpretation beside typed checks, extracted facts with quotations, and a disclosure of actual model/tool steps. Each step carries an outcome icon and tabular duration; long arguments wrap. Applying facts is an explicit secondary action, and the prior report remains available for comparison. The cited-entry disclosure uses a 44px summary target and its explicit monospace path stack.

Reduced-motion preference makes page scrolling immediate, reduces global animation and transition durations to 0.01ms, and disables landing animations and transitions entirely. Replay, disclosures, selected states, and result changes remain usable and readable without motion.

## Do's and Don'ts

### Do:

- Do keep the written status beside the finding and preserve access to its supporting source.
- Do use Manrope for interface copy, Georgia for the implemented landing emphasis and quotations, and the documented monospace stack for technical citation paths.
- Do retain visible focus, wrapped source identifiers, labeled phone panes, and reduced-motion states.
- Do keep the recorded example’s date and disclosure visible and label illustrative facts.

### Don't:

- Don’t replace an unknown or conflicting finding with a success treatment.
- Don’t style a source citation as proof that a project meets the requirement.
- Don’t present the landing replay as a live request or show invented steps while the question agent is working.
- Don’t carry a landing-specific layout or serif treatment into every desk component.
