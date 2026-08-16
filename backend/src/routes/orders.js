import express from "express";
import multer from "multer";
import crypto from "crypto";
import { supabase } from "../services/supabase.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

const BUCKET = "aa-order-documents";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 20;

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },

  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(
        new Error(
          "Only PDF, JPG, PNG, DOC and DOCX files are allowed."
        )
      );
    }

    cb(null, true);
  },
});
// ==========================================
// ADMIN AUTHENTICATION
// Everything below this point is protected.
// ==========================================

router.use("/admin", adminAuth);

// ==========================================
// ADMIN - GET ALL ORDERS
// ==========================================

router.get("/admin/all", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        phone,
        service,
        copies,
        binding,
        notes,
        status,
        amount,
        payment_status,
        created_at,
        updated_at,
        document_path
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Admin orders error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to load orders.",
      });
    }

    return res.json({
      status: "ok",
      orders: data || [],
    });
  } catch (error) {
    console.error("Admin orders error:", error);

    return res.status(500).json({
      status: "error",
      message: "Server error while loading orders.",
    });
  }
});

// ==========================================
// ADMIN - UPDATE ORDER STATUS
// ==========================================

router.patch(
  "/admin/:orderId/status",
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body || {};

      const allowedStatuses = [
        "received",
        "reviewing",
        "awaiting_payment",
        "processing",
        "ready",
        "completed",
        "needs_customer_action",
        "cancelled",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid order status.",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("orders")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) {
        console.error(
          "Order status update error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to update order status.",
        });
      }

      return res.json({
        status: "ok",
        message: "Order status updated.",
        order: data,
      });
    } catch (error) {
      console.error(
        "Order status update error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while updating order.",
      });
    }
  }
);

// ==========================================
// GET SERVICES
// ==========================================

router.get("/services", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("active", true)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("Services error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to load services",
      });
    }

    return res.json({
      status: "ok",
      services: data || [],
    });
  } catch (error) {
    console.error("Services route error:", error);

    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
});

// ==========================================
// TEST ROUTE
// ==========================================

router.get("/test", (req, res) => {
  res.json({
    status: "ok",
    message: "Order route is working",
  });
});

// ==========================================
// ADMIN - VIEW FIRST DOCUMENT OF ORDER
// ==========================================

router.get(
  "/admin/:orderId/document",
  async (req, res) => {
    try {
      const { orderId } = req.params;

      // ==========================================
      // GET ORDER
      // ==========================================

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .select(
          "id, order_number, document_path"
        )
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) {
        console.error(
          "Document order lookup error:",
          orderError
        );

        return res.status(500).json({
          status: "error",
          message: "Unable to find order.",
          database_error: orderError.message,
        });
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message: "Order not found.",
        });
      }

      // ==========================================
      // CHECK DOCUMENT
      // ==========================================

      if (!order.document_path) {
        return res.status(404).json({
          status: "error",
          message:
            "No document is attached to this order.",
        });
      }

      // ==========================================
      // CREATE TEMPORARY SIGNED URL
      // ==========================================

      const {
        data: signedUrl,
        error: signedUrlError,
      } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          order.document_path,
          60 * 10
        );

      if (signedUrlError) {
        console.error(
          "Signed URL error:",
          signedUrlError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to generate document link.",
          storage_error:
            signedUrlError.message,
        });
      }

      return res.json({
        status: "ok",
        order_number:
          order.order_number,
        document_path:
          order.document_path,
        url:
          signedUrl.signedUrl,
        expires_in: 600,
      });
    } catch (error) {
      console.error(
        "Document route error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to open document.",
      });
    }
  }
);

// ==========================================
// ADMIN - GET ALL DOCUMENTS FOR ORDER
// ==========================================

router.get(
  "/admin/:orderId/documents",
  async (req, res) => {
    try {
      const { orderId } = req.params;

      console.log(
        "Loading documents for order:",
        orderId
      );

      // ==========================================
      // VERIFY ORDER EXISTS
      // ==========================================

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .select(
          "id, order_number"
        )
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) {
        console.error(
          "Order lookup error:",
          orderError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to find order.",
          database_error:
            orderError.message,
        });
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message:
            "Order not found.",
        });
      }

      // ==========================================
      // GET DOCUMENTS
      // ==========================================

      const {
        data: documents,
        error: documentsError,
      } = await supabase
        .from("order_documents")
        .select(
          `
          id,
          order_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          delete_at,
          created_at
          `
        )
        .eq("order_id", orderId)
        .order("created_at", {
          ascending: true,
        });

      if (documentsError) {
        console.error(
          "Order documents fetch error:",
          documentsError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to load order documents.",
          database_error:
            documentsError.message,
          database_code:
            documentsError.code,
          database_details:
            documentsError.details,
          database_hint:
            documentsError.hint,
        });
      }

      console.log(
        `Documents found for ${order.order_number}:`,
        documents?.length || 0
      );

      return res.json({
        status: "ok",

        order: {
          id: order.id,
          order_number:
            order.order_number,
        },

        documents:
          documents || [],
      });
    } catch (error) {
      console.error(
        "Order documents route error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while loading documents.",
      });
    }
  }
);

