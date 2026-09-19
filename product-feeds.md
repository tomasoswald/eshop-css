# Product feed registry — Fitnessio

## Dafit

- Feed URL: https://xml.golemos.com/dafit.php
- Meaning: products originating from the Dafit supplier feed; this is NOT the same as products whose brand/manufacturer is Dafit.
- Usage: when a request refers to "produkty z feedu Dafit", use this feed as the source of truth and match its products to Fitnessio using stable identifiers discovered from the feed (EAN/SKU/item ID/etc.).
- Added: 2026-09-19

## Kulturistika

- Feed URL: http://xml.golemos.com/kulturistika.php
- Meaning: products originating from the Kulturistika supplier feed.
- Usage: use the feed as the source of truth for supplier-feed membership and match products to Fitnessio using stable identifiers such as EAN/SKU/item ID.
- Added: 2026-09-19

## GymBeam Fitnessio

- Feed URL: https://xml.golemos.com/gymbeamfitnessio.php
- Meaning: products originating from the GymBeam feed prepared for Fitnessio.
- Usage: use the feed as the source of truth for supplier-feed membership and match products to Fitnessio using stable identifiers such as EAN/SKU/item ID.
- Added: 2026-09-19

Do not infer feed membership from product brand or product name.


## Dafit description transformation — persistence requirement

For products originating from the Dafit feed, long ingredient/composition sections in product descriptions should be rendered as a compact professional Fitnessio-styled table (ingredient/value columns) and the rest of the description should receive consistent professional Fitnessio styling.

Persistence rule: do NOT solve this by manually editing imported product descriptions if a later feed synchronization can overwrite them. The durable implementation must live outside the feed-owned description data (e.g. storefront rendering/transformation layer keyed to Dafit-feed products), so every feed refresh continues to display the transformed version.

Reference screenshot received 2026-09-19: example composition text includes rows such as "Kreatin monohydrát 8000 mg", "L-Leucin – EAA 3000 mg", etc.


## Fitnessio auto-import roles

Fitnessio uses two logical feed roles in Eshop-rychle auto-import:

- **Master (kmenový) feed** — authoritative source for product existence and base product data. It creates new products and products no longer present in the master feed may be removed by the configured auto-import. The three registered supplier URLs above are treated as master-feed sources for the current audit unless explicitly documented otherwise.
- **Update (aktualizační) feed** — updates existing products, primarily **availability and price**. It is not the source of truth for product existence or categorization.

### Processing rules

1. Use the **master feed** to build the product universe and as input for category proposals.
2. Use the **update feed** only for fields it owns (currently price and availability); it must not be used to decide category membership.
3. Match master/update/e-shop records primarily by normalized **EAN**.
4. A matching EAN across feeds represents the same product for audit/merge purposes; keep source-feed provenance and never auto-delete merely because a duplicate was found.
5. Products without a usable EAN remain separate and require another stable identifier or manual review; never merge them by similar product name alone.
6. Category assignments should be maintained independently from update-feed price/availability synchronization so routine updates do not overwrite categorization.

Documented from the current Fitnessio auto-import setup on 2026-09-19. The exact update-feed URLs are not yet registered here.
