import {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Upload,
  FileText,
  FileImage,
  X,
  CheckCircle,
  ArrowRight,
  Plus,
  Minus,
  CreditCard,
  Loader2,
  AlertCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS =
  /\.(pdf|jpg|jpeg|png|doc|docx)$/i;

/* ============================================================
   PRICING
   ============================================================

   PRINTING
   B&W:
     Single = ₹2
     Double = ₹3 for each 2-sided sheet

   COLOUR:
     Single = ₹5
     Double = ₹8 for each 2-sided sheet

   IMPORTANT:
   3 pages + double side:
     1 double-side sheet = ₹3
     1 single page       = ₹2
     TOTAL                = ₹5

   Therefore double-side pricing is based on physical sheets,
   with the final odd page charged as a single-side page.

   XEROX
   B&W:
     First page = ₹5
     Additional = ₹3

   Colour:
     First page = ₹10
     Additional = ₹6
*/

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

const RAZORPAY_SCRIPT =
  "https://checkout.razorpay.com/v1/checkout.js";

/* ============================================================
   HELPERS
============================================================ */

const createDocumentId = () =>
  `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "₹0.00";
  }

  return `₹${amount.toFixed(2)}`;
};

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

/* ============================================================
   PRINT PRICE CALCULATION
============================================================ */

const calculatePrintingPrice = (
  pages,
  copies,
  colorMode,
  sides
) => {
  pages = Number(pages);
  copies = Math.max(
    1,
    Number(copies) || 1
  );

  if (
    !Number.isFinite(pages) ||
    pages < 1
  ) {
    return 0;
  }

  const rates =
    PRINT_PRICE[colorMode] ||
    PRINT_PRICE.bw;

  if (sides === "double") {
    /*
      Example:

      1 page  = ₹2
      2 pages = ₹3
      3 pages = ₹3 + ₹2 = ₹5
      4 pages = ₹3 + ₹3 = ₹6
      5 pages = ₹3 + ₹3 + ₹2 = ₹8
    */

    const doubleSheets =
      Math.floor(pages / 2);

    const singlePage =
      pages % 2;

    return (
      doubleSheets *
        rates.double +
      singlePage *
        rates.single
    ) * copies;
  }

  return (
    pages *
    rates.single *
    copies
  );
};

/* ============================================================
   XEROX PRICE CALCULATION
============================================================ */

const calculateXeroxPrice = (
  pages,
  copies,
  colorMode
) => {
  pages = Number(pages);

  copies = Math.max(
    1,
    Number(copies) || 1
  );

  if (
    !Number.isFinite(pages) ||
    pages < 1
  ) {
    return 0;
  }

  const rates =
    XEROX_PRICE[colorMode] ||
    XEROX_PRICE.bw;

  const pricePerCopy =
    rates.firstPage +
    Math.max(
      0,
      pages - 1
    ) *
      rates.additionalPage;

  return pricePerCopy * copies;
};

/* ============================================================
   COMPLETE DOCUMENT PRICE
============================================================ */

const calculateDocumentPrice = (
  document
) => {
  const pages = Number(
    document.pages
  );

  const copies = Math.max(
    1,
    Number(document.copies) || 1
  );

  if (
    !Number.isFinite(pages) ||
    pages < 1
  ) {
    return 0;
  }

  if (
    document.service_type ===
    "xerox"
  ) {
    return calculateXeroxPrice(
      pages,
      copies,
      document.color_mode
    );
  }

  return calculatePrintingPrice(
    pages,
    copies,
    document.color_mode,
    document.sides
  );
};

/* ============================================================
   RAZORPAY SCRIPT
============================================================ */

let razorpayPromise = null;

const loadRazorpay = () => {
  if (
    typeof window !== "undefined" &&
    window.Razorpay
  ) {
    return Promise.resolve(true);
  }

  if (razorpayPromise) {
    return razorpayPromise;
  }

  razorpayPromise =
    new Promise(
      (resolve, reject) => {
        const existing =
          document.querySelector(
            `script[src="${RAZORPAY_SCRIPT}"]`
          );

        if (existing) {
          existing.addEventListener(
            "load",
            () => resolve(true),
            { once: true }
          );

          existing.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Unable to load Razorpay Checkout."
                )
              ),
            { once: true }
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          RAZORPAY_SCRIPT;

        script.async = true;

        script.onload = () =>
          resolve(true);

        script.onerror = () =>
          reject(
            new Error(
              "Unable to load Razorpay Checkout."
            )
          );

        document.body.appendChild(
          script
        );
      }
    );

  return razorpayPromise;
};

/* ============================================================
   API
============================================================ */

const parseResponse = async (
  response
) => {
  let data;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Server returned an invalid response."
    );
  }

  if (
    !response.ok ||
    data?.status === "error"
  ) {
    throw new Error(
      data?.message ||
        "Request failed."
    );
  }

  return data;
};

const createPaymentOrder = async (
  orderId
) => {
  const response =
    await fetch(
      `${API_URL}/payments/create`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          order_id: orderId,
        }),
      }
    );

  return parseResponse(
    response
  );
};

const verifyPayment = async (
  payload
) => {
  const response =
    await fetch(
      `${API_URL}/payments/verify`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          payload
        ),
      }
    );

  return parseResponse(
    response
  );
};

/* ============================================================
   COMPONENT
============================================================ */

export default function PrintOrder() {
  const fileInputRef =
    useRef(null);

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    paymentLoading,
    setPaymentLoading,
  ] = useState(false);

  const [
    success,
    setSuccess,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    paymentError,
    setPaymentError,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState({
    customer_name: "",
    phone: "",
    customer_email: "",
    lamination: false,
    spiral_binding: false,
    notes: "",
  });

  /* ==========================================================
     FORM
  ========================================================== */

  const updateForm = (
    key,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  /* ==========================================================
     ADD FILES
  ========================================================== */

  const addFiles = (
    selectedFiles
  ) => {
    setError("");
    setPaymentError("");
    setSuccess(null);

    const incoming =
      Array.from(
        selectedFiles || []
      );

    if (!incoming.length) {
      return;
    }

    if (
      documents.length +
        incoming.length >
      MAX_FILES
    ) {
      setError(
        `You can upload a maximum of ${MAX_FILES} documents per order.`
      );

      return;
    }

    const prepared = [];

    for (const file of incoming) {
      if (
        !ALLOWED_EXTENSIONS.test(
          file.name
        )
      ) {
        setError(
          `${file.name}: only PDF, JPG, PNG, DOC and DOCX files are allowed.`
        );

        continue;
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        setError(
          `${file.name}: file size must be 10 MB or smaller.`
        );

        continue;
      }

      prepared.push({
        id: createDocumentId(),

        file,

        name: file.name,

        size: file.size,

        pages: null,

        page_count_status:
          "pending_backend",

        service_type:
          "printing",

        service_name:
          "B&W Printing",

        color_mode: "bw",

        sides: "single",

        copies: 1,
      });
    }

    if (prepared.length) {
      setDocuments(
        (previous) => [
          ...previous,
          ...prepared,
        ]
      );
    }

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  /* ==========================================================
     REMOVE
  ========================================================== */

  const removeDocument = (
    id
  ) => {
    setDocuments(
      (previous) =>
        previous.filter(
          (document) =>
            document.id !== id
        )
    );
  };

  /* ==========================================================
     UPDATE DOCUMENT
  ========================================================== */

  const updateDocument = (
    id,
    changes
  ) => {
    setDocuments(
      (previous) =>
        previous.map(
          (document) => {
            if (
              document.id !== id
            ) {
              return document;
            }

            const updated = {
              ...document,
              ...changes,
            };

            if (
              changes.color_mode !==
                undefined ||
              changes.service_type !==
                undefined
            ) {
              updated.service_name =
                getServiceName(
                  updated.color_mode,
                  updated.service_type
                );
            }

            return updated;
          }
        )
    );
  };

  /* ==========================================================
     ESTIMATES
  ========================================================== */

  const totalPages =
    useMemo(
      () =>
        documents.reduce(
          (sum, document) =>
            sum +
            (Number(
              document.pages
            ) || 0),
          0
        ),
      [documents]
    );

  const estimatedPrintingTotal =
    useMemo(
      () =>
        documents.reduce(
          (sum, document) =>
            sum +
            calculateDocumentPrice(
              document
            ),
          0
        ),
      [documents]
    );

  const estimatedLaminationTotal =
    form.lamination
      ? documents.reduce(
          (sum, document) =>
            sum +
            (Number(
              document.pages
            ) || 0) *
              Math.max(
                1,
                Number(
                  document.copies
                ) || 1
              ) *
              LAMINATION_PRICE,
          0
        )
      : 0;

  const estimatedSpiralTotal =
    form.spiral_binding
      ? SPIRAL_PRICE
      : 0;

  const estimatedTotal =
    estimatedPrintingTotal +
    estimatedLaminationTotal +
    estimatedSpiralTotal;

  /* ==========================================================
     RESET
  ========================================================== */

  const resetOrderForm = () => {
    setDocuments([]);

    setForm({
      customer_name: "",
      phone: "",
      customer_email: "",
      lamination: false,
      spiral_binding: false,
      notes: "",
    });

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  /* ==========================================================
     RAZORPAY
  ========================================================== */

  const openRazorpayCheckout =
    async (internalOrder) => {
      setPaymentLoading(true);
      setPaymentError("");
      setError("");

      try {
        await loadRazorpay();

        if (!window.Razorpay) {
          throw new Error(
            "Razorpay Checkout is unavailable."
          );
        }

        const paymentData =
          await createPaymentOrder(
            internalOrder.id
          );

        const payment =
          paymentData?.payment;

        if (
          !payment?.key_id ||
          !payment?.razorpay_order_id ||
          !payment?.amount
        ) {
          throw new Error(
            "Invalid payment details received from server."
          );
        }

        const options = {
          key: payment.key_id,

          amount:
            payment.amount,

          currency:
            payment.currency ||
            "INR",

          name:
            "A&A Online Services",

          description:
            `Payment for ${
              payment.order_number ||
              internalOrder.order_number ||
              "Print Order"
            }`,

          order_id:
            payment.razorpay_order_id,

          prefill: {
            name:
              payment.customer_name ||
              internalOrder.customer_name ||
              form.customer_name,

            email:
              payment.customer_email ||
              internalOrder.customer_email ||
              form.customer_email,

            contact:
              payment.phone ||
              internalOrder.phone ||
              form.phone,
          },

          notes: {
            order_id: String(
              internalOrder.id
            ),

            order_number: String(
              internalOrder.order_number ||
                payment.order_number ||
                ""
            ),
          },

          theme: {
            color: "#2563eb",
          },

          modal: {
            escape: true,

            ondismiss: () => {
              setPaymentLoading(
                false
              );

              setPaymentError(
                "Payment window was closed. Your order is saved, but payment is still pending."
              );
            },
          },

          handler:
            async (
              response
            ) => {
              try {
                setPaymentLoading(
                  true
                );

                setPaymentError(
                  ""
                );

                const verification =
                  await verifyPayment(
                    {
                      order_id:
                        internalOrder.id,

                      razorpay_order_id:
                        response.razorpay_order_id,

                      razorpay_payment_id:
                        response.razorpay_payment_id,

                      razorpay_signature:
                        response.razorpay_signature,
                    }
                  );

                const verifiedOrder =
                  verification?.order ||
                  internalOrder;

                const finalPricing =
                  verification?.pricing ||
                  paymentData?.pricing ||
                  null;

                const finalAmount =
                  verification?.amount !=
                  null
                    ? Number(
                        verification.amount
                      ) / 100
                    : Number(
                        finalPricing?.final_amount ??
                          verifiedOrder.amount ??
                          internalOrder.amount ??
                          0
                      );

                setSuccess({
                  ...verifiedOrder,

                  pricing:
                    finalPricing,

                  amount:
                    finalAmount,

                  payment_status:
                    verification?.payment_status ||
                    "paid",

                  payment_id:
                    verification?.payment_id ||
                    response.razorpay_payment_id,

                  razorpay_order_id:
                    verification?.razorpay_order_id ||
                    response.razorpay_order_id,

                  message:
                    verification?.message ||
                    "Payment completed successfully.",
                });

                resetOrderForm();
              } catch (
                verificationError
              ) {
                console.error(
                  "Payment verification error:",
                  verificationError
                );

                setPaymentError(
                  verificationError.message ||
                    "Payment was received but verification failed. Please contact support with your order number."
                );
              } finally {
                setPaymentLoading(
                  false
                );
              }
            },
        };

        const razorpay =
          new window.Razorpay(
            options
          );

        razorpay.on(
          "payment.failed",
          (response) => {
            console.error(
              "Razorpay payment failed:",
              response
            );

            setPaymentLoading(
              false
            );

            setPaymentError(
              response?.error
                ?.description ||
                "Payment failed. Please try again."
            );
          }
        );

        razorpay.open();
      } catch (paymentRequestError) {
        console.error(
          "Payment initialization error:",
          paymentRequestError
        );

        setPaymentLoading(
          false
        );

        setPaymentError(
          paymentRequestError.message ||
            "Unable to start payment."
        );
      }
    };

  /* ==========================================================
     SUBMIT
  ========================================================== */

  const submitOrder = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setPaymentError("");
    setSuccess(null);

    if (!documents.length) {
      setError(
        "Please upload at least one document."
      );

      return;
    }

    if (
      !form.customer_name.trim()
    ) {
      setError(
        "Please enter your name."
      );

      return;
    }

    if (
      !/^[0-9]{10}$/.test(
        form.phone
      )
    ) {
      setError(
        "Please enter a valid 10-digit phone number."
      );

      return;
    }

    if (
      form.customer_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.customer_email
      )
    ) {
      setError(
        "Please enter a valid email address."
      );

      return;
    }

    setSubmitting(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "customer_name",
        form.customer_name.trim()
      );

      formData.append(
        "phone",
        form.phone.trim()
      );

      formData.append(
        "customer_email",
        form.customer_email.trim()
      );

      formData.append(
        "lamination",
        String(
          form.lamination
        )
      );

      formData.append(
        "spiral_binding",
        String(
          form.spiral_binding
        )
      );

      formData.append(
        "notes",
        form.notes.trim()
      );

      formData.append(
        "document_options",
        JSON.stringify(
          documents.map(
            (document) => ({
              client_id:
                document.id,

              original_name:
                document.name,

              pages:
                Number.isFinite(
                  Number(
                    document.pages
                  )
                )
                  ? Number(
                      document.pages
                    )
                  : null,

              copies: Math.max(
                1,
                Number(
                  document.copies
                ) || 1
              ),

              color_mode:
                document.color_mode,

              sides:
                document.sides,

              service_type:
                document.service_type,

              service_name:
                document.service_name,
            })
          )
        )
      );

      documents.forEach(
        (document) => {
          formData.append(
            "documents",
            document.file,
            document.file.name
          );
        }
      );

      const response =
        await fetch(
          `${API_URL}/orders/create`,
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await parseResponse(
          response
        );

      const internalOrder =
        data?.order;

      if (!internalOrder?.id) {
        throw new Error(
          "Order was created but the server did not return a valid order ID."
        );
      }

      setSubmitting(false);

      await openRazorpayCheckout(
        internalOrder
      );
    } catch (requestError) {
      console.error(
        "Order creation error:",
        requestError
      );

      setError(
        requestError.message ||
          "Unable to create order."
      );

      setSubmitting(false);
    }
  };

  const serverPricing =
    success?.pricing || null;

  const serverAmount =
    success?.amount ??
    serverPricing?.final_amount ??
    success?.final_amount ??
    0;

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-20 pt-28 text-slate-900">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <header className="mb-10">
          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
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

              <p className="text-xs text-slate-400">
                Digital Service & Printing Center
              </p>
            </div>

          </div>

          <h1 className="mt-7 text-4xl font-black tracking-tight md:text-6xl">
            Print smarter.
            <br />
            Pay only for what you print.
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-500 md:text-lg">
            Upload multiple documents,
            choose different options for
            every file, and get secure
            server-calculated pricing.
          </p>
        </header>

        {/* PRINT PRICES */}

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {[
            ["B&W Single", "₹2 / page"],
            ["B&W Double", "₹3 / 2-sided sheet"],
            ["Colour Single", "₹5 / page"],
            ["Colour Double", "₹8 / 2-sided sheet"],
          ].map(
            ([title, value]) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {title}
                </p>

                <p className="mt-1 text-xl font-black">
                  {value}
                </p>
              </div>
            )
          )}

        </div>

        {/* XEROX PRICES */}

        <div className="mb-8 grid gap-3 md:grid-cols-2">

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              B&W Xerox
            </p>

            <p className="mt-1 font-black">
              ₹5 first page + ₹3 each additional page
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Colour Xerox
            </p>

            <p className="mt-1 font-black">
              ₹10 first page + ₹6 each additional page
            </p>
          </div>

        </div>

        {/* SUCCESS */}

        {success && (
          <div className="mb-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">

            <div className="flex items-start gap-4">

              <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />

              <div className="min-w-0 flex-1">

                <h2 className="text-xl font-bold">
                  Payment completed successfully
                </h2>

                <p className="mt-1 text-sm text-emerald-800">
                  {success.message ||
                    "Your order and payment have been successfully processed."}
                </p>

                {success.order_number && (
                  <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">

                    <p className="text-xs uppercase tracking-wider text-slate-400">
                      Order Number
                    </p>

                    <p className="mt-1 break-all text-2xl font-black">
                      {success.order_number}
                    </p>

                    <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">

                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        Amount Paid
                      </p>

                      <p className="mt-1 text-4xl font-black text-emerald-700">
                        {formatCurrency(
                          serverAmount
                        )}
                      </p>

                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-400">
                          Order Status
                        </p>

                        <p className="mt-1 font-bold capitalize">
                          {success.status ||
                            "received"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-400">
                          Payment Status
                        </p>

                        <p className="mt-1 font-bold capitalize text-emerald-700">
                          {success.payment_status ||
                            "paid"}
                        </p>
                      </div>

                    </div>

                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ERRORS */}

        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">

            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <span>{error}</span>

          </div>
        )}

        {paymentError && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">

            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-bold">
                Payment status
              </p>

              <p className="mt-1">
                {paymentError}
              </p>
            </div>

          </div>
        )}

        <form onSubmit={submitOrder}>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">

            {/* MAIN */}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">

              {/* UPLOAD */}

              <div className="flex items-center justify-between gap-4">

                <div>
                  <h2 className="text-xl font-black">
                    01. Upload documents
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Up to {MAX_FILES} files · 10 MB each
                  </p>
                </div>

                <FileText className="h-6 w-6 text-blue-600" />

              </div>

              <div
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="mt-5 cursor-pointer rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition hover:border-blue-300 hover:bg-blue-50"
              >

                <Upload className="mx-auto h-10 w-10 text-blue-500" />

                <p className="mt-4 font-bold">
                  Choose documents
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  PDF, JPG, PNG, DOC and DOCX
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(event) =>
                    addFiles(
                      event.target.files
                    )
                  }
                />

              </div>

              {/* DOCUMENTS */}

              {documents.length > 0 && (
                <div className="mt-8 space-y-4">

                  <div className="flex items-center justify-between">

                    <h3 className="font-black">
                      Selected documents
                    </h3>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {documents.length} file
                      {documents.length ===
                      1
                        ? ""
                        : "s"}
                    </span>

                  </div>

                  {documents.map(
                    (
                      document,
                      index
                    ) => (
                      <div
                        key={document.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >

                        {/* FILE */}

                        <div className="flex items-start justify-between gap-4">

                          <div className="flex min-w-0 items-start gap-3">

                            {document.file.type.startsWith(
                              "image/"
                            ) ? (
                              <FileImage className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                            ) : (
                              <FileText className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                            )}

                            <div className="min-w-0">

                              <p className="truncate font-bold">
                                {document.name}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {(
                                  document.size /
                                  1024 /
                                  1024
                                ).toFixed(
                                  2
                                )}{" "}
                                MB · Page count
                                verified by server
                              </p>

                            </div>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeDocument(
                                document.id
                              )
                            }
                            className="rounded-xl p-2 text-slate-400 transition hover:bg-red-100 hover:text-red-600"
                            aria-label={`Remove ${document.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>

                        </div>

                        {/* OPTIONS */}

                        <div className="mt-5 grid gap-4 md:grid-cols-4">

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                              Service
                            </label>

                            <select
                              value={
                                document.service_type
                              }
                              onChange={(event) =>
                                updateDocument(
                                  document.id,
                                  {
                                    service_type:
                                      event.target.value,
                                  }
                                )
                              }
                              className="input-field"
                            >
                              <option value="printing">
                                Printing
                              </option>

                              <option value="xerox">
                                Xerox
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                              Colour
                            </label>

                            <select
                              value={
                                document.color_mode
                              }
                              onChange={(event) =>
                                updateDocument(
                                  document.id,
                                  {
                                    color_mode:
                                      event.target.value,
                                  }
                                )
                              }
                              className="input-field"
                            >
                              <option value="bw">
                                B&W
                              </option>

                              <option value="color">
                                Colour
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                              Sides
                            </label>

                            <select
                              value={
                                document.sides
                              }
                              disabled={
                                document.service_type ===
                                "xerox"
                              }
                              onChange={(event) =>
                                updateDocument(
                                  document.id,
                                  {
                                    sides:
                                      event.target.value,
                                  }
                                )
                              }
                              className="input-field disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="single">
                                Single Side
                              </option>

                              <option value="double">
                                Double Side
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                              Copies
                            </label>

                            <div className="flex h-[46px] items-center overflow-hidden rounded-xl border border-slate-200 bg-white">

                              <button
                                type="button"
                                onClick={() =>
                                  updateDocument(
                                    document.id,
                                    {
                                      copies:
                                        Math.max(
                                          1,
                                          Number(
                                            document.copies
                                          ) - 1
                                        ),
                                    }
                                  )
                                }
                                className="flex h-full w-11 items-center justify-center hover:bg-slate-100"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span className="flex-1 text-center font-black">
                                {document.copies}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  updateDocument(
                                    document.id,
                                    {
                                      copies:
                                        Math.min(
                                          1000,
                                          Number(
                                            document.copies
                                          ) + 1
                                        ),
                                    }
                                  )
                                }
                                className="flex h-full w-11 items-center justify-center hover:bg-slate-100"
                              >
                                <Plus className="h-4 w-4" />
                              </button>

                            </div>
                          </div>

                        </div>

                        {/* REQUEST SUMMARY */}

                        <div className="mt-4 rounded-2xl bg-white px-4 py-4">

                          <div className="flex flex-wrap items-center justify-between gap-3">

                            <span className="text-sm font-bold text-slate-700">
                              Document{" "}
                              {index + 1}
                            </span>

                            <span className="text-sm font-black text-blue-700">
                              {document.service_type ===
                              "xerox"
                                ? document.color_mode ===
                                  "color"
                                  ? "Colour Xerox"
                                  : "B&W Xerox"
                                : document.color_mode ===
                                  "color"
                                ? document.sides ===
                                  "double"
                                  ? "Colour · Double Side"
                                  : "Colour · Single Side"
                                : document.sides ===
                                  "double"
                                ? "B&W · Double Side"
                                : "B&W · Single Side"}
                            </span>

                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">

                            <div>
                              <p className="text-slate-400">
                                Pages
                              </p>

                              <p className="mt-1 font-bold">
                                {document.pages ||
                                  "Server verified"}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">
                                Copies
                              </p>

                              <p className="mt-1 font-bold">
                                {document.copies}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">
                                Sides
                              </p>

                              <p className="mt-1 font-bold">
                                {document.service_type ===
                                "xerox"
                                  ? "N/A"
                                  : document.sides ===
                                    "double"
                                  ? "2-sided"
                                  : "1-sided"}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">
                                Estimate
                              </p>

                              <p className="mt-1 font-black text-blue-700">
                                {document.pages
                                  ? formatCurrency(
                                      calculateDocumentPrice(
                                        document
                                      )
                                    )
                                  : "Server calculated"}
                              </p>
                            </div>

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

              {/* CUSTOMER DETAILS */}

              <div className="mt-10">

                <h2 className="text-xl font-black">
                  02. Your details
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">

                  <input
                    value={
                      form.customer_name
                    }
                    onChange={(event) =>
                      updateForm(
                        "customer_name",
                        event.target.value
                      )
                    }
                    placeholder="Full name"
                    className="input-field"
                    required
                  />

                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateForm(
                        "phone",
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
                    placeholder="Phone number"
                    inputMode="numeric"
                    className="input-field"
                    required
                  />

                  <input
                    value={
                      form.customer_email
                    }
                    onChange={(event) =>
                      updateForm(
                        "customer_email",
                        event.target.value
                      )
                    }
                    placeholder="Email address (optional)"
                    type="email"
                    className="input-field md:col-span-2"
                  />

                </div>

              </div>

              {/* FINISHING */}

              <div className="mt-10">

                <h2 className="text-xl font-black">
                  03. Finishing options
                </h2>

                <div className="mt-5 grid gap-3 md:grid-cols-2">

                  <label className="option-card">

                    <input
                      type="checkbox"
                      checked={
                        form.lamination
                      }
                      onChange={(event) =>
                        updateForm(
                          "lamination",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>
                        Lamination
                      </strong>

                      <small>
                        ₹
                        {
                          LAMINATION_PRICE
                        }{" "}
                        per printed page
                      </small>
                    </span>

                  </label>

                  <label className="option-card">

                    <input
                      type="checkbox"
                      checked={
                        form.spiral_binding
                      }
                      onChange={(event) =>
                        updateForm(
                          "spiral_binding",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>
                        Spiral Binding
                      </strong>

                      <small>
                        ₹
                        {
                          SPIRAL_PRICE
                        }{" "}
                        per order
                      </small>
                    </span>

                  </label>

                </div>

              </div>

              {/* NOTES */}

              <div className="mt-10">

                <h2 className="text-xl font-black">
                  04. Additional notes
                </h2>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateForm(
                      "notes",
                      event.target.value
                    )
                  }
                  placeholder="Any special instructions?"
                  rows={4}
                  className="input-field mt-5 resize-none py-3"
                />

              </div>

            </section>

            {/* SUMMARY */}

            <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />

                  <h2 className="text-xl font-black">
                    Order summary
                  </h2>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  {documents.length} files
                </span>

              </div>

              <div className="mt-6 space-y-3">

                {documents.length ===
                0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">
                    Add documents to continue.
                  </p>
                ) : (
                  documents.map(
                    (document) => (
                      <div
                        key={document.id}
                        className="rounded-2xl bg-slate-50 p-4"
                      >

                        <p className="truncate text-sm font-bold">
                          {document.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {document.copies} copies ·{" "}
                          {document.service_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {document.pages
                            ? `${document.pages} pages`
                            : "Pages verified by server"}
                        </p>

                      </div>
                    )
                  )
                )}

              </div>

              <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm">

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Total pages
                  </span>

                  <span className="font-semibold">
                    {totalPages ||
                      "Server verified"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Printing / Xerox
                  </span>

                  <span className="font-semibold">
                    {estimatedPrintingTotal
                      ? formatCurrency(
                          estimatedPrintingTotal
                        )
                      : "Server calculated"}
                  </span>
                </div>

                {form.lamination && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Lamination
                    </span>

                    <span className="font-semibold">
                      {estimatedLaminationTotal
                        ? formatCurrency(
                            estimatedLaminationTotal
                          )
                        : "Server calculated"}
                    </span>
                  </div>
                )}

                {form.spiral_binding && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Spiral binding
                    </span>

                    <span className="font-semibold">
                      {formatCurrency(
                        SPIRAL_PRICE
                      )}
                    </span>
                  </div>
                )}

              </div>

              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
                  Estimated total
                </p>

                <p className="mt-1 text-2xl font-black text-blue-700">
                  {estimatedTotal >
                  0
                    ? formatCurrency(
                        estimatedTotal
                      )
                    : "Calculated after upload"}
                </p>

                <p className="mt-1 text-xs text-blue-600">
                  Final payable amount is calculated and verified by the server.
                </p>

              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  paymentLoading ||
                  documents.length === 0
                }
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating order...
                  </>
                ) : paymentLoading ? (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Processing payment...
                  </>
                ) : (
                  <>
                    Continue to payment
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}

              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                Your payment amount is calculated
                on the server. The browser cannot
                change the payable amount.
              </p>

            </aside>

          </div>

        </form>

      </div>

      <style>{`

        .input-field {
          width: 100%;
          min-height: 46px;
          border-radius: 12px;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 13px;
          color: rgb(15 23 42);
          outline: none;
          transition: 0.2s;
        }

        textarea.input-field {
          padding-top: 12px;
          padding-bottom: 12px;
        }

        .input-field:focus {
          border-color: rgb(96 165 250);
          box-shadow:
            0 0 0 3px
            rgb(219 234 254);
        }

        .input-field option {
          background: white;
          color: rgb(15 23 42);
        }

        .option-card {
          display: flex;
          align-items: center;
          gap: 13px;
          cursor: pointer;
          border: 1px solid rgb(226 232 240);
          border-radius: 16px;
          padding: 15px;
          background: rgb(248 250 252);
        }

        .option-card:hover {
          border-color: rgb(147 197 253);
          background: rgb(239 246 255);
        }

        .option-card input {
          width: 18px;
          height: 18px;
          accent-color: rgb(37 99 235);
        }

        .option-card span {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .option-card small {
          color: rgb(100 116 139);
        }

      `}</style>
    </main>
  );
}