// ==========================================
// ADMIN - VIEW SPECIFIC DOCUMENT
// ==========================================

router.get(
  "/admin/document/:documentId",
  async (req, res) => {
    try {
      const { documentId } = req.params;

      console.log(
        "Opening document:",
        documentId
      );

      // ==========================================
      // GET DOCUMENT
      // ==========================================

      const {
        data: document,
        error: documentError,
      } = await supabase
        .from("order_documents")
        .select(
          `
          id,
          order_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          delete_at,
          created_at
          `
        )
        .eq("id", documentId)
        .maybeSingle();

      if (documentError) {
        console.error(
          "Document lookup error:",
          documentError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to find document.",
          database_error:
            documentError.message,
          database_code:
            documentError.code,
        });
      }

      if (!document) {
        return res.status(404).json({
          status: "error",
          message:
            "Document not found.",
        });
      }

      // ==========================================
      // CHECK STORAGE PATH
      // ==========================================

      if (!document.storage_path) {
        return res.status(404).json({
          status: "error",
          message:
            "Document storage path is missing.",
        });
      }

      // ==========================================
      // CREATE SIGNED URL
      // ==========================================

      const {
        data: signedData,
        error: signedError,
      } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          document.storage_path,
          60 * 10
        );

      if (signedError) {
        console.error(
          "Signed URL error:",
          signedError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to generate document link.",
          storage_error:
            signedError.message,
        });
      }

      if (!signedData?.signedUrl) {
        return res.status(500).json({
          status: "error",
          message:
            "Document URL was not generated.",
        });
      }

      // ==========================================
      // RESPONSE
      // ==========================================

      return res.json({
        status: "ok",

        document: {
          id:
            document.id,

          order_id:
            document.order_id,

          original_name:
            document.original_name,

          file_type:
            document.file_type,

          file_size:
            document.file_size,

          created_at:
            document.created_at,
        },

        url:
          signedData.signedUrl,

        expires_in:
          600,
      });
    } catch (error) {
      console.error(
        "View document route error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to open document.",
      });
    }
  }
);

// ==========================================
// CREATE ORDER + UPLOAD DOCUMENTS
// ==========================================

