# Brand assets

The app renders these files directly (`components/brand/logo.tsx`): replace a file and the UI updates,
no code changes needed. `wordmark-chalk.svg` is the nav lockup; `mark-*.svg` are used standalone.

| File | Used for | Spec |
|---|---|---|
| `mark-chalk.svg` | Mark on dark surfaces (nav, footer, docs) | Transparent background, Chalk `#F7F7F4` fill, any size (viewBox 48×40 today) |
| `mark-ink.svg` | Mark on light or Signal surfaces | Transparent background, Ink `#0C1117` fill |
| `mark-signal.svg` | Accent uses (empty states, loaders) | Transparent background, Signal `#B5EF67` fill |
| `wordmark-chalk.svg` | Mark + "AppPilot" lockup for README, slides, social | Transparent background, Chalk, ≥ 232×48 |
| `app-icon.svg` | Favicon and app icon source | Ink rounded square (radius ≈ 22%), Chalk mark centered, square |

Also used in the app:

- `app/icon.svg` is a copy of `app-icon.svg`; Next.js serves it as the favicon. Replace both.
- `Mark` and `Lockup` in `components/brand/logo.tsx` are `<img>` elements pointing at these files; size them
  with a height class and the width follows the file's aspect ratio.

Optional, if you have them: `app/apple-icon.png` (180×180, Ink background) and `app/opengraph-image.png`
(1200×630) are picked up automatically by Next.js when present.
