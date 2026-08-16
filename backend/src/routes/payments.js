import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";

import { supabase } from "../services/supabase.js";

const router = express.Router();

const KEY_ID =
  process.env.RAZORPAY_KEY_ID;

const KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET;

const WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET;

const PAYMENT_CURRENCY = "INR";

if (!KEY_ID || !KEY_SECRET) {
  throw new Error(
    "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required."
  );
}

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

// ======================================================
// HELPERS
// ======================================================

const safeEqual = (
  received,
  expected
) => {
  if (
    typeof received !== "string" ||
    typeof expected !== "string"
  ) {
    return false;
  }

  const receivedBuffer =
    Buffer.from(received, "utf8");

  const expectedBuffer =
    Buffer.from(expected, "utf8");

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
};

const generatePaymentSignature = (
  razorpayOrderId,
  razorpayPaymentId
) =>
  crypto
    .createHmac(
      "sha256",
      KEY_SECRET
    )
    .update(
      `${razorpayOrderId}|${razorpayPaymentId}`
    )
    .digest("hex");

const amountToPaise = (
  amount
) => {
  const value =
    Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return Math.round(
    value * 100
  );
};

const normalizePaymentStatus = (
  status
) =>
  String(
    status || ""
  ).toLowerCase();

const isValidOrderId = (
  value
) =>
  typeof value ===
    "string" &&
  value.trim().length > 0;

// ======================================================
// TEST
// ======================================================

router.get(
  "/test",
  (req, res) => {
    return res.json({
      status: "ok",
      message:
        "Payment route is working.",
    });
  }
);

// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================
//
// Frontend sends ONLY internal order_id.
// Amount is always taken from Supabase.
// Never trust an amount supplied by browser.
// ======================================================

