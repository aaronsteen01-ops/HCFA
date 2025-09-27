Highland Cow Factory – Faces

Shared sprite rules
- Canvas size: 512×512 pixels with a fully transparent background.
- Export sprites as lossless .webp files that preserve alpha.
- Keep the cow's nose tip aligned to the default anchor at (256,256) unless a recipe overrides it.
- Maintain consistent line weight, shading, and colour palette across all parts.
- Use lowercase snake_case names with category prefixes and no spaces.

Category notes
- Faces supply expressions (eyes, muzzle, mouth) and should overlay perfectly on every body variant.
- Anchor reference: align facial features to the nose at (256,256); eye positions should match the base body guides.
- Filename format: face_<expression>_<pose>.webp (for example, face_happy_idle.webp or face_sleepy_idle.webp).
- Provide blink or alternate mouth shapes using the same expression prefix (for example, face_happy_blink.webp).
