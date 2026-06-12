# Facebook Marketplace URL Format

The app builds links from this fixed Marketplace base:

`https://www.facebook.com/marketplace/103108469729444/search/`

Fixed parameters:

- `category_id=546583916084032`
- `minPrice=1500` by default
- `maxPrice=4000` by default
- `radius=100` by default
- `daysSinceListed=7` by default
- `sortBy=creation_time_descend`
- `exact=true` by default

Variable parameters:

- `query`: the model name or manual search text
- `minYear`: chosen from the active tier

Example build:

`https://www.facebook.com/marketplace/103108469729444/search/?query=Toyota+Camry&minPrice=1500&maxPrice=4000&minYear=2017&category_id=546583916084032&radius=100&daysSinceListed=7&sortBy=creation_time_descend&exact=true`

## Builder behavior

- The app never scrapes Facebook.
- The app never logs in to Facebook.
- The app only creates clickable search URLs.
- The active tier decides the `minYear` value for manual searches.
- Model cards can optionally add a helper term such as `hybrid` or `2.0T` when the seed data includes that term.
