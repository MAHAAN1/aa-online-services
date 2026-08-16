import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  LoaderCircle,
  PackageCheck,
  Search,
  XCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

const STATUS_STEPS = [
  {
    key: "received",
    label: "Received",
    description:
      "Your order has been received.",
  },
  {
    key: "reviewing",
    label: "Reviewing",
    description:
      "A&A is checking your order.",
  },
  {
    key: "awaiting_payment",
    label: "Payment",
    description:
      "Payment is required before processing.",
  },
  {
    key: "processing",
    label: "Processing",
    description:
      "Your order is being prepared.",
  },
  {
    key: "ready",
    label: "Ready",
    description:
      "Your order is ready for collection.",
  },
  {
    key: "completed",
    label: "Completed",
    description:
      "Your order has been completed.",
  },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "To be confirmed";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "To be confirmed";
  }

  return `₹${amount.toFixed(2)}`;
}

function getStatusIndex(status) {
  const index =
    STATUS_STEPS.findIndex(
      (step) => step.key === status
    );

  return index === -1 ? 0 : index;
}

function statusLabel(status) {
  const step =
    STATUS_STEPS.find(
      (item) => item.key === status
    );

  if (step) {
    return step.label;
  }

  if (
    status ===
    "needs_customer_action"
  ) {
    return "Action Required";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return status || "Unknown";
}

function paymentLabel(status) {
  if (!status) {
    return "Pending";
  }

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function getPaymentClass(status) {
  switch (status) {
    case "paid":
      return "bg-emerald-400/10 text-emerald-300";

    case "failed":
      return "bg-red-400/10 text-red-300";

    case "refunded":
      return "bg-purple-400/10 text-purple-300";

    default:
      return "bg-amber-400/10 text-amber-300";
  }
}

export default function TrackOrder() {
  const [
    orderNumber,
    setOrderNumber,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    order,
    setOrder,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const trackOrder = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setOrder(null);

    const cleanOrderNumber =
      orderNumber.trim();

    const cleanPhone =
      phone.trim();

    if (!cleanOrderNumber) {
      setError(
        "Please enter your order number."
      );
      return;
    }

    if (
      !/^[0-9]{10}$/.test(
        cleanPhone
      )
    ) {
      setError(
        "Please enter a valid 10-digit phone number."
      );
      return;
    }

    try {
      setLoading(true);

      const params =
        new URLSearchParams({
          order_number:
            cleanOrderNumber,
          phone: cleanPhone,
        });

      const response =
        await fetch(
          `${API_URL}/orders/track?${params.toString()}`
        );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Invalid response from server."
        );
      }

      if (
        !response.ok ||
        data?.status === "error"
      ) {
        throw new Error(
          data?.message ||
            "Unable to find your order."
        );
      }

      if (!data?.order) {
        throw new Error(
          "Order information was not returned by the server."
        );
      }

      setOrder(data.order);
    } catch (err) {
      console.error(
        "Track order error:",
        err
      );

      setError(
        err.message ||
          "Unable to track the order. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const currentIndex = order
    ? getStatusIndex(
        order.status
      )
    : 0;

  const isCancelled =
    order?.status ===
    "cancelled";

  const needsAction =
    order?.status ===
    "needs_customer_action";

  const paymentStatus =
    order?.payment_status ||
    "pending";

  const paidAmount =
    order?.paid_amount ??
    (paymentStatus === "paid"
      ? order?.amount
      : null);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071426] px-4 pb-20 pt-24 text-white">

      <div className="mx-auto max-w-5xl">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-10">

          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <div className="mb-6 flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/10 p-1.5 ring-1 ring-white/10">

              <img
                src="/logo.png"
                alt="A&A Online Services"
                className="h-full w-full object-contain"
              />

            </div>

            <div>
              <p className="text-sm font-bold">
                A&A Online Services
              </p>

              <p className="text-xs text-white/35">
                Digital Service & Printing Center
              </p>
            </div>

          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55">
            <PackageCheck size={15} />
            A&A Order Tracking
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Track your order.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/45">
            Enter your A&A order number and
            the phone number used when placing
            the order.
          </p>

        </div>

        {/* =====================================================
            SEARCH FORM
        ===================================================== */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

          <form
            onSubmit={trackOrder}
          >

            <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Order number
                </label>

                <input
                  value={orderNumber}
                  onChange={(event) =>
                    setOrderNumber(
                      event.target.value
                    )
                  }
                  placeholder="AA-20260816-ABC123"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Phone number
                </label>

                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(
                          0,
                          10
                        )
                    )
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-white px-7 font-bold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {loading ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Checking
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Track Order
                  </>
                )}

              </button>

            </div>

          </form>

        </section>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-200">

            <XCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>

              <p className="font-semibold">
                Unable to find order
              </p>

              <p className="mt-1 text-red-200/70">
                {error}
              </p>

            </div>

          </div>
        )}

        {/* =====================================================
            ORDER RESULT
        ===================================================== */}

        {order && (
          <section className="mt-8 space-y-6">

            {/* ORDER HEADER */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                <div>

                  <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                    Order number
                  </p>

                  <h2 className="mt-2 break-all text-2xl font-black sm:text-3xl">
                    {order.order_number}
                  </h2>

                  <p className="mt-2 text-sm text-white/40">
                    Placed{" "}
                    {formatDate(
                      order.created_at
                    )}
                  </p>

                </div>

                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    isCancelled
                      ? "bg-red-400/10 text-red-300"
                      : needsAction
                      ? "bg-amber-400/10 text-amber-300"
                      : "bg-emerald-400/10 text-emerald-300"
                  }`}
                >

                  {isCancelled ? (
                    <XCircle size={16} />
                  ) : needsAction ? (
                    <Clock3 size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}

                  {statusLabel(
                    order.status
                  )}

                </div>

              </div>

            </div>

            {/* =================================================
                PAYMENT SUMMARY
            ================================================= */}

            <div className="grid gap-4 sm:grid-cols-3">

              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl backdrop-blur-xl">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <CreditCard
                      size={18}
                    />
                  </div>

                  <div>

                    <p className="text-xs text-white/35">
                      Payment status
                    </p>

                    <p
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${getPaymentClass(
                        paymentStatus
                      )}`}
                    >
                      {paymentLabel(
                        paymentStatus
                      )}
                    </p>

                  </div>

                </div>

              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl backdrop-blur-xl">

                <p className="text-xs uppercase tracking-wider text-white/30">
                  Order amount
                </p>

                <p className="mt-2 text-2xl font-black">
                  {formatMoney(
                    order.amount
                  )}
                </p>

              </div>

              <div
                className={`rounded-3xl border p-5 shadow-xl backdrop-blur-xl ${
                  paymentStatus ===
                  "paid"
                    ? "border-emerald-400/15 bg-emerald-400/[0.055]"
                    : "border-white/10 bg-white/[0.055]"
                }`}
              >

                <p className="text-xs uppercase tracking-wider text-white/30">
                  Amount paid
                </p>

                <p
                  className={`mt-2 text-2xl font-black ${
                    paymentStatus ===
                    "paid"
                      ? "text-emerald-300"
                      : "text-white"
                  }`}
                >
                  {paymentStatus ===
                  "paid"
                    ? formatMoney(
                        paidAmount
                      )
                    : "Not paid"}
                </p>

              </div>

            </div>

            {/* =================================================
                STATUS TIMELINE
            ================================================= */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

              <div className="mb-8">

                <h2 className="text-xl font-bold">
                  Order progress
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Current status of your order
                </p>

              </div>

              {isCancelled ? (
                <div className="rounded-2xl border border-red-400/15 bg-red-400/5 p-5">

                  <div className="flex items-center gap-3">

                    <XCircle
                      size={22}
                      className="text-red-300"
                    />

                    <div>

                      <p className="font-bold text-red-200">
                        Order cancelled
                      </p>

                      <p className="mt-1 text-sm text-red-200/50">
                        Please contact A&A if
                        you believe this was
                        cancelled incorrectly.
                      </p>

                    </div>

                  </div>

                </div>
              ) : needsAction ? (
                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-5">

                  <div className="flex items-center gap-3">

                    <Clock3
                      size={22}
                      className="text-amber-300"
                    />

                    <div>

                      <p className="font-bold text-amber-200">
                        Action required
                      </p>

                      <p className="mt-1 text-sm text-amber-200/50">
                        Please contact A&A for
                        the next step.
                      </p>

                    </div>

                  </div>

                </div>
              ) : (
                <div className="relative">

                  <div className="absolute left-[22px] top-6 hidden h-[calc(100%-48px)] w-px bg-white/10 sm:block" />

                  <div className="space-y-7">

                    {STATUS_STEPS.map(
                      (
                        step,
                        index
                      ) => {
                        const completed =
                          index <=
                          currentIndex;

                        const current =
                          index ===
                          currentIndex;

                        return (
                          <div
                            key={
                              step.key
                            }
                            className="relative flex gap-4"
                          >

                            <div
                              className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                                completed
                                  ? "border-white bg-white text-slate-900"
                                  : "border-white/10 bg-[#071426] text-white/25"
                              }`}
                            >

                              {completed ? (
                                <Check
                                  size={18}
                                />
                              ) : (
                                <span className="text-xs font-bold">
                                  {index +
                                    1}
                                </span>
                              )}

                            </div>

                            <div className="pt-1">

                              <p
                                className={`font-semibold ${
                                  current
                                    ? "text-white"
                                    : completed
                                    ? "text-white/70"
                                    : "text-white/30"
                                }`}
                              >

                                {step.label}

                                {current && (
                                  <span className="ml-2 rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/50">
                                    Current
                                  </span>
                                )}

                              </p>

                              <p className="mt-1 text-sm text-white/35">
                                {
                                  step.description
                                }
                              </p>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>
              )}

            </div>

            {/* =================================================
                ORDER DETAILS
            ================================================= */}

            <div className="grid gap-6 md:grid-cols-2">

              {/* SERVICE */}

              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <FileText
                      size={18}
                    />
                  </div>

                  <div>

                    <p className="text-xs text-white/35">
                      Service
                    </p>

                    <p className="mt-1 font-bold">
                      {order.service ||
                        "Document Service"}
                    </p>

                  </div>

                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">

                  <div className="rounded-2xl bg-white/[0.04] p-4">

                    <p className="text-xs text-white/30">
                      Copies
                    </p>

                    <p className="mt-1 font-bold">
                      {order.copies ??
                        "—"}
                    </p>

                  </div>

                  <div className="rounded-2xl bg-white/[0.04] p-4">

                    <p className="text-xs text-white/30">
                      Last updated
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {formatDate(
                        order.updated_at
                      )}
                    </p>

                  </div>

                </div>

              </div>

              {/* PAYMENT */}

              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <CreditCard
                      size={18}
                    />
                  </div>

                  <div>

                    <p className="text-xs text-white/35">
                      Payment
                    </p>

                    <p className="mt-1 font-bold capitalize">
                      {paymentLabel(
                        paymentStatus
                      )}
                    </p>

                  </div>

                </div>

                <div className="mt-6 space-y-3">

                  <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-4">

                    <span className="text-sm text-white/40">
                      Order amount
                    </span>

                    <span className="text-lg font-bold">
                      {formatMoney(
                        order.amount
                      )}
                    </span>

                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-4">

                    <span className="text-sm text-white/40">
                      Amount paid
                    </span>

                    <span
                      className={`text-lg font-bold ${
                        paymentStatus ===
                        "paid"
                          ? "text-emerald-300"
                          : "text-white/50"
                      }`}
                    >
                      {paymentStatus ===
                      "paid"
                        ? formatMoney(
                            paidAmount
                          )
                        : "Not paid"}
                    </span>

                  </div>

                  {order.paid_at && (
                    <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-4">

                      <span className="text-sm text-white/40">
                        Paid at
                      </span>

                      <span className="text-right text-sm font-semibold">
                        {formatDate(
                          order.paid_at
                        )}
                      </span>

                    </div>
                  )}

                </div>

              </div>

            </div>

            {/* =================================================
                CUSTOMER MESSAGE
            ================================================= */}

            {order.notes && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

                <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                  Order notes
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/60">
                  {order.notes}
                </p>

              </div>
            )}

            {/* =================================================
                HELP
            ================================================= */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <h2 className="font-bold">
                    Need help with this order?
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    Contact A&A if you have
                    questions about your order.
                  </p>

                </div>

                <Link
                  to="/enquiry"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-white/90"
                >
                  Ask A&A
                  <ArrowLeft
                    size={15}
                    className="rotate-180"
                  />
                </Link>

              </div>

            </div>

          </section>
        )}

        {/* =====================================================
            EMPTY STATE
        ===================================================== */}

        {!order &&
          !loading &&
          !error && (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">

                <Search
                  size={26}
                  className="text-white/30"
                />

              </div>

              <h2 className="mt-5 text-xl font-bold">
                Enter your order details
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
                Your order number and phone
                number are used to securely
                find your A&A order.
              </p>

            </div>
          )}

      </div>
    </main>
  );
}