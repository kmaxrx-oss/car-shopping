# Car Search Homebase

This repository is a local desktop-first static app for building Facebook Marketplace car search links from a preserved tiered vehicle model pool.

## What it is

- A simple HTML/CSS/JavaScript home base for car searching
- A local URL builder for Facebook Marketplace searches
- A local Saved Cars shortlist stored in your browser
- A Smart Capture helper for pasted or dropped Marketplace text blocks
- A structured seed data file for tier, make group, and model family context

## What it is not

- A scraper
- A Facebook automation tool
- A login/session helper
- A backend service
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

This is manual shortlist storage only. Smart Capture parses user-provided pasted or dropped text locally in the browser. The app does not inspect, scrape, fetch, or monitor saved listing URLs.

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
- `app.js`: renders the data, builds Marketplace links, manages Saved Cars localStorage, and parses Smart Capture input
- `data/vehicles.js`: static tiered vehicle model seed data
- `PROJECT_STATE.md`: preserved scope and rules for the current tranche
- `docs/url-format.md`: Facebook URL parameter reference
- `docs/tier-logic.md`: tier logic and ordering rules
