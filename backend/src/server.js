import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import ordersRouter from "./routes/orders.js";
import enquiriesRouter from "./routes/enquiries.js";
import adminRouter from "./routes/admin.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================
// BASIC SERVER SECURITY
// ============================================

app.disable("x-powered-by");

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// ============================================
// CORS
// ============================================
//
// Development:
//   http://localhost:5173
//   http://127.0.0.1:5173
//
// Production:
//   Set FRONTEND_URLS in backend .env:
//
//   FRONTEND_URLS=https://your-frontend-domain.com
//
// Multiple production URLs can be separated by commas.

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const configuredOrigins = (
  process.env.FRONTEND_URLS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : defaultOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header.
      // This supports tools such as curl/Postman and
      // server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin not allowed by CORS.")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    optionsSuccessStatus: 204,

    credentials: false,
  })
);

// ============================================
// SECURITY HEADERS
// ============================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// ============================================
// REQUEST BODY LIMITS
// ============================================
//
// These limits apply to JSON/urlencoded requests.
//
// IMPORTANT:
// Multipart document uploads are handled by
// multer inside orders.js and therefore continue
// using the existing file limits there.

app.use(
  express.json({
    limit: "1mb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
  })
);

// ============================================
// GENERAL API RATE LIMIT
// ============================================
//
// 300 requests per 15 minutes per client.
//
// This protects the API from excessive automated
// requests without interfering with normal usage.

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 300,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    status: "error",
    message:
      "Too many requests. Please try again later.",
  },

  handler(req, res, next, options) {
    return res
      .status(options.statusCode)
      .json(options.message);
  },

  skip(req) {
    return req.path === "/health";
  },
});

// ============================================
// ADMIN LOGIN RATE LIMIT
// ============================================
//
// Much stricter than the general API limit.
//
// 5 login attempts per 15 minutes.

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    status: "error",
    message:
      "Too many login attempts. Please try again later.",
  },

  handler(req, res, next, options) {
    return res
      .status(options.statusCode)
      .json(options.message);
  },
});

// Apply general API protection.

app.use(
  "/api",
  apiLimiter
);

// Apply stricter protection specifically to
// the admin login endpoint.

app.use(
  "/api/admin/login",
  adminLoginLimiter
);

// ============================================
// ROOT
// ============================================

app.get("/", (req, res) => {
  return res.json({
    status: "ok",
    message:
      "A&A Online Services backend is running",
    environment: NODE_ENV,
  });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {
  return res.json({
    status: "ok",
    message:
      "A&A Online Services backend is running",
  });
});

// ============================================
// API ROUTES
// ============================================

// Customer orders + protected admin order routes
app.use(
  "/api/orders",
  ordersRouter
);

// Customer enquiries + protected admin enquiry routes
app.use(
  "/api/enquiries",
  enquiriesRouter
);

// Admin authentication + other admin routes
app.use(
  "/api/admin",
  adminRouter
);

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  return res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
//
// Expected route errors are handled inside the
// individual route files.
//
// This handler catches anything unexpected that
// escapes those routes.
//
// Internal error details are NOT returned to the
// client in production-style responses.

app.use((error, req, res, next) => {
  console.error(
    "Unhandled backend error:",
    error
  );

  if (res.headersSent) {
    return next(error);
  }

  // CORS rejection
  if (
    error?.message ===
    "Origin not allowed by CORS."
  ) {
    return res.status(403).json({
      status: "error",
      message:
        "Request origin is not allowed.",
    });
  }

  const statusCode =
    Number.isInteger(error?.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode < 600
      ? error.statusCode
      : 500;

  return res.status(statusCode).json({
    status: "error",

    message:
      statusCode === 500
        ? "Internal server error."
        : error.message ||
          "Request failed.",
  });
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(
  PORT,
  () => {
    console.log(
      "================================="
    );

    console.log(
      "A&A BACKEND RUNNING"
    );

    console.log(
      `PORT: ${PORT}`
    );

    console.log(
      `ENVIRONMENT: ${NODE_ENV}`
    );

    console.log(
      `CORS ORIGINS: ${allowedOrigins.join(
        ", "
      )}`
    );

    console.log(
      "================================="
    );
  }
);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = (signal) => {
  console.log(
    `${signal} received. Shutting down server...`
  );

  server.close(() => {
    console.log(
      "HTTP server closed."
    );

    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "Forced shutdown after timeout."
    );

    process.exit(1);
  }, 10000).unref();
};

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);