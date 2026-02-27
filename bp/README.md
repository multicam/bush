# Bush BP (Back-Pressure) Testing System

End-to-end use case testing against the real UI, with design quality comparison against agno.com.

## Quick Start

```bash
# 1. Seed the demo database
bun run bp:seed

# 2. Generate media fixtures (requires ffmpeg)
bun run bp:fixtures

# 3. Start dev server with DEMO_MODE
DEMO_MODE=true bun run dev

# 4. Run all BP tests (in another terminal)
bun run bp:test

# 5. Run headed (see the browser)
bun run bp:test:headed

# 6. View HTML report
bun run bp:report
```

## Structure

```
bp/
├── playwright.config.ts       # BP-specific Playwright config
├── helpers/
│   ├── demo-auth.ts           # Shared fixture (auto-navigates to dashboard)
│   └── screenshot.ts          # Screenshot capture helper
├── fixtures/
│   ├── generate-fixtures.sh   # Generates sample media via ffmpeg
│   └── media/                 # Generated fixtures (video, image, audio, pdf)
├── specs/
│   ├── 00-agno-capture.spec   # Agno.com reference screenshots
│   ├── 01-home-page.spec      # UC-01 through UC-17
│   └── ...
├── screenshots/
│   ├── bush/                  # Auto-captured during test runs
│   ├── agno/                  # Reference screenshots (manual + auto)
│   └── comparison-notes.md    # Side-by-side comparison table
├── GAP_REPORT.md              # Master findings document
└── README.md                  # This file
```

## Use Cases (17 specs)

| # | Use Case | Complexity |
|---|----------|-----------|
| 01 | View home page | Simple |
| 02 | Demo login | Simple |
| 03 | View dashboard | Simple |
| 04 | Navigate projects | Simple |
| 05 | Create workspace | Medium |
| 06 | Create project | Medium |
| 07 | Upload video | Medium |
| 08 | Upload mixed media | Medium |
| 09 | Browse files (grid/list) | Medium |
| 10 | Search files | Medium |
| 11 | Video viewer + controls | Complex |
| 12 | Time-stamped comments | Complex |
| 13 | Share link + public page | Complex |
| 14 | Collections | Complex |
| 15 | Version stacking | Complex |
| 16 | Keyboard shortcuts | Complex |
| 17 | Notifications | Complex |

## DEMO_MODE

When `DEMO_MODE=true`:
- Next.js middleware passes all requests through (no WorkOS auth)
- `/api/auth/session` returns a demo user (Alice Chen, owner of Alpha Studios)
- `/api/auth/login` redirects straight to `/dashboard`
- API auth middleware returns a demo session for all requests
- All seeded data is accessible without real authentication

## Workflow

1. Run BP tests → screenshots auto-captured to `bp/screenshots/bush/`
2. Compare against `bp/screenshots/agno/` reference images
3. Document findings in `GAP_REPORT.md`
4. Feed gaps back into specs and `IMPLEMENTATION_PLAN.md`
