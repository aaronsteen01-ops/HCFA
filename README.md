# Highland Cow Farm Adventure

A pastel, slightly chaotic farm-sim prototype built around modular Highland cow sprites. This repository contains the in-progress
game client (a Vite workspace) and the shared asset pipeline for generating cow parts.

## Repository Layout
- `highland-cow-farm/` – Main Vite project with development tooling and sample factory harness.
- `highland-cow-farm/src/assets/cowparts/` – Source manifest, placeholder assets, and decoded outputs that power the cow factory.
- `tools/` – Shared build/decode utilities.
- `README_COWFACTORY.md` – Deep-dive into the procedural sprite system.

## Development Workflow
1. `cd highland-cow-farm`
2. `npm install` – Install local vendored tooling (tsx, vite, TypeScript).
3. `npm run assets:decode` – Convert any `*.b64` placeholder sprites into real image files before running the app.
4. `npm run dev:factory` – Launch the Vite dev server focused on the cow factory playground (`src/dev/factory-test.html`).

> Tip: The decode step is fast and can be rerun whenever new parts are added. Existing decoded files are overwritten in place.

## Asset Pipeline
Cow parts are stored as compact base64 (`.b64`) files under `highland-cow-farm/src/assets/cowparts`. This keeps placeholder art small and easily
editable (most are inline SVG). The `tools/b64_to_files.ts` script converts those placeholders into regular image files so the
runtime can load them via URL references. The script now auto-detects whether it should read assets from the shared root
(`../highland-cow-farm/src/assets/cowparts`) or a local project copy, making it usable from multiple packages.

### Adding a New Cow Part
Use this checklist whenever you introduce fresh art:
- [ ] Drop the new asset into `highland-cow-farm/src/assets/cowparts/<category>/placeholders/` as a `.b64` file (or update the decoded version).
- [ ] Register the part in `highland-cow-farm/src/assets/cowparts/sprites.json`, including tags, poses, coats, and any rules.
- [ ] Run `npm run assets:decode` to regenerate the decoded files so the factory sees the latest art.

## Appendix: Game Design Snapshot
The original high-level design goals for the project remain below for reference.

### Core Loop (One Game Day)
1. **Morning Prep**: New day summary, herd status, unlocked items.
2. **Task Rush (Timed)**: Cows make requests (food, brushing, chasing, flowers). Player completes mini-games under time pressure.
3. **Day End**: Scores, happiness changes, unlocks (new cows, accessories, decorations).
4. **Auto-Save** to `localStorage`.

### Mini-Games (MVP)
1. **Catch the Cow**
   - Several cows try to leave the paddock.
   - Click/tap each runaway cow before it reaches the edge.
   - Scales with day number (more/faster cows).
2. **Food Frenzy**
   - Cows show a bubble (🥕, 🍎, 🌾, 🪣).
   - Drag & drop the correct food quickly.
   - Overfeeding increases **Chonk** (they get cutely fatter, may move slower next day).
3. **Brush Rush**
   - Drag a brush over “messy” patches until clean.
   - Sparkles appear when fully brushed.
4. *(Planned)* **Flower Fetch**
   - Match flower colours/shapes to cows for bonus happiness.

### Aesthetics & Audio
- **Style**: Pastel palette (pink, baby-blue, soft greens), kawaii UI (hearts, stars, sparkles).
- **Cows**: Big fluffy coats, expressive faces, cute accessories (bows, flower crowns).
- **SFX**: Soft “moo”, brush swish, munch, gentle “uh-oh” beeps.
- **Accessibility**: High-contrast UI option, reduced-flash toggle, captions for key SFX cues.

### Progression & Unlocks
- Start with 2 cows → expand to 20+.
- Unlocks via milestones:
  - **Cows** (new personalities/colours),
  - **Accessories** (hats, bows, flower crowns),
  - **Decor** (pink barn, rainbow fence),
  - **Foods** (cotton candy, ice cream).
- **Chonk Meter** increases with overfeeding (purely fun; small movement/animation changes only).

### Data Model (v1)
```ts
type CowId = string;

interface Cow {
  id: CowId;
  name: string;
  personality: "Greedy" | "Vain" | "Sleepy" | "Social";
  happiness: number;     // 0–100
  chonk: number;         // 0–100 (visual only)
  cleanliness: number;   // 0–100
  hunger: number;        // 0–100
  accessories: string[]; // ["flower_crown", "bow_pink", ...]
  colour: "brown" | "cream" | "rose" | "chocolate" | "white";
}

interface SaveData {
  day: number;
  cows: Cow[];
  unlocks: {
    foods: string[];
    accessories: string[];
    decor: string[];
  };
  options: {
    audioOn: boolean;
    highContrastUI: boolean;
    reducedFlash: boolean;
  };
  stats: {
    totalPerfects: number;
    totalChonks: number;
  };
  lastPlayedISO: string;
}
```

Game States: `BOOT → TITLE → FARM_DAY_START → TASK_RUSH → DAY_SUMMARY → FARM_DAY_START ...`

Pausable at any time. Auto-save after `DAY_SUMMARY`.

### Tech & Architecture
- Vanilla HTML/CSS/JS (no external libraries; fully offline).
- Single-file first (index.html with embedded CSS/JS + inline SVG assets).
- Canvas for mini-games; DOM UI for menus/hub.
- Timing via `requestAnimationFrame` + deterministic timers (no `setInterval` drift).
- Persistent state via `localStorage` with versioned schema + migration hook.

### UI / UX Notes
- Large, tappable buttons; keyboard + mouse + touch friendly.
- Always show: Day count, Herd size, Happiness average, Time left in task.
- Pink/pastel theme. Australian English labels.

### Performance Targets
- 60 FPS on desktop browsers.
- Memory leaks avoided (clean up event listeners per state).
- Canvas layers reused where possible.

### Milestones
- **M1 (Scaffold & Core)**
  - Single HTML file, title screen, options, save/load scaffold, farm hub.
  - Cow model, random name generator, 2 starter cows.
  - Day cycle loop (empty mini-game stubs).
- **M2 (Mini-Games MVP)**
  - Implement Catch the Cow, Food Frenzy, Brush Rush with increasing difficulty.
  - Day summary screen with scores, happiness deltas, random small unlock.
- **M3 (Polish & Unlocks)**
  - Accessories UI (equip bow/flower), basic decor, chonk visuals.
  - SFX toggles, animations, accessibility options.
- **M4 (Stretch)**
  - Flower Fetch mini-game, photo mode, simple achievements.

### Definition of Done (per feature)
- Works offline in Chrome/Edge/Firefox (latest).
- No console errors.
- State persists across reloads.
- Responsive layout ≥1024px wide; degrades gracefully on smaller screens.
- Meets accessibility toggles (high contrast, reduced flash).

### Testing Checklist
- Start new save → complete a day → reload → state persists.
- Overfeed a cow → chonk increases → visual reflects next day.
- Fail a task → happiness reduces → day summary shows change.
- Toggle audio/contrast → settings persist.
- Performance stable over 10 consecutive days.

### Licence
Personal use.
