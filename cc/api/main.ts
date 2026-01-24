// Entry point - Hono router for Deno Deploy with device-ID based sync
import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { serveStatic } from "jsr:@hono/hono/deno";

const app = new Hono();
const kv = await Deno.openKv();

// CORS middleware - allow all origins for this simple app
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "PUT", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} - ${ms}ms`);
});

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// GET /state/:id - fetch state for a device
app.get("/state/:id", async (c) => {
  const id = c.req.param("id");

  if (!id || id.length < 10) {
    return c.json({ error: "Invalid device ID" }, 400);
  }

  const result = await kv.get(["state", id]);

  if (!result.value) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(result.value);
});

// PUT /state/:id - save state for a device
app.put("/state/:id", async (c) => {
  const id = c.req.param("id");

  if (!id || id.length < 10) {
    return c.json({ error: "Invalid device ID" }, 400);
  }

  try {
    const body = await c.req.json();

    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid state data" }, 400);
    }

    const data = {
      state: body,
      lastUpdated: Date.now(),
    };

    await kv.set(["state", id], data);

    return c.json({ ok: true, lastUpdated: data.lastUpdated });
  } catch (error) {
    console.error("Error saving state:", error);
    return c.json({ error: "Failed to save state" }, 500);
  }
});

// Serve static files from parent directory (cc/) for local development
app.get("/*", serveStatic({ root: ".." }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ path: "../index.html" }));

Deno.serve(app.fetch);
