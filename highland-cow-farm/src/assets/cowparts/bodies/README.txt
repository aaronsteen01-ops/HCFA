Highland Cow Factory – Bodies

Shared sprite rules
- Canvas size: 512×512 pixels with a fully transparent background.
- Export sprites as lossless .webp files that preserve alpha.
- Keep the cow's nose tip aligned to the default anchor at (256,256) unless a recipe overrides it.
- Maintain consistent line weight, shading, and colour palette across all parts.
- Use lowercase snake_case names with category prefixes and no spaces.

Category notes
- Bodies provide the base coat, pose, and silhouette for every cow and must include the full torso, legs, and tail.
- Anchor reference: body alignment keeps the nose at (256,256); hooves should stay within the canvas bounds.
- Filename format: body_<coat>_<pose>.webp (for example, body_brown_idle.webp or body_cream_walk.webp).
- Optional variants can include motion states such as _blink, _walk, or _sit, but keep poses consistent with the manifest.
