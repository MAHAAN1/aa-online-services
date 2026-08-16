import express from "express";
import crypto from "crypto";
import multer from "multer";

import { supabase } from "../services/supabase.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

const BUCKET = "aa-order-documents";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;

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

const APPLICATION_STATUSES = [
  "documents_pending",
  "documents_received",
  "ready_to_apply",
  "application_in_progress",
  "submitted",
  "completed",
  "on_hold",
  "rejected",
  "cancelled",
];

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const clean = (value) =>
  typeof value === "string"
    ? value.trim()
    : value ?? null;


/*
|--------------------------------------------------------------------------
| CUSTOMER - CREATE APPLICATION
|--------------------------------------------------------------------------
|
| This creates the application record and uploads the customer's
| required documents.
|
| Payment is deliberately NOT handled here.
| We will connect Razorpay after this route is tested.
|
*/

router.post(
  "/create",
  upload.array("documents", MAX_FILES),
  async (req, res) => {
    const uploadedPaths = [];

    try {
      const {
        customer_name,
        phone,
        customer_email,

        application_type,
        application_name,
        notification_number,
        notification_pdf_url,

        application_start_date,
        application_end_date,

        government_fee = 0,
        service_fee = 100,

        customer_details = "{}",
        document_requirements = "[]",
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

      if (
        !clean(customer_name) ||
        !clean(phone)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Customer name and phone are required.",
        });
      }

      if (
        !/^[0-9]{10}$/.test(
          clean(phone)
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
          clean(customer_email)
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Please enter a valid email address.",
        });
      }

      if (
        !["job", "scholarship"].includes(
          application_type
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application type.",
        });
      }

      if (!clean(application_name)) {
        return res.status(400).json({
          status: "error",
          message:
            "Application name is required.",
        });
      }

      if (
        !req.files ||
        req.files.length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Please upload the required documents.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PARSE JSON DATA
      |--------------------------------------------------------------------------
      */

      let parsedCustomerDetails = {};
      let parsedRequirements = [];

      try {
        parsedCustomerDetails =
          typeof customer_details === "string"
            ? JSON.parse(customer_details)
            : customer_details || {};
      } catch {
        parsedCustomerDetails = {};
      }

      try {
        parsedRequirements =
          typeof document_requirements === "string"
            ? JSON.parse(document_requirements)
            : document_requirements || [];
      } catch {
        parsedRequirements = [];
      }

      /*
      |--------------------------------------------------------------------------
      | APPLICATION NUMBER
      |--------------------------------------------------------------------------
      */

      const randomPart = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

      const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");

      const orderNumber =
        `AA-APP-${datePart}-${randomPart}`;

      /*
      |--------------------------------------------------------------------------
      | FEES
      |--------------------------------------------------------------------------
      */

      const governmentFeeValue =
        Math.max(
          0,
          normalizeNumber(
            government_fee
          )
        );

      const serviceFeeValue =
        Math.max(
          0,
          normalizeNumber(
            service_fee,
            100
          )
        );

      const totalAmount =
        governmentFeeValue +
        serviceFeeValue;

      /*
      |--------------------------------------------------------------------------
      | UPLOAD DOCUMENTS
      |--------------------------------------------------------------------------
      */

      const uploadedDocuments = [];

      for (
        let index = 0;
        index < req.files.length;
        index++
      ) {
        const file = req.files[index];

        const safeFileName =
          file.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

        const storagePath =
          `applications/${orderNumber}/${Date.now()}-${index}-${safeFileName}`;

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

        uploadedPaths.push(storagePath);

        const requirement =
          parsedRequirements[index] || {};

        uploadedDocuments.push({
          original_name:
            file.originalname,

          storage_path:
            storagePath,

          file_type:
            file.mimetype || null,

          file_size:
            file.size || null,

          required_document_name:
            requirement.name ||
            file.originalname,

          document_category:
            requirement.category ||
            "application",

          is_application_document:
            true,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE ORDER
      |--------------------------------------------------------------------------
      |
      | We still use the existing orders table so the existing
      | Admin + Track Order systems can see the application.
      |
      */

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .insert({
          order_number:
            orderNumber,

          customer_name:
            clean(customer_name),

          phone:
            clean(phone),

          customer_email:
            clean(customer_email),

          service_id:
            null,

          service:
            application_type === "job"
              ? "Government Job Application"
              : "Scholarship Application",

          copies:
            1,

          color_mode:
            "bw",

          sides:
            "single",

          lamination:
            false,

          spiral_binding:
            false,

          notes:
            `${application_name} | Application Service`,

          status:
            "received",

          payment_status:
            "pending",

          amount:
            totalAmount,

          document_path:
            uploadedDocuments[0]?.storage_path ||
            null,
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE APPLICATION
      |--------------------------------------------------------------------------
      */

      const {
        data: application,
        error: applicationError,
      } = await supabase
        .from("service_applications")
        .insert({
          order_id:
            order.id,

          application_type:
            application_type,

          application_name:
            clean(application_name),

          notification_number:
            clean(notification_number),

          notification_pdf_url:
            clean(notification_pdf_url),

          application_start_date:
            application_start_date || null,

          application_end_date:
            application_end_date || null,

          government_fee:
            governmentFeeValue,

          service_fee:
            serviceFeeValue,

          total_amount:
            totalAmount,

          application_status:
            "documents_received",

          customer_details:
            parsedCustomerDetails,
        })
        .select()
        .single();

      if (applicationError) {
        throw applicationError;
      }

      /*
      |--------------------------------------------------------------------------
      | SAVE DOCUMENT RECORDS
      |--------------------------------------------------------------------------
      */

      const documentRows =
        uploadedDocuments.map(
          (document) => ({
            order_id:
              order.id,

            application_id:
              application.id,

            original_name:
              document.original_name,

            storage_path:
              document.storage_path,

            file_type:
              document.file_type,

            file_size:
              document.file_size,

            required_document_name:
              document.required_document_name,

            document_category:
              document.document_category,

            is_application_document:
              true,

            delete_at:
              null,
          })
        );

      const {
        data: documents,
        error: documentsError,
      } = await supabase
        .from("order_documents")
        .insert(documentRows)
        .select();

      if (documentsError) {
        throw documentsError;
      }

      /*
      |--------------------------------------------------------------------------
      | RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(201).json({
        status: "ok",

        message:
          "Application created successfully.",

        order,

        application,

        documents:
          documents || [],

        pricing: {
          government_fee:
            governmentFeeValue,

          service_fee:
            serviceFeeValue,

          total_amount:
            totalAmount,
        },
      });

    } catch (error) {
      console.error(
        "Create application error:",
        error
      );

      /*
      |--------------------------------------------------------------------------
      | CLEANUP UPLOADED FILES
      |--------------------------------------------------------------------------
      */

      if (uploadedPaths.length) {
        try {
          await supabase.storage
            .from(BUCKET)
            .remove(uploadedPaths);
        } catch (cleanupError) {
          console.error(
            "Application storage cleanup error:",
            cleanupError
          );
        }
      }

      return res.status(500).json({
        status: "error",
        message:
          error?.message ||
          "Unable to create application.",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| CUSTOMER - GET APPLICATION BY ORDER NUMBER + PHONE
|--------------------------------------------------------------------------
*/

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
            "Order number and phone are required.",
        });
      }

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .select("*")
        .eq(
          "order_number",
          String(order_number).trim()
        )
        .eq(
          "phone",
          String(phone).trim()
        )
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message:
            "Application not found.",
        });
      }

      const {
        data: application,
        error:
          applicationError,
      } = await supabase
        .from("service_applications")
        .select("*")
        .eq(
          "order_id",
          order.id
        )
        .maybeSingle();

      if (applicationError) {
        throw applicationError;
      }

      const {
        data: documents,
        error:
          documentsError,
      } = await supabase
        .from("order_documents")
        .select(`
          id,
          original_name,
          file_type,
          file_size,
          required_document_name,
          document_category,
          is_application_document,
          created_at
        `)
        .eq(
          "order_id",
          order.id
        )
        .eq(
          "is_application_document",
          true
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (documentsError) {
        throw documentsError;
      }

      return res.json({
        status: "ok",

        order,

        application,

        documents:
          documents || [],
      });

    } catch (error) {
      console.error(
        "Track application error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to track application.",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| ADMIN - GET ALL APPLICATIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/all",
  adminAuth,
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("service_applications")
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_name,
            phone,
            customer_email,
            status,
            payment_status,
            amount,
            created_at,
            updated_at
          )
        `)
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      return res.json({
        status: "ok",
        applications: data || [],
      });

    } catch (error) {
      console.error(
        "Admin applications error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to load applications.",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| ADMIN - UPDATE APPLICATION STATUS
|--------------------------------------------------------------------------
*/

router.patch(
  "/admin/:applicationId/status",
  adminAuth,
  async (req, res) => {
    try {
      const {
        applicationId,
      } = req.params;

      const {
        status,
        admin_notes,
      } = req.body || {};

      if (
        !APPLICATION_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application status.",
        });
      }

      const updateData = {
        application_status:
          status,

        updated_at:
          new Date().toISOString(),
      };

      if (
        admin_notes !== undefined
      ) {
        updateData.admin_notes =
          clean(admin_notes);
      }

      if (
        status === "submitted"
      ) {
        updateData.submitted_at =
          new Date().toISOString();
      }

      if (
        status === "completed"
      ) {
        updateData.completed_at =
          new Date().toISOString();
      }

      const {
        data,
        error,
      } = await supabase
        .from("service_applications")
        .update(updateData)
        .eq(
          "id",
          applicationId
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.json({
        status: "ok",

        message:
          "Application status updated.",

        application:
          data,
      });

    } catch (error) {
      console.error(
        "Application status error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to update application status.",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| ADMIN - GET APPLICATION DOCUMENTS
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/:applicationId/documents",
  adminAuth,
  async (req, res) => {
    try {
      const {
        applicationId,
      } = req.params;

      const {
        data,
        error,
      } = await supabase
        .from("order_documents")
        .select(`
          id,
          order_id,
          application_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          required_document_name,
          document_category,
          is_application_document,
          created_at
        `)
        .eq(
          "application_id",
          applicationId
        )
        .eq(
          "is_application_document",
          true
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      return res.json({
        status: "ok",
        documents:
          data || [],
      });

    } catch (error) {
      console.error(
        "Application documents error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to load application documents.",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| ADMIN - VIEW APPLICATION DOCUMENT
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/document/:documentId",
  adminAuth,
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
          application_id,
          original_name,
          storage_path,
          file_type
        `)
        .eq(
          "id",
          documentId
        )
        .eq(
          "is_application_document",
          true
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!document) {
        return res.status(404).json({
          status: "error",
          message:
            "Application document not found.",
        });
      }

      const {
        data: signedUrl,
        error:
          signedUrlError,
      } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          document.storage_path,
          60 * 10
        );

      if (signedUrlError) {
        throw signedUrlError;
      }

      return res.json({
        status: "ok",

        document: {
          id: document.id,

          application_id:
            document.application_id,

          original_name:
            document.original_name,

          file_type:
            document.file_type,

          url:
            signedUrl.signedUrl,

          expires_in:
            600,
        },
      });

    } catch (error) {
      console.error(
        "Application document error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to open application document.",
      });
    }
  }
);


export default router;