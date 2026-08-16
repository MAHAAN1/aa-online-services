import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../services/supabase.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from backend/.env");
}

// ==========================================
// ADMIN LOGIN
// ==========================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select(`
        id,
        name,
        email,
        password_hash,
        active
      `)
      .eq("email", email.trim().toLowerCase())
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("Admin login database error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to process login.",
      });
    }

    if (!admin) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: "admin",
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    return res.json({
      status: "ok",
      message: "Login successful.",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      status: "error",
      message: "Server error during login.",
    });
  }
});


// ==========================================
// VERIFY ADMIN TOKEN
// ==========================================

router.get("/verify", (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (decoded.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Admin access required.",
      });
    }

    return res.json({
      status: "ok",
      admin: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token.",
    });
  }
});

export default router;