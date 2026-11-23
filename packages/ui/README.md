# UI

The design system (tokens, light and dark mode) and the reusable components the editor is built from, shown in Storybook. Built before the editor's features.

Licence: AGPL-3.0-or-later. See [LICENSE](LICENSE). Components based on shadcn/ui say so at the top; its MIT licence is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## View it in Storybook

Once, from the repo root, install everything:

```bash
npm install
```

Then start Storybook (from the repo root, or from this folder):

```bash
npm run storybook
```

It opens at http://localhost:6006. Start with **Start here** in the sidebar.

## What's where

| Path | What it is |
|---|---|
| `src/styles/tokens.css` | Scales (type sizes, spacing, timing) and the bridge to Tailwind |
| `src/styles/theme.css` | The look: colours (light and dark), corners, shadows, panel sizes |
| `src/styles/index.css` | The one stylesheet to import: Tailwind + tokens + theme |
| `src/components/` | The components, one folder each: the component, its Storybook page and its tests |
| `src/lib/` | Small helpers: joining class names, showing keyboard shortcuts per platform |
| `src/sample/` | The editor mock-up that shows the look on a real layout (throwaway) |
| `src/stories/` | Helpers for the Storybook pages |
| `src/tokens/` | The Tokens overview page in Storybook, and the token tests |
| `.storybook/` | Storybook settings |

Other checks: `npm run typecheck` (TypeScript), `npm test` (token, helper and component tests) and `npm run build-storybook` (a static copy of Storybook in `storybook-static/`). From the repo root, `npm run check` runs everything.
