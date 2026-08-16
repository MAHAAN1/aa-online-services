import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from backend/.env");
}

export default function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication token is missing.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Your existing login creates role: "admin"
    if (decoded.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Admin access required.",
      });
    }

    // Make the authenticated admin available to protected routes
    req.admin = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("Admin authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Admin session expired. Please log in again.",
      });
    }

    return res.status(401).json({
      status: "error",
      message: "Invalid admin session.",
    });
  }
}