router.post(
  "/create",
  upload.array("documents", MAX_FILES),
  async (req, res) => {
    const uploadedPaths = [];
    const uploadedDocuments = [];

    try {
      const {
        customer_name,
        phone,
        customer_email,
        service_id,
        service_name,
        copies = 1,
        color_mode = "bw",
        sides = "single",
        lamination = "false",
        spiral_binding = "false",
        notes = "",
      } = req.body;

      // ==========================================
      // VALIDATE CUSTOMER
      // ==========================================

      if (!customer_name || !phone) {
        return res.status(400).json({
          status: "error",
          message:
            "Customer name and phone are required.",
        });
      }

      // ==========================================
      // VALIDATE PHONE
      // ==========================================

      if (!/^[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
          status: "error",
          message:
            "Please enter a valid 10-digit phone number.",
        });
      }

      // ==========================================
      // VALIDATE EMAIL
      // ==========================================

      if (
        customer_email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          customer_email
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Please enter a valid email address.",
        });
      }

      // ==========================================
      // VALIDATE FILES
      // ==========================================

      if (
        !req.files ||
        req.files.length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Please upload at least one document.",
        });
      }

      if (req.files.length > MAX_FILES) {
        return res.status(400).json({
          status: "error",
          message:
            `Maximum ${MAX_FILES} documents are allowed.`,
        });
      }

      // ==========================================
      // GENERATE ORDER NUMBER
      // ==========================================

      const randomPart = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

      const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");

      const orderNumber =
        `AA-${datePart}-${randomPart}`;

      // ==========================================
      // DELETE AFTER 24 HOURS
      // ==========================================

      const deleteAt = new Date(
        Date.now() +
          24 * 60 * 60 * 1000
      ).toISOString();

      // ==========================================
      // UPLOAD ALL DOCUMENTS
      // ==========================================

      for (const file of req.files) {
        const safeFileName =
          file.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

        const storagePath =
          `${orderNumber}/${Date.now()}-${safeFileName}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from(BUCKET)
          .upload(
            storagePath,
            file.buffer,
            {
              contentType:
                file.mimetype ||
                "application/octet-stream",

              upsert: false,
            }
          );

        // ==========================================
        // STORAGE UPLOAD ERROR
        // ==========================================

        if (uploadError) {
          console.error(
            "Document upload error:",
            uploadError
          );

          if (
            uploadedPaths.length > 0
          ) {
            await supabase.storage
              .from(BUCKET)
              .remove(
                uploadedPaths
              );
          }

          return res.status(500).json({
            status: "error",
            message:
              "Unable to upload document.",
            storage_error:
              uploadError.message,
          });
        }

        // ==========================================
        // SAVE STORAGE PATH
        // ==========================================

        uploadedPaths.push(
          storagePath
        );

        // ==========================================
        // SAVE DOCUMENT INFORMATION
        // ==========================================

        uploadedDocuments.push({
          original_name:
            file.originalname,

          storage_path:
            storagePath,

          file_type:
            file.mimetype || null,

          file_size:
            file.size || null,

          delete_at:
            deleteAt,
        });
      }

      // ==========================================
      // FIRST DOCUMENT PATH
      // ==========================================

      const documentPath =
        uploadedPaths[0] || null;

      // ==========================================
      // CREATE ORDER
      // ==========================================

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .insert({
          order_number:
            orderNumber,

          customer_name:
            customer_name.trim(),

          phone:
            phone.trim(),

          customer_email:
            customer_email?.trim() ||
            null,

          service_id:
            service_id || null,

          service:
            service_name ||
            "Document Service",

          copies:
            Math.max(
              1,
              Number(copies) || 1
            ),

          color_mode:
            color_mode,

          sides:
            sides,

          lamination:
            lamination === "true",

          spiral_binding:
            spiral_binding === "true",

          notes:
            notes?.trim() || "",

          status:
            "received",

          payment_status:
            "pending",

          document_path:
            documentPath,

          delete_at:
            deleteAt,
        })
        .select()
        .single();

      // ==========================================
      // ORDER CREATION ERROR
      // ==========================================

      if (orderError) {
        console.error(
          "Order creation error:",
          orderError
        );

        if (
          uploadedPaths.length > 0
        ) {
          await supabase.storage
            .from(BUCKET)
            .remove(
              uploadedPaths
            );
        }

        return res.status(500).json({
          status: "error",

          message:
            "Unable to create order.",

          database_error:
            orderError.message,

          database_code:
            orderError.code,

          database_details:
            orderError.details,

          database_hint:
            orderError.hint,
        });
      }

      // ==========================================
      // SAVE ALL DOCUMENTS
      // ==========================================

      const {
        error: documentsError,
      } = await supabase
        .from("order_documents")
        .insert(
          uploadedDocuments.map(
            (document) => ({
              order_id:
                order.id,

              original_name:
                document.original_name,

              storage_path:
                document.storage_path,

              file_type:
                document.file_type,

              file_size:
                document.file_size,

              delete_at:
                document.delete_at,
            })
          )
        );

      // ==========================================
      // DOCUMENT DATABASE ERROR
      // ==========================================

      if (documentsError) {
        console.error(
          "Order documents database error:",
          documentsError
        );

        // ----------------------------------------
        // DELETE STORAGE FILES
        // ----------------------------------------

        if (
          uploadedPaths.length > 0
        ) {
          try {
            await supabase.storage
              .from(BUCKET)
              .remove(
                uploadedPaths
              );
          } catch (cleanupError) {
            console.error(
              "Storage cleanup error:",
              cleanupError
            );
          }
        }

        // ----------------------------------------
        // DELETE ORDER
        // ----------------------------------------

        try {
          await supabase
            .from("orders")
            .delete()
            .eq(
              "id",
              order.id
            );
        } catch (cleanupError) {
          console.error(
            "Order cleanup error:",
            cleanupError
          );
        }

        return res.status(500).json({
          status: "error",

          message:
            "Unable to save order documents.",

          database_error:
            documentsError.message,

          database_code:
            documentsError.code,

          database_details:
            documentsError.details,

          database_hint:
            documentsError.hint,
        });
      }

      // ==========================================
      // SUCCESS
      // ==========================================

      return res.status(201).json({
        status: "ok",

        message:
          "Order created successfully.",

        order,

        documents:
          uploadedDocuments,
      });
    } catch (error) {
      // ==========================================
      // UNEXPECTED ERROR
      // ==========================================

      console.error(
        "Create order error:",
        error
      );

      // ----------------------------------------
      // CLEANUP STORAGE
      // ----------------------------------------

      if (
        uploadedPaths.length > 0
      ) {
        try {
          await supabase.storage
            .from(BUCKET)
            .remove(
              uploadedPaths
            );
        } catch (cleanupError) {
          console.error(
            "Document cleanup error:",
            cleanupError
          );
        }
      }

      return res.status(500).json({
        status: "error",
        message:
          "Unable to create order.",
        error:
          error.message,
      });
    }
  }
);

// ==========================================
// MULTER ERROR HANDLER
// ==========================================

router.use(
  (error, req, res, next) => {
    if (
      error instanceof multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Each file must be 10 MB or smaller.",
        });
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            `Maximum ${MAX_FILES} files can be uploaded.`,
        });
      }

      if (
        error.code ===
        "LIMIT_UNEXPECTED_FILE"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Unexpected file upload.",
        });
      }
    }

    if (error) {
      console.error(
        "Multer/upload error:",
        error
      );

      return res.status(400).json({
        status: "error",
        message:
          error.message ||
          "File upload error.",
      });
    }

    next();
  }
);

// ==========================================
// TRACK ORDER
// ==========================================

router.get(
  "/track",
  async (req, res) => {
    try {
      const {
        order_number,
        phone,
      } = req.query;

      if (
        !order_number ||
        !phone
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Order number and phone number are required.",
        });
      }

      const {
        data: order,
        error,
      } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          phone,
          service,
          copies,
          status,
          amount,
          payment_status,
          created_at,
          updated_at
        `)
        .eq(
          "order_number",
          order_number.trim()
        )
        .eq(
          "phone",
          phone.trim()
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Track order database error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to retrieve order.",
          error:
            error.message,
        });
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message:
            "Order not found.",
        });
      }

      console.log(
        "Tracked order:",
        order
      );

      return res.json({
        status: "ok",

        order: {
          id:
            order.id,

          order_number:
            order.order_number,

          customer_name:
            order.customer_name,

          phone:
            order.phone,

          service:
            order.service,

          copies:
            order.copies,

          status:
            order.status,

          amount:
            order.amount,

          payment_status:
            order.payment_status,

          created_at:
            order.created_at,

          updated_at:
            order.updated_at,
        },
      });
    } catch (error) {
      console.error(
        "Track order error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while tracking order.",
      });
    }
  }
);

