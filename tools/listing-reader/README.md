# Listing Reader Prototype

This is an optional local companion service for Car Search Homebase.

It exposes:

`POST http://localhost:3137/read-listing`

Request:

```json
{
  "url": "https://www.facebook.com/marketplace/item/..."
}
```

Response shape:

```json
{
  "readStatus": "ok",
  "title": "",
  "price": "",
  "location": "",
  "sellerName": "",
  "mileage": "",
  "transmission": "",
  "fuelType": "",
  "description": "",
  "imageUrl": "",
  "statusHint": "",
  "unavailable": false,
  "rawText": ""
}
```

## Start locally

```powershell
cd tools/listing-reader
npm install
npm start
```

For endpoint contract testing without launching Facebook:

```powershell
cd tools/listing-reader
$env:LISTING_READER_MOCK='1'
npm start
```

## Notes

- The main app still works when this service is not running.
- The reader is user-triggered only.
- It does not store credentials, tokens, passwords, or cookies in this repo.
- Real Facebook reads may require a normal browser session or may fail behind login/unavailable pages.
- The first reader favors rendered visible text and accessibility data over CSS selectors.
