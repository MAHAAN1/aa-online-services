import express from "express";
import crypto from "crypto";
import { supabase } from "../services/supabase.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

// ==========================================
// CREATE ENQUIRY
// PUBLIC
// ==========================================

router.post("/", async (req, res) => {
  try {
    const {
      customer_name,
      phone,
      email,
      category,
      subject,
      message,
    } = req.body || {};

    if (
      !customer_name?.trim() ||
      !phone?.trim() ||
      !category?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Customer name, phone, category, subject and message are required.",
      });
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
      return res.status(400).json({
        status: "error",
        message:
          "Please enter a valid 10-digit phone number.",
      });
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Please enter a valid email address.",
      });
    }

    const now = new Date();

    const date = now
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    const random = crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();

    const enquiryNumber =
      `ENQ-${date}-${random}`;

    const {
      data,
      error,
    } = await supabase
      .from("enquiries")
      .insert({
        enquiry_number:
          enquiryNumber,

        customer_name:
          customer_name.trim(),

        phone:
          phone.trim(),

        email:
          email?.trim() || null,

        category:
          category.trim(),

        subject:
          subject.trim(),

        message:
          message.trim(),

        status:
          "new",
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Enquiry creation database error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to create enquiry.",
      });
    }

    return res.status(201).json({
      status: "ok",
      message:
        "Enquiry submitted successfully.",
      enquiry: data,
    });
  } catch (error) {
    console.error(
      "Enquiry creation API error:",
      error
    );

    return res.status(500).json({
      status: "error",
      message:
        "Server error while creating enquiry.",
    });
  }
});

// ==========================================
// TRACK ENQUIRY
// PUBLIC
// ==========================================

router.get("/track", async (req, res) => {
  try {
    const {
      enquiry_number,
      phone,
    } = req.query;

    if (
      !enquiry_number ||
      !phone
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Enquiry number and phone number are required.",
      });
    }

    const {
      data,
      error,
    } = await supabase
      .from("enquiries")
      .select(`
        id,
        enquiry_number,
        customer_name,
        phone,
        email,
        category,
        subject,
        message,
        status,
        admin_reply,
        created_at,
        updated_at
      `)
      .eq(
        "enquiry_number",
        enquiry_number.trim()
      )
      .eq(
        "phone",
        phone.trim()
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Enquiry tracking database error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to track enquiry.",
      });
    }

    if (!data) {
      return res.status(404).json({
        status: "error",
        message:
          "Enquiry not found. Check your enquiry number and phone number.",
      });
    }

    return res.json({
      status: "ok",
      enquiry: data,
    });
  } catch (error) {
    console.error(
      "Enquiry tracking API error:",
      error
    );

    return res.status(500).json({
      status: "error",
      message:
        "Server error while tracking enquiry.",
    });
  }
});

// ==========================================
// ADMIN AUTHENTICATION
// Everything below /admin is protected.
// ==========================================

router.use("/admin", adminAuth);

// ==========================================
// ADMIN - GET ALL ENQUIRIES
// ==========================================

router.get(
  "/admin/all",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("enquiries")
        .select(`
          id,
          enquiry_number,
          customer_name,
          phone,
          email,
          category,
          subject,
          message,
          status,
          admin_reply,
          created_at,
          updated_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "Admin enquiries database error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to load enquiries.",

          database_error:
            error.message,

          database_code:
            error.code,

          database_details:
            error.details,

          database_hint:
            error.hint,
        });
      }

      return res.json({
        status: "ok",
        enquiries:
          data || [],
      });
    } catch (error) {
      console.error(
        "Admin enquiries API error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while loading enquiries.",

        error:
          error.message,
      });
    }
  }
);

// ==========================================
// ADMIN - GET SINGLE ENQUIRY
// ==========================================

router.get(
  "/admin/:enquiryId",
  async (req, res) => {
    try {
      const {
        enquiryId,
      } = req.params;

      const {
        data,
        error,
      } = await supabase
        .from("enquiries")
        .select(`
          id,
          enquiry_number,
          customer_name,
          phone,
          email,
          category,
          subject,
          message,
          status,
          admin_reply,
          created_at,
          updated_at
        `)
        .eq(
          "id",
          enquiryId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Admin enquiry lookup error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to load enquiry.",

          database_error:
            error.message,

          database_code:
            error.code,

          database_details:
            error.details,

          database_hint:
            error.hint,
        });
      }

      if (!data) {
        return res.status(404).json({
          status: "error",
          message:
            "Enquiry not found.",
        });
      }

      return res.json({
        status: "ok",
        enquiry: data,
      });
    } catch (error) {
      console.error(
        "Admin enquiry lookup API error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while loading enquiry.",
      });
    }
  }
);

// ==========================================
// ADMIN - UPDATE ENQUIRY
// ==========================================

router.patch(
  "/admin/:enquiryId",
  async (req, res) => {
    try {
      const {
        enquiryId,
      } = req.params;

      const {
        status,
        admin_reply,
      } = req.body || {};

      const allowedStatuses = [
        "new",
        "reviewing",
        "replied",
        "resolved",
        "cancelled",
      ];

      if (
        status &&
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid enquiry status.",
        });
      }

      if (
        status === undefined &&
        admin_reply === undefined
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "No enquiry changes were provided.",
        });
      }

      const updateData = {
        updated_at:
          new Date().toISOString(),
      };

      if (status !== undefined) {
        updateData.status =
          status;
      }

      if (
        admin_reply !== undefined
      ) {
        updateData.admin_reply =
          admin_reply?.trim() ||
          null;
      }

      const {
        data,
        error,
      } = await supabase
        .from("enquiries")
        .update(updateData)
        .eq(
          "id",
          enquiryId
        )
        .select()
        .single();

      if (error) {
        console.error(
          "Enquiry update database error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to update enquiry.",

          database_error:
            error.message,

          database_code:
            error.code,

          database_details:
            error.details,

          database_hint:
            error.hint,
        });
      }

      return res.json({
        status: "ok",
        message:
          "Enquiry updated.",
        enquiry: data,
      });
    } catch (error) {
      console.error(
        "Enquiry update API error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Server error while updating enquiry.",

        error:
          error.message,
      });
    }
  }
);

export default router;