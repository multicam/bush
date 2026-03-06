# Decisions — catalyst-migration

## [2026-03-05] Session Start
- Big-bang migration: all 27 Catalyst components replace 17 old ones in one pass
- Token bridge: keep semantic CSS tokens, switch selectors from [data-theme] to .dark
- Dark default: .dark class on <html> by default; light = remove class
- @custom-variant dark (&:where(.dark, .dark *)) required in theme.css
- SpinnerIcon: custom inline SVG, no Lucide dependency
- Modal has 0 consumers — 6+ inline dialogs are the real migration target
- Toast/Tooltip/Skeleton/KeyboardLegend: kept but not restyled (0 consumers)
- Catalyst ZIP: /home/jean-marc/Downloads/catalyst-ui-kit.zip
- Bush accent: #ff4017 → --color-bush-500 in @theme
