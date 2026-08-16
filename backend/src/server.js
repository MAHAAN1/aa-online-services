import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import ordersRouter from "./routes/orders.js";
import enquiriesRouter from "./routes/enquiries.js";
import adminRouter from "./routes/admin.js";
import paymentRouter from "./routes/payments.js";
import opportunitiesRouter from "./routes/opportunities.js";
import applicationsRouter from "./routes/applications.js";

const app = express();

const PORT =
  Number(process.env.PORT) ||
  5000;

const NODE_ENV =
  process.env.NODE_ENV ||
  "development";

const isProduction =
  NODE_ENV ===
  "production";

app.disable(
  "x-powered-by"
);

if (
  process.env.TRUST_PROXY ===
    "true" ||
  isProduction
) {
  app.set(
    "trust proxy",
    1
  );
}

/* ============================================================
   CORS
============================================================ */

const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const configuredOrigins = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  ""
)
  .split(",")
  .map((origin) =>
    origin
      .trim()
      .replace(
        /\/$/,
        ""
      )
  )
  .filter(Boolean);

const allowedOrigins =
  configuredOrigins.length >
  0
    ? configuredOrigins
    : developmentOrigins;

app.use(
  cors({
    origin(
      origin,
      callback
    ) {
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      const normalizedOrigin =
        origin.replace(
          /\/$/,
          ""
        );

      if (
        allowedOrigins.includes(
          normalizedOrigin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      console.warn(
        `Blocked CORS origin: ${origin}`
      );

      return callback(
        new Error(
          "Origin not allowed by CORS."
        )
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

    exposedHeaders: [
      "Content-Disposition",
    ],

    credentials: false,

    optionsSuccessStatus: 204,
  })
);

/* ============================================================
   SECURITY
============================================================ */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy:
        "cross-origin",
    },

    contentSecurityPolicy:
      isProduction
        ? undefined
        : false,
  })
);

/* ============================================================
   BODY PARSERS
============================================================ */

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

/* ============================================================
   GENERAL RATE LIMIT
============================================================ */

const apiLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      isProduction
        ? 300
        : 1000,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      status:
        "error",

      message:
        "Too many requests. Please try again later.",
    },

    handler(
      req,
      res,
      next,
      options
    ) {
      return res
        .status(
          options.statusCode
        )
        .json(
          options.message
        );
    },

    skip(req) {
      return (
        req.path ===
        "/health"
      );
    },
  });

/* ============================================================
   ADMIN LOGIN LIMIT
============================================================ */

const adminLoginLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 5,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      status:
        "error",

      message:
        "Too many login attempts. Please try again later.",
    },

    handler(
      req,
      res,
      next,
      options
    ) {
      return res
        .status(
          options.statusCode
        )
        .json(
          options.message
        );
    },
  });

/* ============================================================
   PAYMENT LIMIT
============================================================ */

const paymentLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 30,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      status:
        "error",

      message:
        "Too many payment requests. Please try again later.",
    },

    handler(
      req,
      res,
      next,
      options
    ) {
      return res
        .status(
          options.statusCode
        )
        .json(
          options.message
        );
    },
  });

/* ============================================================
   ROOT
============================================================ */

app.get(
  "/",
  (req, res) => {
    return res.json({
      status: "ok",

      message:
        "A&A Online Services backend is running",

      environment:
        NODE_ENV,

      version:
        "1.0.0",
    });
  }
);
app.use(
  "/api/applications",
  applicationsRouter
);
/* ============================================================
   HEALTH
============================================================ */

app.get(
  "/api/health",
  (req, res) => {
    return res.json({
      status: "ok",

      message:
        "A&A Online Services backend is running",

      environment:
        NODE_ENV,

      timestamp:
        new Date().toISOString(),
    });
  }
);

/* ============================================================
   API LIMIT
============================================================ */

app.use(
  "/api",
  apiLimiter
);

/* ============================================================
   ADMIN LOGIN
============================================================ */

app.use(
  "/api/admin/login",
  adminLoginLimiter
);

/* ============================================================
   PAYMENTS
============================================================ */

app.use(
  "/api/payments",
  paymentLimiter,
  paymentRouter
);

/* ============================================================
   ORDERS
============================================================ */

app.use(
  "/api/orders",
  ordersRouter
);

/* ============================================================
   ENQUIRIES
============================================================ */

app.use(
  "/api/enquiries",
  enquiriesRouter
);

/* ============================================================
   ADMIN
============================================================ */

app.use(
  "/api/admin",
  adminRouter
);

/* ============================================================
   LIVE GOVERNMENT DATA
============================================================ */

app.use(
  "/api/opportunities",
  opportunitiesRouter
);

/* ============================================================
   404
============================================================ */

app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        status:
          "error",

        message:
          "Route not found",

        path:
          req.originalUrl,
      });
  }
);

/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled backend error:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    if (
      error?.message ===
      "Origin not allowed by CORS."
    ) {
      return res
        .status(403)
        .json({
          status:
            "error",

          message:
            "Request origin is not allowed.",
        });
    }

    if (
      error?.name ===
      "MulterError"
    ) {
      return res
        .status(400)
        .json({
          status:
            "error",

          message:
            error.message ||
            "File upload error.",
        });
    }

    const statusCode =
      Number.isInteger(
        error?.statusCode
      ) &&
      error.statusCode >=
        400 &&
      error.statusCode <
        600
        ? error.statusCode
        : 500;

    return res
      .status(
        statusCode
      )
      .json({
        status:
          "error",

        message:
          statusCode >=
          500
            ? "Internal server error."
            : error?.message ||
              "Request failed.",
      });
  }
);

/* ============================================================
   START SERVER
============================================================ */

const server =
  app.listen(
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
        "PAYMENTS: /api/payments"
      );

      console.log(
        "WEBHOOK: /api/payments/webhook"
      );

      console.log(
        "GOVERNMENT DATA: /api/opportunities"
      );

      console.log(
        "================================="
      );
    }
  );

/* ============================================================
   GRACEFUL SHUTDOWN
============================================================ */

let shuttingDown =
  false;

const shutdown =
  (signal) => {
    if (
      shuttingDown
    ) {
      return;
    }

    shuttingDown =
      true;

    console.log(
      `${signal} received. Shutting down server...`
    );

    server.close(
      (error) => {
        if (error) {
          console.error(
            "Server shutdown error:",
            error
          );

          process.exit(1);
        }

        console.log(
          "HTTP server closed."
        );

        process.exit(0);
      }
    );

    setTimeout(
      () => {
        console.error(
          "Forced shutdown after timeout."
        );

        process.exit(1);
      },
      10000
    ).unref();
  };

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );

    shutdown(
      "uncaughtException"
    );
  }
);