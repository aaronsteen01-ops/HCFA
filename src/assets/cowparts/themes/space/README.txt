Highland Cow Factory – Space Theme

Shared sprite rules
- Canvas size: 512×512 pixels with a fully transparent background.
- Export sprites as lossless .webp files that preserve alpha.
- Keep the cow's nose tip aligned to the default anchor at (256,256) unless a recipe overrides it.
- Maintain consistent line weight, shading, and colour palette across all parts.
- Use lowercase snake_case names with category prefixes and no spaces.

Category notes
- Space theme parts can cover multiple categories (bodies, faces, accessories) but must stay stylistically cohesive: starfields, nebulae, and futuristic trims.
- Anchor reference: follow the base category anchors (for example, bodies at (256,256), headgear at (256,150)) so themed items remain compatible with standard parts.
- Filename format: space_<category>_<variant>.webp (for example, space_body_galaxy.webp, space_head_antenna.webp, space_neck_constellation_cape.webp).
- Tag each themed entry in sprites.json with the "theme:space" rule so the factory can group matching parts in recipes.
