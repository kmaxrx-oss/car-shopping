# Car Search Harness Extension Scaffold

This folder is the first browser-extension project leg for Car Search Homebase. The existing static `index.html` app remains the working prototype and is not replaced by this scaffold.

## Verified extension API path

- Chrome extension manifests must live at the extension root as `manifest.json`.
- Manifest V3 uses `"manifest_version": 3`.
- Chrome side panels use the `"side_panel"` manifest key with a `"default_path"` inside the extension package.
- Chrome side panel support is Chrome 114+ and uses the `"sidePanel"` permission.
- Manifest V3 background logic runs through a service worker.

Evidence: Chrome Developers docs for Manifest V3, `chrome.sidePanel`, and background service workers.

## Architecture direction

- `sidepanel/`: left-side controller UI for the browser-extension harness.
- `background/`: extension lifecycle and side-panel behavior.
- `shared/platforms.js`: platform registry and search URL builder contract.
- `shared/storage.js`: current storage keys plus future adapter boundary.
- `shared/saved-cars.js`: saved-car field contract mirrored from the static app.

## Current seam map

| Existing seam | File | Name | Responsibility | Evidence | Extension action |
| --- | --- | --- | --- | --- | --- |
| Model/search link generation | `app.js` | `buildMarketplaceUrl()`, `getCardUrl()`, `renderTierSections()` | Builds Facebook Marketplace URLs for manual, model-card, and helper links. | LOCAL_MIRROR | Mirror Facebook builder in `shared/platforms.js`; defer extraction until extension behavior stabilizes. |
| Global controls state | `app.js`, `index.html` | `state`, `syncStateFromControls()`, `min-price`, `max-price`, `radius`, `days-listed`, `exact-toggle` | Holds active tier/search filters and applies them to generated links. | LOCAL_MIRROR | Mirror the active filter shape in sidepanel placeholders; later move shared state into `extension/shared/`. |
| ZIP/region | `app.js`, `docs/url-format.md` | `baseUrl`, fixed Marketplace location id `103108469729444` | Current app has no ZIP field; region is encoded in the Facebook base URL and radius is user-controlled. | BLOCKED | Scaffold ZIP input and recent ZIP placeholder only; define no migration yet. |
| Saved-car storage key and payload | `app.js` | `savedCarsStorageKey`, `normalizeSavedCar()`, `handleSavedCarSubmit()` | Stores saved cars in `localStorage` under `carShopping.savedCars.v1` with the existing field shape. | LOCAL_MIRROR | Preserve key and field list in `shared/storage.js` and `shared/saved-cars.js`; document future `chrome.storage.local` migration. |
| Smart Capture / URL parser flow | `app.js` | `parseSavedCarCapture()`, `isUrlOnlyCapture()`, `prefillSavedCarFormFromCapture()`, `handleSavedCarCaptureUse()` | Parses pasted/dropped text or URL, pre-fills form, and keeps source text. | LOCAL_MIRROR | Preserve parser flow as a future shared module candidate; do not rebuild in scaffold. |
| Reader/local capture endpoint | `app.js`, `tools/listing-reader` | `listingReaderEndpoint`, `readListingFromLocalReader()`, `/read-listing` | Optional local reader enriches URL-only captures; static app still works without it. | LOCAL_MIRROR | Keep as future optional extension-to-local-service integration; no background automation in this scaffold. |
| Sidebar/toolbox UI | `index.html`, `styles.css`, `app.js` | `#toolbox`, `#saved-cars-panel`, drag/drop listeners | Existing saved-car/capture UI lives in the static app toolbox. | LOCAL_MIRROR | Sidepanel creates a separate extension UI shell; does not replace static toolbox. |
| Reuse/move candidates | `app.js` | `buildMarketplaceUrl()`, `parseSavedCarCapture()`, `normalizeSavedCar()`, `savedCarStatuses` | Logic likely needed by both static app and extension. | LOCAL_MIRROR | Mirror narrowly now; defer extraction to avoid destabilizing static app. |

## Platform registry contract

Each platform entry in `shared/platforms.js` includes:

- `label`
- `supportsZip`
- `supportsRadius`
- `buildSearchUrl(filters)`

Facebook is the default platform and has the only real URL builder in this scaffold. Cars.com, eBay, Craigslist, and Autotrader return explicit `not_implemented` results until each platform URL contract is verified.

## First browser-tab action

The side panel now has active search controls for:

- query/model text
- min price
- max price
- min year
- radius
- days listed
- exact match
- active ZIP placeholder

The active ZIP field is present for the extension path, but Facebook still uses the static app's fixed Marketplace location id in the mirrored URL builder. Clicking `Search Facebook` sends an `OPEN_SEARCH_TAB` message to the extension service worker. The service worker validates that the URL is a Facebook Marketplace URL, then opens a Facebook Marketplace tab.

Tab reuse is best-effort in this tranche. The service worker keeps the Facebook tab id it created and updates that tab on the next search while the id is available. If the tab is closed or the worker has lost that in-memory id, it opens a new tab. Durable tab tracking is intentionally deferred.

## Saved cars preservation

The current saved-car data shape remains the compatibility target:

`id`, `title`, `url`, `price`, `location`, `sellerName`, `mileage`, `transmission`, `fuelType`, `description`, `imageUrl`, `readStatus`, `statusHint`, `status`, `notes`, `sourceText`, `createdAt`, `updatedAt`

The static app currently uses browser `localStorage` under `carShopping.savedCars.v1`. A future extension version may migrate this into `chrome.storage.local`, but that should be an explicit migration and compatibility step, not a silent replacement.

## Deferred work

- Full Cars.com, eBay, Craigslist, and Autotrader URL builders.
- Content scripts, page scraping, login handling, credentials, background loops, scheduled checks, and bulk processing.
- Moving static app code into shared modules.
- Saved-car storage migration.
