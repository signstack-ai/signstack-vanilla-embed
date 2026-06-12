import express from "express";
import cors from "cors";

// SignStack API base URL — hardcoded. It MUST match the API the web-component
// bundle was built against (the bundle has its backend host baked in at build
// time). This sample's frontend loads the `signstack-prod` bundle from GCS, so
// the URL below points at the matching prod API.
const SIGNSTACK_API_URL =
  "https://signstack-prod-api-660507309867.us-west1.run.app";

// Everything else comes from system environment variables (no .env file).
//   SIGNSTACK_API_KEY  (required) — keep server-side only, never ship to a browser
//   PORT               (optional) — defaults to 4000
//   CORS_ORIGINS       (optional) — comma-separated; localhost is always allowed
const { SIGNSTACK_API_KEY, PORT = 4000, CORS_ORIGINS = "" } = process.env;

if (!SIGNSTACK_API_KEY) {
  console.error(
    "[signstack-sample-backend] Missing SIGNSTACK_API_KEY. Set it as an environment variable before starting.",
  );
  process.exit(1);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const INTENT_MAP = Object.freeze({
  participant: "participant",
  workflow: "workflow",
  builder: "builder",
});

const VALID_RESOURCE_KINDS = Object.freeze([
  "blueprint",
  "template",
  "schema",
  "asset",
  "jsonata_function",
]);

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowedOrigins = CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Single-flight cache for the service-account access token. Two parallel
 * requests arriving when the cache is empty/expired should share one fetch.
 */
let cachedToken = null; // { accessToken, orgId, expiresAt }
let tokenRefreshInFlight = null;

async function fetchAccessToken() {
  const res = await fetch(`${SIGNSTACK_API_URL}/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "api_key", apiKey: SIGNSTACK_API_KEY }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(
      res.status,
      `Failed to exchange API key for access token: ${body}`,
    );
  }
  const data = await res.json();
  const { orgId, namespaceKey } = data.subject ?? {};
  if (!orgId || !namespaceKey) {
    throw new HttpError(
      500,
      "Access token response missing orgId/namespaceKey",
    );
  }
  return {
    accessToken: data.accessToken,
    orgId,
    namespaceKey,
    expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
  };
}

async function getServiceAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken;
  }
  if (!tokenRefreshInFlight) {
    tokenRefreshInFlight = fetchAccessToken()
      .then((t) => {
        cachedToken = t;
        return t;
      })
      .finally(() => {
        tokenRefreshInFlight = null;
      });
  }
  return tokenRefreshInFlight;
}

function buildEmbedRequest(body) {
  const {
    component,
    workflowId,
    stepKey,
    resourceKey,
    resourceKind,
    version,
    allowedOrigins: reqOrigins,
    expiresIn,
  } = body;
  const intent = INTENT_MAP[component];
  if (!intent) {
    throw new HttpError(
      400,
      `Unknown component "${component}". Expected one of: ${Object.keys(INTENT_MAP).join(", ")}`,
    );
  }
  if (!Array.isArray(reqOrigins) || reqOrigins.length === 0) {
    throw new HttpError(
      400,
      'allowedOrigins is required (e.g. ["https://example.com"])',
    );
  }

  const base = { intent, allowedOrigins: reqOrigins };
  if (expiresIn) base.expiresIn = expiresIn;

  switch (intent) {
    case "participant":
      if (!workflowId || !stepKey)
        throw new HttpError(
          400,
          "workflowId and stepKey are required for participant tokens",
        );
      return { ...base, workflowId, stepKey };
    case "workflow":
      if (!workflowId)
        throw new HttpError(400, "workflowId is required for workflow tokens");
      return { ...base, workflowId };
    case "builder":
      if (
        !resourceKey ||
        !resourceKind ||
        !VALID_RESOURCE_KINDS.includes(resourceKind)
      ) {
        throw new HttpError(
          400,
          `resourceKey and a valid resourceKind are required for builder tokens (expected one of: ${VALID_RESOURCE_KINDS.join(", ")})`,
        );
      }
      return {
        ...base,
        resourceKey,
        resourceKind,
        ...(version ? { resourceVersion: version } : {}),
      };
    default:
      throw new HttpError(400, "Unsupported intent");
  }
}

async function mintEmbedToken(embedBody, accessToken, orgId, namespaceKey) {
  const url = `${SIGNSTACK_API_URL}/v1/orgs/${orgId}/namespaces/${namespaceKey}/auth/embed`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(embedBody),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new HttpError(res.status, detail || "Embed token request failed");
  }
  return res.json();
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || LOCALHOST_ORIGIN.test(origin))
        return cb(null, true);
      cb(null, false);
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apiUrl: SIGNSTACK_API_URL });
});

app.post("/api/embed-token", async (req, res, next) => {
  try {
    const embedBody = buildEmbedRequest(req.body ?? {});
    const { accessToken, orgId, namespaceKey } = await getServiceAccessToken();
    const tokenResp = await mintEmbedToken(
      embedBody,
      accessToken,
      orgId,
      namespaceKey,
    );
    res.json({
      embedToken: tokenResp.accessToken,
      orgId: tokenResp.orgId ?? orgId,
      expiresIn: tokenResp.expiresIn,
      expiresAt: tokenResp.expiresAt,
      scopes: tokenResp.scopes,
    });
  } catch (err) {
    next(err);
  }
});

// 404 fallthrough
app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// Centralised error handler. Using an arrow would drop Express's 4-arg signature.
app.use(function onError(err, _req, res, _next) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error("[signstack-sample-backend]", err);
  res.status(status).json({ error: err.message || "internal_error" });
});

const server = app.listen(PORT, () => {
  console.log(
    `[signstack-sample-backend] listening on http://localhost:${PORT}`,
  );
  console.log(`[signstack-sample-backend] SignStack API: ${SIGNSTACK_API_URL}`);
});

function shutdown(signal) {
  console.log(`[signstack-sample-backend] received ${signal}, closing…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
