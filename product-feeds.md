# Product feed registry — Fitnessio

## Dafit

- Feed URL: https://xml.golemos.com/dafit.php
- Meaning: products originating from the Dafit supplier feed; this is NOT the same as products whose brand/manufacturer is Dafit.
- Usage: when a request refers to "produkty z feedu Dafit", use this feed as the source of truth and match its products to Fitnessio using stable identifiers discovered from the feed (EAN/SKU/item ID/etc.).
- Added: 2026-09-19

Do not infer feed membership from product brand or product name.


## Dafit description transformation — persistence requirement

For products originating from the Dafit feed, long ingredient/composition sections in product descriptions should be rendered as a compact professional Fitnessio-styled table (ingredient/value columns) and the rest of the description should receive consistent professional Fitnessio styling.

Persistence rule: do NOT solve this by manually editing imported product descriptions if a later feed synchronization can overwrite them. The durable implementation must live outside the feed-owned description data (e.g. storefront rendering/transformation layer keyed to Dafit-feed products), so every feed refresh continues to display the transformed version.

Reference screenshot received 2026-09-19: example composition text includes rows such as "Kreatin monohydrát 8000 mg", "L-Leucin – EAA 3000 mg", etc.
