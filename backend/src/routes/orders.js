import express from "express";
import multer from "multer";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";

import { supabase } from "../services/supabase.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

const BUCKET = "aa-order-documents";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_COPIES = 1000;

// ============================================================
// PRICING
// ============================================================

const PRINT_PRICE = {
  bw: {
    single: 2,
    double: 3,
  },
  color: {
    single: 5,
    double: 8,
  },
};

const XEROX_PRICE = {
  bw: {
    firstPage: 5,
    additionalPage: 3,
  },
  color: {
    firstPage: 10,
    additionalPage: 6,
  },
};

const LAMINATION_PRICE = 20;
const SPIRAL_PRICE = 40;

// ============================================================
// FILE UPLOAD
// ============================================================

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },

  fileFilter(req, file, cb) {
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

// ============================================================
// NORMALIZATION
// ============================================================

const normalizeBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === "1";

const normalizeCopies = (value) => {
  const copies = Number(value);

  if (!Number.isFinite(copies) || copies < 1) {
    return 1;
  }

  return Math.min(
    MAX_COPIES,
    Math.floor(copies)
  );
};

const normalizeColorMode = (value) =>
  value === "color" ? "color" : "bw";

const normalizeSides = (value) =>
  value === "double" ? "double" : "single";

const normalizeServiceType = (value) =>
  value === "xerox" ? "xerox" : "printing";

const getServiceName = (
  colorMode,
  serviceType
) => {
  if (serviceType === "xerox") {
    return colorMode === "color"
      ? "Colour Xerox"
      : "B&W Xerox";
  }

  return colorMode === "color"
    ? "Colour Printing"
    : "B&W Printing";
};

// ============================================================
// PAGE COUNT
// ============================================================

const getPdfPageCount = async (buffer) => {
  const pdf = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
  });

  return pdf.getPageCount();
};

const getDocxPageCount = (buffer) => {
  try {
    const files = unzipSync(
      new Uint8Array(buffer)
    );

    const appXml =
      files["docProps/app.xml"];

    if (!appXml) {
      return null;
    }

    const xml = strFromU8(appXml);

    const match = xml.match(
      /<Pages>\s*(\d+)\s*<\/Pages>/i
    );

    if (!match) {
      return null;
    }

    const pages = Number(match[1]);

    return Number.isInteger(pages) && pages > 0
      ? pages
      : null;
  } catch {
    return null;
  }
};

const getPageCount = async (file) => {
  const name =
    file.originalname.toLowerCase();

  if (
    file.mimetype === "application/pdf" ||
    name.endsWith(".pdf")
  ) {
    return getPdfPageCount(file.buffer);
  }

  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    /\.(jpg|jpeg|png)$/i.test(name)
  ) {
    return 1;
  }

  if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return getDocxPageCount(file.buffer);
  }

  return null;
};

// ============================================================
// DOCUMENT PRICE
// ============================================================

const calculateDocumentPrice = ({
  pages,
  copies,
  colorMode,
  sides,
  serviceType,
}) => {
  const normalizedPages = Number(pages);
  const normalizedCopies =
    normalizeCopies(copies);

  if (
    !Number.isInteger(normalizedPages) ||
    normalizedPages < 1
  ) {
    return 0;
  }

  const mode =
    normalizeColorMode(colorMode);

  const type =
    normalizeServiceType(serviceType);

  // ----------------------------------------------------------
  // XEROX
  // ----------------------------------------------------------

  if (type === "xerox") {
    const rates = XEROX_PRICE[mode];

    const perCopy =
      rates.firstPage +
      Math.max(
        0,
        normalizedPages - 1
      ) *
        rates.additionalPage;

    return perCopy * normalizedCopies;
  }

  // ----------------------------------------------------------
  // PRINTING
  // ----------------------------------------------------------

  const rates = PRINT_PRICE[mode];

  if (
    normalizeSides(sides) === "double"
  ) {
    const doubleSheets =
      Math.floor(normalizedPages / 2);

    const singlePages =
      normalizedPages % 2;

    return (
      doubleSheets * rates.double +
      singlePages * rates.single
    ) * normalizedCopies;
  }

  return (
    normalizedPages *
    rates.single *
    normalizedCopies
  );
};