// ==========================================
// ADMIN - GET ALL ORDERS
// ==========================================

router.get(
  "/admin/all",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          phone,
          service,
          copies,
          binding,
          notes,
          status,
          amount,
          payment_status,
          created_at,
          updated_at,
          document_path
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "Admin orders error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to load orders.",
          database_error:
            error.message,
        });
      }

      return res.json({
        status: "ok",
        orders:
          data || [],
      });
    } catch (error) {
      console.error(
        "Admin orders error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while loading orders.",
      });
    }
  }
);

// ==========================================
// ADMIN - UPDATE ORDER STATUS
// ==========================================

router.patch(
  "/admin/:orderId/status",
  async (req, res) => {
    try {
      const {
        orderId,
      } = req.params;

      const {
        status,
      } = req.body || {};

      const allowedStatuses = [
        "received",
        "reviewing",
        "awaiting_payment",
        "processing",
        "ready",
        "completed",
        "needs_customer_action",
        "cancelled",
      ];

      // ==========================================
      // VALIDATE STATUS
      // ==========================================

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid order status.",
        });
      }

      // ==========================================
      // UPDATE ORDER
      // ==========================================

      const {
        data,
        error,
      } = await supabase
        .from("orders")
        .update({
          status,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          orderId
        )
        .select()
        .single();

      if (error) {
        console.error(
          "Order status update error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to update order status.",
          database_error:
            error.message,
        });
      }

      return res.json({
        status: "ok",

        message:
          "Order status updated.",

        order:
          data,
      });
    } catch (error) {
      console.error(
        "Order status update error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while updating order.",
      });
    }
  }
);

export default router;