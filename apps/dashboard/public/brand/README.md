# Brand assets (placeholders)

Every file here is a geometric stand-in for the real AppPilot mark. Replace the files in place; nothing
else needs to change.

| File | Used for | Spec |
|---|---|---|
| `mark-chalk.svg` | Mark on dark surfaces (nav, footer, docs) | Transparent background, Chalk `#F7F7F4` fill, any size (viewBox 48×40 today) |
| `mark-ink.svg` | Mark on light or Signal surfaces | Transparent background, Ink `#0C1117` fill |
| `mark-signal.svg` | Accent uses (empty states, loaders) | Transparent background, Signal `#B5EF67` fill |
| `wordmark-chalk.svg` | Mark + "AppPilot" lockup for README, slides, social | Transparent background, Chalk, ≥ 232×48 |
| `app-icon.svg` | Favicon and app icon source | Ink rounded square (radius ≈ 22%), Chalk mark centered, square |

Also used in the app:

- `app/icon.svg` is a copy of `app-icon.svg`; Next.js serves it as the favicon. Replace both.
- The nav renders the mark inline from `components/brand/logo.tsx` (`Mark`), so the real path data should also
  go into that component (keep `fill="currentColor"` so it inherits text color).

Optional, if you have them: `app/apple-icon.png` (180×180, Ink background) and `app/opengraph-image.png`
(1200×630) are picked up automatically by Next.js when present.
