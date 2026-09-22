> Historical design record. Superseded on September 22, 2026 by the user-approved product landing without Three.js.

# FinePrint: a journey through the fine print

## World and purpose
A single printed rulebook separates into source pages, exposes a disagreement, and assembles into a project review. Builders can understand the workflow before opening the actual review desk. Native scroll controls one persistent real-time Three.js scene. Navigation links and a document-inspection button also work with keyboard or touch. No essential product facts live only in the canvas.

The user requested the build-threejs-scroll-worlds workflow on September 20, 2026. This extends the existing forest-green FinePrint identity. It is an illustrative product story, not a depiction of a real generated report or a claim that all eligibility rules are covered.

## Visual constants
- Tabletop units: one unit represents 10 cm. Paper leaf 3.44 × 4.75 units; thickness .05; rounded corners .025. Cover 3.8 × 5.12 × .18 with .07-radius edges; spine .19 × 5.1 × .46.
- Forest backdrop #132f29; cover #24634f; paper edges #e6dfc9; printed face #f4f0df; title ink #243f33; brass #c7a267; conflict tab #c99454.
- Large silhouette: one bound folio. Medium forms: four thick paper leaves, index tabs and spine. Small accents: printed headings, lines, page numbers, narrow rules, and two brass registration rings and five narrow spine grooves.
- Quiet editorial typography uses existing self-hosted Manrope plus the system Georgia serif for display words. Copy occupies the left 45% on desktop; the world occupies the right. On phones, text and a separately composed world share upper/lower regions.
- Upper-left key at [-5,12,7] (#fff5db, intensity 3.2–3.7 by chapter); hemisphere fill (#e6efd8 / #15362a, intensity 2.1); green rim at [4,3,-7] (#9ac7ad, intensity 2); one 1024 × 1024 shadow map. No bloom, particles, glass, audio, external models, or texture packs.
- Camera FOV 35–37 degrees desktop, 43–46 mobile. Near/far .1/80. Zero roll. Damping 6.2. No ambient loops: at rest the world rests.
- Materials: rough paper and printed faces .94/metalness 0; cloth cover .84/0; brass .36/.8. Canvas-generated print texture 768×1024, sRGB. Surface marks come from the document layout, not random grunge.

## Scene and layer map
DOM: fixed navigation → ordered semantic chapters → reachable footer. A fixed canvas stage sits behind the DOM. Each chapter is 115svh; the last includes a real /review link. A small mode button switches to composed chapter stills. A CSS folio poster exists before loading and after WebGL failure.

Three scene: environment (forest fog + tabletop) → worldRoot (cover, spine, paper leaves, tabs, registration rings, grooves). The four printed face planes serve as simple raycast targets; the closest visible hit opens the current chapter note. One renderer and scene are created after the shell. Each chapter transforms the same objects; no reconstruction or object teleports at seams.

## Chapter and camera ledger
Positions and targets are expressed relative to the folio, with the desktop camera aimed left of it to give the folio the right-hand composition. Mobile centers the subject with vertical copy-safe space.

| Anchor | Story and spatial change | Desktop position / target / FOV | Mobile position / target / FOV | Paper state | Interaction |
| --- | --- | --- | --- | --- | --- |
| overview | Closed volume establishes the entire rules problem | [8,7,12] / [-2.8,0,0] / 35 | [6,8,10] / [0,.8,0] / 43 | compact stack | inspect top leaf |
| trace | Camera rises, leaves fan into an exploded view | [6,10,10] / [-2.8,1,0] / 37 | [5,12,13] / [0,1.4,0] / 45 | layers separate | inspect source |
| ambiguity | Camera pulls back as two source leaves separate | [7,10,17] / [-3,1,0] / 37 | [4,10,17] / [0,1.7,0] / 46 | two leaves spread laterally | inspect conflict |
| review | Camera pulls around the assembled report and its visible yellow unresolved tab | [7,8,10] / [-2.4,.7,0] / 36 | [6,9,11] / [0,1,0] / 43 | report stack | open review desk |

World state interpolates from the same normalized chapter progress. Plane positions, rotations, key intensity and fog change continuously. Exact progress chooses navigation and available interaction; smoothed progress chooses only rendered transforms. Reversal recreates the same poses. Reduced motion snaps to the nearest chapter and renders only on state changes.

## Interaction matrix
| Control | Feedback | Activation | Gating and recovery |
| --- | --- | --- | --- |
| Chapter links | current indicator; visible focus | native anchor scroll | all chapters; no scroll trap |
| Inspect document (DOM or raycast) | paper edges warm; short inline detail | explains current illustrative document | nearest chapter only; closes on chapter change |
| Motion toggle | pressed state and text | composed stills / scrolling 3D | persists for current visit; defaults to OS preference |
| Open review desk | strong cream CTA | navigate /review | every chapter and header |

## Asset/loading and performance ledger
Everything is generated locally in code except the installed Three.js runtime and existing local font. The semantic HTML, CSS poster and CTA arrive before the dynamic Three import. All four leaves share geometry; individual print textures are small and resident throughout. No next-chapter network assets, loaders or fake percentage.

Budget: mobile DPR ≤1.35; desktop ≤1.75; <90 draw calls; <50k triangles; ≤6MB critical transferred assets; median frame ≤16.7ms desktop / ≤25ms mobile target. One shadowed light. A sustained slow frame window lowers DPR to 1. No expensive optional passes to disable. Measurements must be recorded from the actual browser, with real-device GPU/thermal testing left explicitly unverified if unavailable.

Lifecycle: stop RAF when settled or hidden, resume on scroll/resize/visibility, remove listeners and observers, dispose geometries/materials/textures/renderer on navigation. WebGL creation and context loss reveal the poster while preserving the full story. Production debug information is opt-in via ?world-debug=1; no network data or secrets appear there.

## QA evidence
All four endpoints were captured from live WebGL at 1440×900, 768×1024 and 390×844. Native anchors, reverse navigation, reload at depth, resize, keyboard inspection, still mode and static fallback were checked in the Codex browser. The static fallback is captured in `evidence/landing-fallback.png`; endpoint captures use still mode and include visible diagnostics. See `evidence/verification.md` for measured renderer counters and the remaining device, motion and loading gaps. Budgets above are targets, not measured GPU performance.
