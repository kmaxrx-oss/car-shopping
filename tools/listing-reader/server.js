const http = require("http");
const { readListing } = require("./reader");

const port = Number(process.env.LISTING_READER_PORT || 3137);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function isAllowedListingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== "POST" || req.url !== "/read-listing") {
    sendJson(res, 404, { readStatus: "error", error: "Not found." });
    return;
  }

  try {
    const body = await readRequestJson(req);
    if (!isAllowedListingUrl(body.url)) {
      sendJson(res, 400, { readStatus: "error", error: "A valid http or https url is required." });
      return;
    }

    const result = await readListing(body.url);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, {
      readStatus: "error",
      error: error.message || "Listing reader failed.",
    });
  }
});

server.listen(port, () => {
  console.log(`Listing reader listening on http://localhost:${port}`);
});
