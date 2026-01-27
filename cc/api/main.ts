// Entry point - Hono router for Deno Deploy with device-ID based sync
import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { serveStatic } from "jsr:@hono/hono/deno";

const app = new Hono();
const kv = await Deno.openKv();

// CORS middleware - allow all origins for this simple app
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "PUT", "PATCH", "HEAD", "OPTIONS"],
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

// Withings OAuth callback - HEAD for URL verification
app.on("HEAD", "/callback", (c) => {
  return c.body(null, 200);
});

// Withings OAuth callback - GET for actual OAuth flow
app.get("/callback", (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  // Handle actual OAuth callback (with code)
  if (code) {
    return c.html(`
      <html>
        <body style="font-family: monospace; padding: 40px;">
          <h2>Withings Authorization</h2>
          <p><strong>Code:</strong></p>
          <pre style="background: #f0f0f0; padding: 10px; user-select: all;">${code}</pre>
          ${state ? `<p><strong>State:</strong> ${state}</p>` : ""}
          <p>Copy this code and paste it in your terminal.</p>
        </body>
      </html>
    `);
  }

  // Handle Withings URL verification (no code parameter)
  return c.html(`
    <html>
      <head><title>Callback Ready</title></head>
      <body>
        <h1>OK</h1>
        <p>Callback endpoint is ready.</p>
      </body>
    </html>
  `);
});

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

// PATCH /state/:id/daily/:date - update daily data for a specific date
app.patch("/state/:id/daily/:date", async (c) => {
  const id = c.req.param("id");
  const date = c.req.param("date");

  if (!id || id.length < 10) {
    return c.json({ error: "Invalid device ID" }, 400);
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format (use YYYY-MM-DD)" }, 400);
  }

  try {
    const body = await c.req.json();

    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid data" }, 400);
    }

    // Get existing state
    const result = await kv.get(["state", id]);
    if (!result.value) {
      return c.json({ error: "Device state not found" }, 404);
    }

    const existing = result.value as { state: Record<string, unknown>; lastUpdated: number };
    const state = existing.state;

    // Ensure dailyData exists
    if (!state.dailyData || typeof state.dailyData !== "object") {
      state.dailyData = {};
    }

    // Update the specific date's data
    const dailyData = state.dailyData as Record<string, unknown>;
    dailyData[date] = {
      ...((dailyData[date] as Record<string, unknown>) || {}),
      ...body,
      date: date,
    };

    // Save updated state
    const data = {
      state: state,
      lastUpdated: Date.now(),
    };

    await kv.set(["state", id], data);

    return c.json({
      ok: true,
      date: date,
      dailyData: dailyData[date],
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    console.error("Error updating daily data:", error);
    return c.json({ error: "Failed to update daily data" }, 500);
  }
});

// Serve static files from parent directory (cc/) for local development
app.get("/*", serveStatic({ root: ".." }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ path: "../index.html" }));

Deno.serve(app.fetch);