router.post(
  "/create",
  async (req, res) => {
    try {
      const {
        order_id,
      } = req.body || {};

      if (
        !isValidOrderId(
          order_id
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Order ID is required.",
        });
      }

      const {
        data: order,
        error,
      } =
        await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            customer_name,
            customer_email,
            phone,
            amount,
            payment_status,
            status
          `)
          .eq(
            "id",
            order_id.trim()
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Payment order lookup error:",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to load order for payment.",
        });
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message:
            "Order not found.",
        });
      }

      if (
        normalizePaymentStatus(
          order.payment_status
        ) === "paid"
      ) {
        return res.status(409).json({
          status: "error",
          code:
            "ALREADY_PAID",
          message:
            "This order has already been paid.",
        });
      }

      const amount =
        amountToPaise(
          order.amount
        );

      if (!amount) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid order amount.",
        });
      }

      const razorpayOrder =
        await razorpay.orders.create({
          amount,

          currency:
            PAYMENT_CURRENCY,

          receipt:
            String(
              order.order_number
            ).slice(
              0,
              40
            ),

          notes: {
            internal_order_id:
              String(
                order.id
              ),

            order_number:
              String(
                order.order_number
              ),
          },
        });

      return res.status(201).json({
        status: "ok",

        payment: {
          key_id:
            KEY_ID,

          razorpay_order_id:
            razorpayOrder.id,

          amount:
            razorpayOrder.amount,

          currency:
            razorpayOrder.currency,

          receipt:
            razorpayOrder.receipt,

          order_id:
            order.id,

          order_number:
            order.order_number,

          customer_name:
            order.customer_name,

          customer_email:
            order.customer_email,

          phone:
            order.phone,
        },
      });
    } catch (error) {
      console.error(
        "Create Razorpay order error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Unable to create payment order.",
      });
    }
  }
);

// ======================================================
// VERIFY PAYMENT
// ======================================================
//
// Performs all of these checks:
//
// 1. Internal order exists
// 2. Razorpay order exists
// 3. Razorpay order belongs to internal order
// 4. Amount matches
// 5. Currency matches
// 6. Signature matches
// 7. Payment belongs to Razorpay order
// 8. Payment amount matches
// 9. Payment is captured
// 10. Database records payment details
// ======================================================

router.post(
  "/verify",
  async (req, res) => {
    try {
      const {
        order_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body || {};

      if (
        !isValidOrderId(
          order_id
        ) ||
        typeof razorpay_order_id !==
          "string" ||
        typeof razorpay_payment_id !==
          "string" ||
        typeof razorpay_signature !==
          "string" ||
        !razorpay_order_id.trim() ||
        !razorpay_payment_id.trim() ||
        !razorpay_signature.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Incomplete payment verification data.",
        });
      }

      const normalizedOrderId =
        order_id.trim();

      const normalizedRazorpayOrderId =
        razorpay_order_id.trim();

      const normalizedPaymentId =
        razorpay_payment_id.trim();

      const normalizedSignature =
        razorpay_signature.trim();

      // --------------------------------------------------
      // LOAD INTERNAL ORDER
      // --------------------------------------------------

      const {
        data: order,
        error: orderError,
      } =
        await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            customer_name,
            customer_email,
            phone,
            amount,
            payment_status,
            status
          `)
          .eq(
            "id",
            normalizedOrderId
          )
          .maybeSingle();

      if (orderError) {
        console.error(
          "Payment verification order lookup error:",
          orderError
        );

        return res.status(500).json({
          status: "error",
          message:
            "Unable to verify payment order.",
        });
      }

      if (!order) {
        return res.status(404).json({
          status: "error",
          message:
            "Order not found.",
        });
      }

      // --------------------------------------------------
      // IDEMPOTENT RESPONSE
      // --------------------------------------------------

      if (
        normalizePaymentStatus(
          order.payment_status
        ) === "paid"
      ) {
        return res.json({
          status: "ok",

          message:
            "Payment is already verified.",

          payment_status:
            "paid",

          order,
        });
      }

      // --------------------------------------------------
      // FETCH RAZORPAY ORDER
      // --------------------------------------------------

      const razorpayOrder =
        await razorpay.orders.fetch(
          normalizedRazorpayOrderId
        );

      if (
        !razorpayOrder ||
        razorpayOrder.id !==
          normalizedRazorpayOrderId
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Razorpay order verification failed.",
        });
      }

      // --------------------------------------------------
      // VERIFY INTERNAL ORDER ID
      // --------------------------------------------------

      const razorpayInternalOrderId =
        razorpayOrder.notes
          ?.internal_order_id;

      if (
        razorpayInternalOrderId &&
        String(
          razorpayInternalOrderId
        ) !==
          String(
            order.id
          )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Razorpay order does not belong to this order.",
        });
      }

      // --------------------------------------------------
      // VERIFY ORDER NUMBER
      // --------------------------------------------------

      const razorpayOrderNumber =
        razorpayOrder.notes
          ?.order_number;

      if (
        razorpayOrderNumber &&
        String(
          razorpayOrderNumber
        ) !==
          String(
            order.order_number
          )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Razorpay order reference mismatch.",
        });
      }

      // --------------------------------------------------
      // VERIFY AMOUNT
      // --------------------------------------------------

      const expectedAmount =
        amountToPaise(
          order.amount
        );

      if (
        !expectedAmount
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid internal order amount.",
        });
      }

      if (
        Number(
          razorpayOrder.amount
        ) !==
        Number(
          expectedAmount
        )
      ) {
        console.error(
          "Payment amount mismatch:",
          {
            database:
              expectedAmount,

            razorpay:
              razorpayOrder.amount,

            order_id:
              order.id,
          }
        );

        return res.status(400).json({
          status: "error",
          message:
            "Payment amount does not match the order.",
        });
      }

      // --------------------------------------------------
      // VERIFY CURRENCY
      // --------------------------------------------------

      if (
        razorpayOrder.currency !==
        PAYMENT_CURRENCY
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Payment currency does not match the order currency.",
        });
      }

      // --------------------------------------------------
      // VERIFY SIGNATURE
      // --------------------------------------------------

      const expectedSignature =
        generatePaymentSignature(
          razorpayOrder.id,
          normalizedPaymentId
        );

      if (
        !safeEqual(
          normalizedSignature,
          expectedSignature
        )
      ) {
        console.error(
          "Invalid Razorpay payment signature."
        );

        return res.status(400).json({
          status: "error",
          message:
            "Payment verification failed.",
        });
      }

      // --------------------------------------------------
      // FETCH PAYMENT DIRECTLY FROM RAZORPAY
      // --------------------------------------------------

      const payment =
        await razorpay.payments.fetch(
          normalizedPaymentId
        );

      if (!payment) {
        return res.status(404).json({
          status: "error",
          message:
            "Razorpay payment not found.",
        });
      }

      // --------------------------------------------------
      // PAYMENT → ORDER CHECK
      // --------------------------------------------------

      if (
        payment.order_id !==
        razorpayOrder.id
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Payment is not linked to this order.",
        });
      }

      // --------------------------------------------------
      // PAYMENT AMOUNT CHECK
      // --------------------------------------------------

      if (
        Number(
          payment.amount
        ) !==
        Number(
          expectedAmount
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Paid amount does not match order amount.",
        });
      }

      // --------------------------------------------------
      // PAYMENT CURRENCY CHECK
      // --------------------------------------------------

      if (
        payment.currency !==
        PAYMENT_CURRENCY
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Paid currency does not match order currency.",
        });
      }

      // --------------------------------------------------
      // CAPTURED ONLY
      // --------------------------------------------------

      const paymentStatus =
        normalizePaymentStatus(
          payment.status
        );

      if (
        paymentStatus !==
        "captured"
      ) {
        if (
          paymentStatus ===
          "failed"
        ) {
          return res.status(402).json({
            status: "error",

            message:
              "Payment failed.",

            payment_status:
              payment.status,

            order,
          });
        }

        return res.status(202).json({
          status: "pending",

          message:
            "Payment is authorized but not yet captured.",

          payment_status:
            payment.status,

          order,
        });
      }

      // --------------------------------------------------
      // UPDATE DATABASE
      // --------------------------------------------------

      const {
        data: updatedOrder,
        error: updateError,
      } =
        await supabase
          .from("orders")
          .update({
            payment_status:
              "paid",

            paid_amount:
              Number(
                payment.amount
              ) / 100,

            razorpay_order_id:
              razorpayOrder.id,

            razorpay_payment_id:
              normalizedPaymentId,

            paid_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            order.id
          )
          .select()
          .single();

      if (updateError) {
        console.error(
          "Payment database update error:",
          updateError
        );

        return res.status(500).json({
          status: "error",

          code:
            "PAYMENT_VERIFIED_DATABASE_UPDATE_FAILED",

          message:
            "Payment was verified but order status could not be updated.",
        });
      }

      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      return res.json({
        status: "ok",

        message:
          "Payment verified successfully.",

        payment_status:
          "paid",

        payment_id:
          normalizedPaymentId,

        razorpay_order_id:
          razorpayOrder.id,

        amount:
          payment.amount,

        amount_rupees:
          Number(
            payment.amount
          ) / 100,

        currency:
          payment.currency,

        order:
          updatedOrder,
      });
    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      if (
        error?.statusCode ===
          400 ||
        error?.statusCode ===
          404
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid Razorpay payment information.",
        });
      }

      return res.status(500).json({
        status: "error",
        message:
          "Unable to verify payment.",
      });
    }
  }
);