// ============================================================
// ORDER TOTAL
// ============================================================

const calculateOrderTotal = ({
  documents,
  lamination,
  spiralBinding,
}) => {
  const documentTotal =
    documents.reduce(
      (total, document) =>
        total +
        Number(document.amount || 0),
      0
    );

  const laminationTotal =
    normalizeBoolean(lamination)
      ? documents.reduce(
          (total, document) =>
            total +
            Number(document.pages || 0) *
              normalizeCopies(
                document.copies
              ) *
              LAMINATION_PRICE,
          0
        )
      : 0;

  const spiralTotal =
    normalizeBoolean(spiralBinding)
      ? SPIRAL_PRICE
      : 0;

  return (
    documentTotal +
    laminationTotal +
    spiralTotal
  );
};

// ============================================================
// PARSE CUSTOMER DOCUMENT OPTIONS
// ============================================================

const parseDocumentOptions = (value) => {
  if (!value) {
    return [];
  }

  try {
    const parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
};

const getDocumentOption = (
  options,
  index,
  file
) => {
  const byIndex = options[index];

  if (
    byIndex &&
    typeof byIndex === "object"
  ) {
    return byIndex;
  }

  return (
    options.find(
      (item) =>
        item &&
        String(
          item.original_name || ""
        ).trim() ===
          String(
            file.originalname || ""
          ).trim()
    ) || {}
  );
};

// ============================================================
// ADMIN AUTH
// ============================================================

router.use("/admin", adminAuth);

// ============================================================
// ADMIN - ALL ORDERS
// ============================================================

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
          customer_email,
          service,
          copies,
          color_mode,
          sides,
          binding,
          notes,
          status,
          amount,
          payment_status,
          paid_amount,
          razorpay_order_id,
          razorpay_payment_id,
          paid_at,
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
        });
      }

      return res.json({
        status: "ok",
        orders: data || [],
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

// ============================================================
// ADMIN - GET ALL DOCUMENTS FOR ORDER
// ============================================================

router.get(
  "/admin/:orderId/documents",
  async (req, res) => {
    try {
      const { orderId } =
        req.params;

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          amount,
          payment_status,
          paid_amount,
          razorpay_order_id,
          razorpay_payment_id,
          paid_at,
          lamination,
          spiral_binding
        `)
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

      // IMPORTANT:
      // Read the ACTUAL saved customer request
      // directly from order_documents.
      const {
        data: documents,
        error: documentsError,
      } = await supabase
        .from("order_documents")
        .select(`
          id,
          order_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          pages,
          copies,
          service_type,
          service_name,
          color_mode,
          sides,
          amount,
          delete_at,
          created_at
        `)
        .eq(
          "order_id",
          orderId
        )
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
        });
      }

      const safeDocuments =
        (documents || []).map(
          (document) => ({
            id: document.id,
            order_id:
              document.order_id,

            original_name:
              document.original_name,

            storage_path:
              document.storage_path,

            file_type:
              document.file_type,

            file_size:
              document.file_size,

            pages:
              Number(document.pages) || 0,

            copies:
              normalizeCopies(
                document.copies
              ),

            service_type:
              normalizeServiceType(
                document.service_type
              ),

            service_name:
              document.service_name ||
              getServiceName(
                document.color_mode,
                document.service_type
              ),

            color_mode:
              normalizeColorMode(
                document.color_mode
              ),

            sides:
              normalizeSides(
                document.sides
              ),

            amount:
              Number(document.amount) || 0,

            delete_at:
              document.delete_at,

            created_at:
              document.created_at,
          })
        );

      const totalPages =
        safeDocuments.reduce(
          (total, document) =>
            total +
            Number(document.pages || 0),
          0
        );

      const documentCharges =
        safeDocuments.reduce(
          (total, document) =>
            total +
            Number(document.amount || 0),
          0
        );

      const laminationCharges =
        normalizeBoolean(
          order.lamination
        )
          ? safeDocuments.reduce(
              (total, document) =>
                total +
                document.pages *
                  document.copies *
                  LAMINATION_PRICE,
              0
            )
          : 0;

      const spiralCharges =
        normalizeBoolean(
          order.spiral_binding
        )
          ? SPIRAL_PRICE
          : 0;

      const calculatedDocumentTotal =
        documentCharges +
        laminationCharges +
        spiralCharges;

      return res.json({
        status: "ok",

        order: {
          id: order.id,

          order_number:
            order.order_number,

          amount:
            Number(order.amount) ||
            calculatedDocumentTotal,

          payment_status:
            order.payment_status,

          paid_amount:
            Number(order.paid_amount) || 0,

          razorpay_order_id:
            order.razorpay_order_id,

          razorpay_payment_id:
            order.razorpay_payment_id,

          paid_at:
            order.paid_at,

          total_pages:
            totalPages,

          document_charges:
            documentCharges,

          lamination_charges:
            laminationCharges,

          spiral_charges:
            spiralCharges,

          calculated_document_total:
            calculatedDocumentTotal,
        },

        documents:
          safeDocuments,
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

// ============================================================
// ADMIN - VIEW SPECIFIC DOCUMENT
// ============================================================

router.get(
  "/admin/document/:documentId",
  async (req, res) => {
    try {
      const {
        documentId,
      } = req.params;

      const {
        data: document,
        error,
      } = await supabase
        .from("order_documents")
        .select(`
          id,
          order_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          pages,
          copies,
          service_type,
          service_name,
          color_mode,
          sides,
          amount,
          delete_at,
          created_at
        `)
        .eq("id", documentId)
        .maybeSingle();

      if (error) {
        console.error(
          "Document lookup error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to find document.",
        });
      }

      if (!document) {
        return res.status(404).json({
          status: "error",
          message:
            "Document not found.",
        });
      }

      if (!document.storage_path) {
        return res.status(404).json({
          status: "error",
          message:
            "Document storage path is missing.",
        });
      }

      const {
        data: signedData,
        error: signedError,
      } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          document.storage_path,
          600
        );

      if (
        signedError ||
        !signedData?.signedUrl
      ) {
        console.error(
          "Signed URL error:",
          signedError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to generate document link.",
        });
      }

      return res.json({
        status: "ok",

        document: {
          id: document.id,

          order_id:
            document.order_id,

          original_name:
            document.original_name,

          file_type:
            document.file_type,

          file_size:
            document.file_size,

          pages:
            Number(document.pages) || 0,

          copies:
            normalizeCopies(
              document.copies
            ),

          service_type:
            normalizeServiceType(
              document.service_type
            ),

          service_name:
            document.service_name,

          color_mode:
            normalizeColorMode(
              document.color_mode
            ),

          sides:
            normalizeSides(
              document.sides
            ),

          amount:
            Number(document.amount) || 0,

          created_at:
            document.created_at,
        },

        url:
          signedData.signedUrl,

        expires_in: 600,
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

// ============================================================
// ADMIN - VIEW FIRST DOCUMENT
// ============================================================

router.get(
  "/admin/:orderId/document",
  async (req, res) => {
    try {
      const { orderId } =
        req.params;

      const {
        data: document,
        error,
      } = await supabase
        .from("order_documents")
        .select(`
          id,
          order_id,
          original_name,
          storage_path,
          pages,
          copies,
          service_type,
          service_name,
          color_mode,
          sides,
          amount
        `)
        .eq(
          "order_id",
          orderId
        )
        .order("created_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          status: "error",
          message:
            "Unable to find document.",
        });
      }

      if (!document) {
        return res.status(404).json({
          status: "error",
          message:
            "No document is attached to this order.",
        });
      }

      const {
        data: signedData,
        error: signedError,
      } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          document.storage_path,
          600
        );

      if (
        signedError ||
        !signedData?.signedUrl
      ) {
        return res.status(500).json({
          status: "error",
          message:
            "Unable to generate document link.",
        });
      }

      return res.json({
        status: "ok",

        order_id:
          document.order_id,

        document: {
          id: document.id,
          original_name:
            document.original_name,
          pages:
            Number(document.pages) || 0,
          copies:
            normalizeCopies(
              document.copies
            ),
          service_type:
            normalizeServiceType(
              document.service_type
            ),
          service_name:
            document.service_name,
          color_mode:
            normalizeColorMode(
              document.color_mode
            ),
          sides:
            normalizeSides(
              document.sides
            ),
          amount:
            Number(document.amount) || 0,
        },

        url:
          signedData.signedUrl,

        expires_in: 600,
      });
    } catch (error) {
      console.error(
        "View order document error:",
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

// ============================================================
// CREATE ORDER + UPLOAD DOCUMENTS
// ============================================================

router.post(
  "/create",
  upload.array(
    "documents",
    MAX_FILES
  ),
  async (req, res) => {
    const uploadedPaths = [];

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

      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (
        !customer_name?.trim() ||
        !phone?.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Customer name and phone are required.",
        });
      }

      if (
        !/^[0-9]{10}$/.test(
          phone.trim()
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Please enter a valid 10-digit phone number.",
        });
      }

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

      // --------------------------------------------------------
      // CUSTOMER'S EXACT PER-DOCUMENT REQUEST
      // --------------------------------------------------------

      const documentOptions =
        parseDocumentOptions(
          req.body?.document_options
        );

      // --------------------------------------------------------
      // ORDER NUMBER
      // --------------------------------------------------------

      const randomPart =
        crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase();

      const datePart =
        new Date()
          .toISOString()
          .slice(0, 10)
          .replaceAll("-", "");

      const orderNumber =
        `AA-${datePart}-${randomPart}`;

      const deleteAt =
        new Date(
          Date.now() +
            24 * 60 * 60 * 1000
        ).toISOString();

      const uploadedDocuments = [];

      // --------------------------------------------------------
      // PROCESS EACH DOCUMENT
      // --------------------------------------------------------

      for (
        let index = 0;
        index < req.files.length;
        index++
      ) {
        const file =
          req.files[index];

        const option =
          getDocumentOption(
            documentOptions,
            index,
            file
          );

        // ------------------------------------------------------
        // SERVER-AUTHORITATIVE PAGE COUNT
        // ------------------------------------------------------

        const pages =
          await getPageCount(file);

        if (
          !Number.isInteger(pages) ||
          pages < 1
        ) {
          throw new Error(
            `${file.originalname}: unable to determine the page count.`
          );
        }

        // ------------------------------------------------------
        // EXACT CUSTOMER REQUEST
        // ------------------------------------------------------

        const documentCopies =
          normalizeCopies(
            option.copies ??
              copies
          );

        const documentColor =
          normalizeColorMode(
            option.color_mode ??
              color_mode
          );

        const documentSides =
          normalizeSides(
            option.sides ??
              sides
          );

        const documentServiceType =
          normalizeServiceType(
            option.service_type
          );

        const documentServiceName =
          getServiceName(
            documentColor,
            documentServiceType
          );

        // ------------------------------------------------------
        // PRICE
        // ------------------------------------------------------

        const amount =
          calculateDocumentPrice({
            pages,
            copies:
              documentCopies,
            colorMode:
              documentColor,
            sides:
              documentSides,
            serviceType:
              documentServiceType,
          });

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          throw new Error(
            `${file.originalname}: unable to calculate document price.`
          );
        }

        // ------------------------------------------------------
        // STORAGE
        // ------------------------------------------------------

        const safeFileName =
          file.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

        const storagePath =
          `${orderNumber}/${Date.now()}-${index}-${safeFileName}`;

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

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(
          storagePath
        );

        // ------------------------------------------------------
        // STORE COMPLETE DOCUMENT REQUEST
        // ------------------------------------------------------

        uploadedDocuments.push({
          original_name:
            file.originalname,

          storage_path:
            storagePath,

          file_type:
            file.mimetype || null,

          file_size:
            file.size || null,

          pages,

          copies:
            documentCopies,

          service_type:
            documentServiceType,

          service_name:
            documentServiceName,

          color_mode:
            documentColor,

          sides:
            documentSides,

          amount,

          delete_at:
            deleteAt,
        });
      }

      // --------------------------------------------------------
      // TOTAL ORDER AMOUNT
      // --------------------------------------------------------

      const totalAmount =
        calculateOrderTotal({
          documents:
            uploadedDocuments,

          lamination,

          spiralBinding:
            spiral_binding,
        });

      if (
        !Number.isFinite(totalAmount) ||
        totalAmount <= 0
      ) {
        throw new Error(
          "Unable to calculate a valid order amount."
        );
      }

      // --------------------------------------------------------
      // FIRST DOCUMENT
      // --------------------------------------------------------

      const firstDocument =
        uploadedDocuments[0];

      // --------------------------------------------------------
      // CREATE ORDER
      // --------------------------------------------------------

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
            firstDocument.service_name,

          copies:
            firstDocument.copies,

          color_mode:
            firstDocument.color_mode,

          sides:
            firstDocument.sides,

          lamination:
            normalizeBoolean(
              lamination
            ),

          spiral_binding:
            normalizeBoolean(
              spiral_binding
            ),

          notes:
            notes?.trim() || "",

          status:
            "received",

          payment_status:
            "pending",

          amount:
            totalAmount,

          document_path:
            firstDocument.storage_path,

          delete_at:
            deleteAt,
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // --------------------------------------------------------
      // SAVE COMPLETE DOCUMENT ROWS
      // --------------------------------------------------------

      const documentRows =
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

            // THESE WERE MISSING BEFORE
            pages:
              document.pages,

            copies:
              document.copies,

            service_type:
              document.service_type,

            service_name:
              document.service_name,

            color_mode:
              document.color_mode,

            sides:
              document.sides,

            amount:
              document.amount,

            delete_at:
              document.delete_at,
          })
        );

      const {
        data: savedDocuments,
        error:
          documentsError,
      } = await supabase
        .from("order_documents")
        .insert(
          documentRows
        )
        .select(`
          id,
          order_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          pages,
          copies,
          service_type,
          service_name,
          color_mode,
          sides,
          amount,
          delete_at,
          created_at
        `);

      if (documentsError) {
        throw documentsError;
      }

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      return res.status(201).json({
        status: "ok",

        message:
          "Order created successfully.",

        order,

        documents:
          savedDocuments || [],

        pricing: {
          document_total:
            uploadedDocuments.reduce(
              (sum, document) =>
                sum +
                Number(
                  document.amount || 0
                ),
              0
            ),

          lamination_total:
            normalizeBoolean(
              lamination
            )
              ? uploadedDocuments.reduce(
                  (sum, document) =>
                    sum +
                    document.pages *
                      document.copies *
                      LAMINATION_PRICE,
                  0
                )
              : 0,

          spiral_total:
            normalizeBoolean(
              spiral_binding
            )
              ? SPIRAL_PRICE
              : 0,

          final_amount:
            totalAmount,
        },
      });
    } catch (error) {
      console.error(
        "Create order error:",
        error
      );

      // --------------------------------------------------------
      // CLEANUP STORAGE
      // --------------------------------------------------------

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

      return res.status(500).json({
        status: "error",
        message:
          error?.message ||
          "Unable to create order.",
      });
    }
  }
);

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

router.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
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
        "Upload error:",
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

// ============================================================
// TRACK ORDER
// ============================================================

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
          color_mode,
          sides,
          status,
          amount,
          payment_status,
          paid_amount,
          razorpay_order_id,
          razorpay_payment_id,
          paid_at,
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
          "Track order error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to retrieve order.",
        });
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message:
            "Order not found.",
        });
      }

      return res.json({
        status: "ok",

        order,
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

// ============================================================
// ADMIN - UPDATE ORDER STATUS
// ============================================================

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
        });
      }

      return res.json({
        status: "ok",

        message:
          "Order status updated.",

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

// ============================================================
// SERVICES
// ============================================================

router.get(
  "/services",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        return res.status(500).json({
          status: "error",
          message:
            "Unable to load services.",
        });
      }

      return res.json({
        status: "ok",
        services: data || [],
      });
    } catch (error) {
      console.error(
        "Services error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error.",
      });
    }
  }
);

// ============================================================
// TEST
// ============================================================

router.get(
  "/test",
  (req, res) => {
    return res.json({
      status: "ok",
      message:
        "Order route is working",
    });
  }
);

export default router;