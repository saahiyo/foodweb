# Swiggy Clone with Local Proxy

This project is a lightweight Swiggy-inspired food delivery UI for Mumbai, backed by a small Express proxy that fetches live listing data from Swiggy's public web endpoints.

The frontend renders:

- a "What's on your mind?" cuisine carousel
- a top restaurant brands carousel
- a restaurant grid with infinite scroll
- loading skeletons and a fallback mock dataset when the proxy is unavailable

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express
- Axios

## How It Works

The browser UI in `index.html` calls a local Express server in `server.js`.

That server:

- serves the static frontend files
- proxies requests to Swiggy's listing endpoints
- keeps cookies between requests to preserve session state
- exposes a pagination endpoint for infinite scrolling

The frontend logic in `script.js` renders the response, deduplicates restaurant IDs, and appends more restaurants as the user scrolls.

## Features

- Swiggy-style responsive landing page
- Live restaurant listing data for Mumbai coordinates
- Infinite scroll using `nextOffset` and `widgetOffset`
- Session cookie handling in the proxy
- Skeleton loaders for initial render
- Mock-data fallback if the backend cannot be reached

## Project Structure

- `index.html`: main page markup
- `style.css`: page styling
- `script.js`: frontend rendering, scrolling, pagination, and fallback data
- `server.js`: Express proxy server and API endpoints
- `debug.js`: helper script for inspecting pagination responses
- `page_offset.json`: stored sample pagination metadata

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run

```bash
npm start
```

Then open:

```text
http://localhost:3000/index.html
```

## Available Scripts

- `npm start`: starts the Express server on port `3000`
- `node debug.js`: hits the local API, writes pagination info to `page_offset.json`, and tests the update endpoint

## Local API Endpoints

- `GET /api/restaurants`
  Fetches the initial restaurant listing and stores response cookies.

- `POST /api/restaurants/update`
  Fetches the next page of restaurants using pagination values from the previous response.

Example request body:

```json
{
  "nextOffset": "",
  "widgetOffset": {},
  "filters": {},
  "seoParams": {}
}
```

## Notes

- The current coordinates are hardcoded in `server.js` for Mumbai:
  - `lat = 19.07480`
  - `lng = 72.88560`
- If the live proxy request fails, the app falls back to the mock dataset embedded in `script.js`.
- This project is not an official Swiggy application.

## Known Limitations

- Data depends on the current behavior of Swiggy's public web endpoints and may break if their API structure changes.
- Filters in the UI are currently presentational and are not wired to backend filtering logic.
- The app is built as a simple local project and does not include tests.

## License

ISC
