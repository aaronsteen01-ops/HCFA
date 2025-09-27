Highland Cow Factory – Placeholder Sprites

Shared sprite rules
- Canvas size: 512×512 pixels with a fully transparent background.
- Export sprites as lossless .webp files that preserve alpha.
- Keep the cow's nose tip aligned to the default anchor at (256,256) unless a recipe overrides it.
- Maintain consistent line weight, shading, and colour palette across all parts.
- Use lowercase snake_case names with category prefixes and no spaces.

Category notes
- Placeholder sprites are temporary stand-ins generated from simple vector shapes until production art lands.
- Anchor reference: mimic the base category anchor when generating each placeholder so layering tests remain accurate.
- Filename format: placeholder_<category>_<variant>.webp (for example, placeholder_body_idle.webp, placeholder_face_happy.webp).
- Save assets as base64-encoded .webp data URIs when committing quick prototypes; replace them with final art before launch.
