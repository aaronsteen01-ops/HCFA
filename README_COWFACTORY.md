📖 README – Highland Cow Procedural Sprite System

This module powers procedurally generated Highland cows with interchangeable parts (bodies, faces, accessories, themes).

🔧 How it works

Assets are stored in highland-cow-farm/src/assets/cowparts/ by category.

Each asset has a transparent background and is centred on a 512×512 canvas (nose tip at centre (256,256)).

The manifest (sprites.json) describes categories, z-order, anchors, rarity weights, and rules.

The factory (cowFactory.ts) uses the manifest to assemble random cows, deterministic by seed if desired.

Cows are rendered onto <canvas> at runtime.

You can save a cow’s recipe (the chosen parts) to reconstruct them later.

📂 Folder layout
highland-cow-farm/src/assets/cowparts/
  bodies/       # Base coat + pose (required)
  faces/        # Expressions (required)
  horns/        # Horn shapes (default, short, etc.)
  hair/         # Fringe/tuft styles
  neck/         # Scarves, bells, necklaces
  head/         # Crowns, bows, hats
  body_acc/     # Blankets, saddles, backpacks
  themes/       # Themed sets (space, pink_high_tea, halloween, etc.)
  sprites.json  # Manifest describing all categories/parts

🗂 Folder Notes

Each folder contains a README.txt for guidance.

Example highland-cow-farm/src/assets/cowparts/bodies/README.txt
Body sprites (required for every cow).
- Export size: 512x512 transparent PNG or WebP
- Anchor: nose at (256,256)
- Must include coat + pose in filename.
Naming:
  body_<coat>_<pose>.webp
Example:
  body_brown_idle.webp
  body_cream_idle.webp
  body_rose_idle.webp
  body_chocolate_idle.webp
  body_white_idle.webp
Optional:
  body_<coat>_walk.webp
  body_<coat>_blink.webp

Example highland-cow-farm/src/assets/cowparts/head/README.txt
Head accessories (crowns, bows, hats).
- Positioned relative to top of head (anchor 256,190).
- Transparent background.
- Keep scale consistent so items swap seamlessly.
Naming:
  acc_<item>.webp
Examples:
  acc_flower_crown.webp
  acc_pastel_bow.webp
  acc_santa_hat.webp
  acc_witch_hat.webp


You can duplicate this format for each folder with details about anchors and naming.

🖼 Placeholder Assets

To get started without art, Codex should generate .b64 placeholder assets:

For each required sprite (body, face, horns, fringe), create a simple SVG shape (circle, square, etc.), encode it as base64, and save it into the corresponding folder as .webp.

These placeholders allow compilation and rendering until real art is dropped in.

Replace placeholders with final transparent .webp later.

⚙️ Factory Module

src/game/cowFactory.ts is provided. It:

Loads sprites.json

Picks weighted random parts per category

Applies z-order layering

Outputs a Recipe (chosen parts, coat, pose, seed)

Renders to a canvas

✅ Example Usage
import { CowFactory } from "@/game/cowFactory";

const factory = new CowFactory();
await factory.load();

const recipe = factory.buildRecipe({ seed: "bonnie001", coat: "rose", pose: "idle" });
await factory.renderToCanvas(recipe, document.querySelector("#cowCanvas")!);

// Save recipe in game state, re-render anywhere later.

🚀 Tasks for Codex

Create src/game/cowFactory.ts using the provided TypeScript template.

Create highland-cow-farm/src/assets/cowparts/ with subfolders and README.txt notes inside each.

Generate sprites.json manifest stub with sample entries (one per category).

Populate each folder with .b64 placeholder assets (simple coloured circles/squares).

Encode with data:image/webp;base64,...

Use filenames matching naming convention.

Ensure the game boots with cows rendered from placeholders.