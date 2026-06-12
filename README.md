# Car Search Homebase

This repository is a local desktop-first static app for building Facebook Marketplace car search links from a preserved tiered vehicle model pool.

## What it is

- A simple HTML/CSS/JavaScript home base for car searching
- A local URL builder for Facebook Marketplace searches
- A local Saved Cars shortlist stored in your browser
- A Smart Capture helper for pasted or dropped Marketplace text blocks
- An optional local listing-reader companion service for URL-only capture
- A structured seed data file for tier, make group, and model family context

## What it is not

- A scraper
- A Facebook automation tool
- A login/session helper
- A required backend service
- A database-backed app

## How to open it locally

Open `index.html` directly in a browser from this folder.

The app is fully static and uses the local `data/vehicles.js` file plus `app.js`.

## Saved Cars

The sidebar toolbox includes one expandable section: `Saved Cars`.

Saved cars are stored in browser `localStorage` under:

`carShopping.savedCars.v1`

Each saved car stores:

- `id`
- `title`
- `url`
- `price`
- `location`
- `sellerName`
- `status`
- `notes`
- `sourceText`
- `createdAt`
- `updatedAt`

This is manual shortlist storage only. Smart Capture parses user-provided pasted or dropped text locally in the browser. If the optional local listing reader is running, URL-only capture can ask it for best-effort structured fields. The app does not inspect, scrape, fetch, or monitor saved listing URLs by itself.

## Optional listing reader

The local reader lives in `tools/listing-reader/`.

Start the service:

```powershell
cd tools/listing-reader
npm install
npm start
```

The service listens on:

`http://localhost:3137/read-listing`

For local contract testing without opening Facebook:

```powershell
cd tools/listing-reader
$env:LISTING_READER_MOCK='1'
npm start
```

The main app still works when this service is off. URL-only Smart Capture will keep the URL and show a reader-unavailable message.

## How the URL builder works

The app keeps the Facebook Marketplace base path and fixed parameters in one place, then replaces only:

- `query`
- `minYear`

It also applies the current global filters:

- `minPrice`
- `maxPrice`
- `radius`
- `daysSinceListed`
- `exact`

The base Marketplace location and category values stay fixed for this tranche.

## Files of interest

- `index.html`: app shell and controls
- `styles.css`: desktop-first layout, toolbox lane, and card styling
- `app.js`: renders the data, builds Marketplace links, manages Saved Cars localStorage, parses Smart Capture input, and optionally calls the local reader
- `tools/listing-reader/`: optional local reader API prototype
- `data/vehicles.js`: static tiered vehicle model seed data
- `PROJECT_STATE.md`: preserved scope and rules for the current tranche
- `docs/url-format.md`: Facebook URL parameter reference
- `docs/tier-logic.md`: tier logic and ordering rules
