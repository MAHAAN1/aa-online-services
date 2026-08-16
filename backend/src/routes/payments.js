import express from "express";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    status: "ok",
    message: "Payment route is working"
  });
});

export default router;