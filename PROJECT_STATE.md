# Project State

## Current goal

Create a local car-search homebase that preserves the vehicle tier and model context, generates clickable Facebook Marketplace search URLs, provides a manual Saved Cars shortlist, supports local Smart Capture from pasted listing text, and can optionally use a local listing-reader companion service for URL-only capture.

## Current tier logic

- Tier A: 2017+ models
- Tier B: 2013+ models
- Tier C: 2005+ models

Overlap is allowed across tiers. Models may appear in every tier where a relevant version exists.

## Facebook URL format

Base pattern:

`https://www.facebook.com/marketplace/103108469729444/search/?query=hybrid&minPrice=1500&maxPrice=4000&minYear=2013&category_id=546583916084032&radius=100&daysSinceListed=7&sortBy=creation_time_descend&exact=true`

The app preserves the fixed Marketplace location, category, radius, price range, sort order, and exact-match setting while replacing `query` and `minYear` from the selected model or manual query.

## Saved Cars storage

The first toolbox feature is `Saved Cars`.

Storage key:

`carShopping.savedCars.v1`

Stored object shape:

- `id`
- `title`
- `url`
- `price`
- `location`
- `sellerName`
- `mileage`
- `transmission`
- `fuelType`
- `description`
- `imageUrl`
- `readStatus`
- `statusHint`
- `status`
- `notes`
- `sourceText`
- `createdAt`
- `updatedAt`

This is browser-local `localStorage` only. Saved listing URLs are opened manually by the user, and Smart Capture parses user-provided pasted or dropped text.

## Optional listing reader

The first local reader prototype lives under:

`tools/listing-reader/`

Endpoint:

`POST http://localhost:3137/read-listing`

The main static app remains usable when the reader is not running. For URL-only capture, the app tries the reader with a timeout, then falls back to URL-only capture with a visible message.

The reader is local-only, user-triggered, and does not store credentials, tokens, passwords, or cookies in this repo.

## Ordering heuristic

Model families are ordered within each make group by:

1. Leg room / roominess
2. 4-cylinder preference
3. Clearance / crossover utility
4. Power

The app does not turn that heuristic into a scoring engine. It is only used to organize the seed list.

## Intentionally out of scope

- Scraping
- Backend server
- Database
- Authentication
- Facebook automation
- Credential storage
- Listing ingestion
- Background scraping loops
- Bulk crawling
- Scheduled checking
- Price analysis
- Ranking/scoring algorithm
- Sold/removed listing detection
- Browser extension or bookmarklet behavior
- Vehicle-detail research expansion beyond preserving the seed structure