// ======================================================
// RAZORPAY WEBHOOK
// ======================================================
//
// IMPORTANT:
// req.body MUST be the raw Buffer.
// Register express.raw() for this endpoint in server.js.
// ======================================================

router.post(
  "/webhook",
  async (req, res) => {
    try {
      if (
        !WEBHOOK_SECRET
      ) {
        console.error(
          "RAZORPAY_WEBHOOK_SECRET is not configured."
        );

        return res.status(500).json({
          status: "error",
          message:
            "Webhook secret is not configured.",
        });
      }

      const signature =
        req.headers[
          "x-razorpay-signature"
        ];

      if (
        typeof signature !==
          "string" ||
        !signature.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Webhook signature missing.",
        });
      }

      const rawBody =
        Buffer.isBuffer(
          req.body
        )
          ? req.body
          : Buffer.from(
              req.body || ""
            );

      if (
        !rawBody.length
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Webhook body is empty.",
        });
      }

      // --------------------------------------------------
      // VERIFY WEBHOOK SIGNATURE
      // --------------------------------------------------

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            WEBHOOK_SECRET
          )
          .update(
            rawBody
          )
          .digest("hex");

      if (
        !safeEqual(
          signature.trim(),
          expectedSignature
        )
      ) {
        console.error(
          "Invalid Razorpay webhook signature."
        );

        return res.status(400).json({
          status: "error",
          message:
            "Invalid webhook signature.",
        });
      }

      // --------------------------------------------------
      // PARSE PAYLOAD
      // --------------------------------------------------

      let payload;

      try {
        payload =
          JSON.parse(
            rawBody.toString(
              "utf8"
            )
          );
      } catch {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid webhook payload.",
        });
      }

      const event =
        payload?.event;

      if (
        typeof event !==
          "string" ||
        !event
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Webhook event is missing.",
        });
      }

      const payment =
        payload?.payload
          ?.payment
          ?.entity;

      // ==================================================
      // PAYMENT CAPTURED
      // ==================================================

      if (
        event ===
        "payment.captured"
      ) {
        if (!payment) {
          return res.status(400).json({
            status: "error",
            message:
              "Payment information missing.",
          });
        }

        const internalOrderId =
          payment?.notes
            ?.internal_order_id;

        const orderNumber =
          payment?.notes
            ?.order_number;

        const razorpayOrderId =
          payment?.order_id;

        const razorpayPaymentId =
          payment?.id;

        const paidAmount =
          Number(
            payment?.amount
          ) / 100;

        if (
          !razorpayOrderId ||
          !razorpayPaymentId ||
          !Number.isFinite(
            paidAmount
          )
        ) {
          return res.status(400).json({
            status: "error",
            message:
              "Incomplete captured payment information.",
          });
        }

        // ----------------------------------------------
        // FIND INTERNAL ORDER
        // ----------------------------------------------

        let orderQuery =
          supabase
            .from("orders")
            .select(`
              id,
              order_number,
              amount,
              payment_status
            `);

        if (
          internalOrderId
        ) {
          orderQuery =
            orderQuery.eq(
              "id",
              internalOrderId
            );
        } else if (
          orderNumber
        ) {
          orderQuery =
            orderQuery.eq(
              "order_number",
              orderNumber
            );
        } else {
          return res.status(400).json({
            status: "error",
            message:
              "Internal order reference missing.",
          });
        }

        const {
          data: order,
          error: orderError,
        } =
          await orderQuery
            .maybeSingle();

        if (
          orderError
        ) {
          console.error(
            "Webhook order lookup error:",
            orderError
          );

          return res.status(500).json({
            status: "error",
            message:
              "Unable to find internal order.",
          });
        }

        if (!order) {
          return res.status(404).json({
            status: "error",
            message:
              "Internal order not found.",
          });
        }

        // ----------------------------------------------
        // VERIFY WEBHOOK AMOUNT
        // ----------------------------------------------

        const expectedAmount =
          Number(
            order.amount
          );

        if (
          !Number.isFinite(
            expectedAmount
          ) ||
          Math.round(
            expectedAmount *
              100
          ) !==
            Number(
              payment.amount
            )
        ) {
          console.error(
            "Webhook payment amount mismatch:",
            {
              order_id:
                order.id,

              expected:
                expectedAmount,

              received:
                paidAmount,
            }
          );

          return res.status(400).json({
            status: "error",
            message:
              "Webhook payment amount does not match order amount.",
          });
        }

        // ----------------------------------------------
        // VERIFY CURRENCY
        // ----------------------------------------------

        if (
          payment.currency !==
          PAYMENT_CURRENCY
        ) {
          return res.status(400).json({
            status: "error",
            message:
              "Webhook payment currency mismatch.",
          });
        }

        // ----------------------------------------------
        // UPDATE ORDER
        // ----------------------------------------------

        const {
          error: updateError,
        } =
          await supabase
            .from("orders")
            .update({
              payment_status:
                "paid",

              paid_amount:
                paidAmount,

              razorpay_order_id:
                razorpayOrderId,

              razorpay_payment_id:
                razorpayPaymentId,

              paid_at:
                new Date().toISOString(),

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              order.id
            );

        if (
          updateError
        ) {
          console.error(
            "Webhook order update error:",
            updateError
          );

          return res.status(500).json({
            status: "error",
            message:
              "Unable to update order.",
          });
        }
      }

      // ==================================================
      // PAYMENT FAILED
      // ==================================================

      if (
        event ===
        "payment.failed"
      ) {
        if (!payment) {
          return res.status(400).json({
            status: "error",
            message:
              "Payment information missing.",
          });
        }

        const internalOrderId =
          payment?.notes
            ?.internal_order_id;

        const orderNumber =
          payment?.notes
            ?.order_number;

        if (
          internalOrderId
        ) {
          const {
            error:
              updateError,
          } =
            await supabase
              .from("orders")
              .update({
                payment_status:
                  "failed",

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                internalOrderId
              );

          if (
            updateError
          ) {
            console.error(
              "Failed payment order update error:",
              updateError
            );

            return res.status(500).json({
              status: "error",
              message:
                "Unable to update failed payment.",
            });
          }
        } else if (
          orderNumber
        ) {
          const {
            error:
              updateError,
          } =
            await supabase
              .from("orders")
              .update({
                payment_status:
                  "failed",

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "order_number",
                orderNumber
              );

          if (
            updateError
          ) {
            console.error(
              "Failed payment order-number update error:",
              updateError
            );

            return res.status(500).json({
              status: "error",
              message:
                "Unable to update failed payment.",
            });
          }
        }
      }

      // ==================================================
      // OTHER EVENTS
      // ==================================================

      return res.status(200).json({
        status: "ok",
      });
    } catch (error) {
      console.error(
        "Razorpay webhook error:",
        error
      );

      return res.status(500).json({
        status: "error",
      });
    }
  }
);

export default router;