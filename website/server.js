const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const BOTS_FILE = path.join(ROOT, "data", "bots.json");
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
    res.writeHead(status, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(body));
}

function readBots() {
    const bots = JSON.parse(fs.readFileSync(BOTS_FILE, "utf8"));
    if (!Array.isArray(bots)) {
        throw new Error("The bot directory must be a JSON array.");
    }

    return bots;
}

function serveStatic(req, res, pathname) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        sendJson(res, 400, { error: "Invalid URL path." });
        return;
    }

    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
    const filePath = path.resolve(PUBLIC_DIR, relativePath);
    if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
        sendJson(res, 404, { error: "Not found." });
        return;
    }

    fs.readFile(filePath, (error, contents) => {
        if (error) {
            if (error.code === "ENOENT" || error.code === "EISDIR") {
                sendJson(res, 404, { error: "Not found." });
                return;
            }
            console.error("[website] Failed to read a public file:", error);
            sendJson(res, 500, { error: "Unable to load this page." });
            return;
        }

        res.writeHead(200, {
            "Cache-Control": "no-cache",
            "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
        });
        res.end(req.method === "HEAD" ? undefined : contents);
    });
}

const server = http.createServer((req, res) => {
    let requestUrl;
    try {
        requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
        sendJson(res, 400, { error: "Invalid request URL." });
        return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "Method not allowed." }));
        return;
    }

    if (requestUrl.pathname === "/api/bots") {
        try {
            sendJson(res, 200, readBots());
        } catch (error) {
            console.error("[website] Failed to load the bot directory:", error);
            sendJson(res, 500, { error: "Unable to load the bot directory." });
        }
        return;
    }

    if (requestUrl.pathname === "/api/health") {
        sendJson(res, 200, {
            status: "online",
            service: "Euphie website",
            timestamp: new Date().toISOString(),
        });
        return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "API endpoint not found." });
        return;
    }

    serveStatic(req, res, requestUrl.pathname);
});

server.on("error", (error) => {
    console.error("[website] HTTP server error:", error);
    process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
    console.log(`[website] Listening on http://${HOST}:${PORT}`);
});
