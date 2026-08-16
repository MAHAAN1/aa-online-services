import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STATUS_LABELS = {
  documents_pending: "Documents Pending",
  documents_received: "Documents Received",
  ready_to_apply: "Ready to Apply",
  application_in_progress: "Application In Progress",
  submitted: "Submitted",
  completed: "Completed",
  on_hold: "On Hold",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const parseRequirements = (item) => {
  if (
    Array.isArray(
      item?.required_documents
    )
  ) {
    return item.required_documents;
  }

  return [];
};

const getRequirementName = (item) => {
  if (typeof item === "string") {
    return item;
  }

  return (
    item?.name ||
    item?.document ||
    item?.title ||
    "Required document"
  );
};

const getRequirementCategory = (item) => {
  if (typeof item === "string") {
    return "application";
  }

  return (
    item?.category ||
    "application"
  );
};

export default function Application() {
  const location = useLocation();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  const opportunity =
    location.state?.opportunity || null;

  const applicationType =
    location.state?.applicationType ||
    (
      opportunity?.type === "scholarship"
        ? "scholarship"
        : "job"
    );

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    customer_email: "",
  });

  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [paymentError, setPaymentError] =
    useState("");

  const [success, setSuccess] =
    useState(null);

  const [submittedOrder, setSubmittedOrder] =
    useState(null);

  const requiredDocuments =
    useMemo(
      () =>
        parseRequirements(
          opportunity
        ),
      [opportunity]
    );

  const governmentFee = Math.max(
    0,
    Number(
      opportunity?.government_fee ??
        opportunity?.application_fee ??
        opportunity?.fee ??
        0
    ) || 0
  );

  const serviceFee = 100;

  const totalAmount =
    governmentFee +
    serviceFee;

  /*
  |--------------------------------------------------------------------------
  | LOAD RAZORPAY
  |--------------------------------------------------------------------------
  */

  const loadRazorpay = async () => {
    if (window.Razorpay) {
      return;
    }

    await new Promise(
      (resolve, reject) => {
        const existing =
          document.querySelector(
            'script[src*="checkout.razorpay.com"]'
          );

        if (existing) {
          existing.addEventListener(
            "load",
            resolve,
            { once: true }
          );

          existing.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Unable to load Razorpay."
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
          "https://checkout.razorpay.com/v1/checkout.js";

        script.async = true;

        script.onload = resolve;

        script.onerror = () =>
          reject(
            new Error(
              "Unable to load Razorpay."
            )
          );

        document.body.appendChild(
          script
        );
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | FORM
  |--------------------------------------------------------------------------
  */

  const updateForm = (
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /*
  |--------------------------------------------------------------------------
  | DOCUMENT UPLOAD
  |--------------------------------------------------------------------------
  */

  const addFiles = (fileList) => {
    const incoming =
      Array.from(fileList || []);

    if (!incoming.length) {
      return;
    }

    setError("");

    const allowedExtensions = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".doc",
      ".docx",
    ];

    const validFiles = [];

    for (const file of incoming) {
      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        setError(
          `${file.name} is larger than 10 MB.`
        );

        continue;
      }

      const lowerName =
        file.name.toLowerCase();

      const validExtension =
        allowedExtensions.some(
          (extension) =>
            lowerName.endsWith(
              extension
            )
        );

      if (!validExtension) {
        setError(
          `${file.name}: PDF, JPG, PNG, DOC and DOCX files only.`
        );

        continue;
      }

      validFiles.push(file);
    }

    setDocuments((current) => {
      const combined = [
        ...current,
        ...validFiles,
      ];

      const unique = [];

      const keys = new Set();

      for (const file of combined) {
        const key =
          `${file.name}-${file.size}-${file.lastModified}`;

        if (!keys.has(key)) {
          keys.add(key);
          unique.push(file);
        }
      }

      if (unique.length > MAX_FILES) {
        setError(
          `Maximum ${MAX_FILES} documents can be uploaded.`
        );

        return unique.slice(
          0,
          MAX_FILES
        );
      }

      return unique;
    });
  };

  const removeFile = (index) => {
    setDocuments((current) =>
      current.filter(
        (_, fileIndex) =>
          fileIndex !== index
      )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | PAYMENT
  |--------------------------------------------------------------------------
  */

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

        /*
        | Existing A&A payment endpoint
        */

        const paymentResponse =
          await fetch(
            `${API_URL}/orders/payment/create`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                order_id:
                  internalOrder.id,
              }),
            }
          );

        const paymentData =
          await paymentResponse.json();

        if (
          !paymentResponse.ok ||
          paymentData?.status ===
            "error"
        ) {
          throw new Error(
            paymentData?.message ||
              "Unable to initialize payment."
          );
        }

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
          key:
            payment.key_id,

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
              "Application"
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
            order_id:
              String(
                internalOrder.id
              ),

            order_number:
              String(
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
              setPaymentLoading(false);

              setPaymentError(
                "Payment window was closed. Your application is saved, but payment is still pending."
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

                setPaymentError("");

                /*
                | Existing A&A verification endpoint
                */

                const verificationResponse =
                  await fetch(
                    `${API_URL}/orders/verify`,
                    {
                      method: "POST",

                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      body:
                        JSON.stringify({
                          order_id:
                            internalOrder.id,

                          razorpay_order_id:
                            response.razorpay_order_id,

                          razorpay_payment_id:
                            response.razorpay_payment_id,

                          razorpay_signature:
                            response.razorpay_signature,
                        }),
                    }
                  );

                const verification =
                  await verificationResponse.json();

                if (
                  !verificationResponse.ok ||
                  verification?.status ===
                    "error"
                ) {
                  throw new Error(
                    verification?.message ||
                      "Payment verification failed."
                  );
                }

                setSuccess({
                  ...internalOrder,

                  application:
                    submittedOrder?.application ||
                    null,

                  payment_status:
                    verification?.payment_status ||
                    "paid",

                  payment_id:
                    verification?.payment_id ||
                    response.razorpay_payment_id,

                  message:
                    verification?.message ||
                    "Payment completed successfully.",
                });
              } catch (
                verificationError
              ) {
                console.error(
                  "Application payment verification error:",
                  verificationError
                );

                setPaymentError(
                  verificationError?.message ||
                    "Payment was received but verification failed."
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
            setPaymentLoading(false);

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
          "Application payment initialization error:",
          paymentRequestError
        );

        setPaymentLoading(false);

        setPaymentError(
          paymentRequestError?.message ||
            "Unable to start payment."
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | SUBMIT APPLICATION
  |--------------------------------------------------------------------------
  */

  const submitApplication =
    async (event) => {
      event.preventDefault();

      setError("");
      setPaymentError("");
      setSuccess(null);

      if (
        !form.customer_name.trim()
      ) {
        setError(
          "Enter your full name."
        );

        return;
      }

      if (
        !/^[0-9]{10}$/.test(
          form.phone.trim()
        )
      ) {
        setError(
          "Enter a valid 10-digit mobile number."
        );

        return;
      }

      if (
        form.customer_email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.customer_email.trim()
        )
      ) {
        setError(
          "Enter a valid email address."
        );

        return;
      }

      if (!opportunity) {
        setError(
          "Application information is missing. Please return to Services and select the application again."
        );

        return;
      }

      if (!documents.length) {
        setError(
          "Upload the required documents before continuing."
        );

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | CHECK REQUIRED DOCUMENT COUNT
      |--------------------------------------------------------------------------
      |
      | We do not force filename matching because customers may upload
      | documents with names such as IMG_2026.jpg or scan001.pdf.
      |
      | Admin will verify the actual document.
      |
      */

      setLoading(true);

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
          "application_type",
          applicationType
        );

        formData.append(
          "application_name",
          opportunity.name ||
            opportunity.title ||
            "Government Application"
        );

        formData.append(
          "notification_number",
          opportunity.notification_number ||
            ""
        );

        formData.append(
          "notification_pdf_url",
          opportunity.notification_pdf_url ||
            opportunity.notification_url ||
            opportunity.pdf_url ||
            opportunity.notification ||
            ""
        );

        formData.append(
          "application_start_date",
          opportunity.start_date ||
            opportunity.application_start_date ||
            ""
        );

        formData.append(
          "application_end_date",
          opportunity.end_date ||
            opportunity.application_end_date ||
            opportunity.last_date ||
            ""
        );

        formData.append(
          "government_fee",
          String(
            governmentFee
          )
        );

        formData.append(
          "service_fee",
          String(
            serviceFee
          )
        );

        formData.append(
          "customer_details",
          JSON.stringify({
            name:
              form.customer_name.trim(),

            phone:
              form.phone.trim(),

            email:
              form.customer_email.trim(),
          })
        );

        formData.append(
          "document_requirements",
          JSON.stringify(
            requiredDocuments.map(
              (item) => ({
                name:
                  getRequirementName(
                    item
                  ),

                category:
                  getRequirementCategory(
                    item
                  ),
              })
            )
          )
        );

        documents.forEach(
          (file) => {
            formData.append(
              "documents",
              file
            );
          }
        );

        const response =
          await fetch(
            `${API_URL}/applications/create`,
            {
              method: "POST",
              body: formData,
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          data?.status ===
            "error"
        ) {
          throw new Error(
            data?.message ||
              "Unable to create application."
          );
        }

        setSubmittedOrder(
          data
        );

        /*
        |--------------------------------------------------------------------------
        | START PAYMENT
        |--------------------------------------------------------------------------
        */

        await openRazorpayCheckout(
          data.order
        );
      } catch (err) {
        console.error(
          "Application submission error:",
          err
        );

        setError(
          err?.message ||
            "Unable to submit application."
        );
      } finally {
        setLoading(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | NO OPPORTUNITY
  |--------------------------------------------------------------------------
  */

  if (!opportunity) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 pb-20 pt-28">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() =>
              navigate("/services")
            }
            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            <ArrowLeft size={16} />
            Back to Services
          </button>

          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <FileText
              size={42}
              className="mx-auto text-slate-300"
            />

            <h1 className="mt-5 text-2xl font-black text-slate-900">
              Application not selected
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Select a job or scholarship from
              Services first.
            </p>
          </section>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SUCCESS
  |--------------------------------------------------------------------------
  */

  if (success) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 pb-20 pt-28">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm md:p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2
                size={34}
                className="text-emerald-600"
              />
            </div>

            <h1 className="mt-6 text-3xl font-black text-slate-900">
              Application submitted
            </h1>

            <p className="mt-3 text-slate-500">
              Your documents and payment have
              been received by A&A Online Services.
            </p>

            <div className="mt-7 space-y-3 rounded-2xl bg-slate-50 p-5">
              <div className="flex justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Application
                </span>

                <span className="text-right text-sm font-bold text-slate-900">
                  {opportunity.name ||
                    opportunity.title}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Order Number
                </span>

                <span className="text-sm font-bold text-slate-900">
                  {success.order_number}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Total Paid
                </span>

                <span className="text-sm font-black text-emerald-700">
                  {formatCurrency(
                    success.amount ||
                      totalAmount
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Application Status
                </span>

                <span className="text-sm font-bold text-blue-700">
                  {STATUS_LABELS.documents_received}
                </span>
              </div>

              {success.payment_id && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    Payment ID
                  </p>

                  <p className="mt-1 break-all text-xs font-semibold text-slate-700">
                    {success.payment_id}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/track?order=${encodeURIComponent(
                      success.order_number
                    )}`
                  )
                }
                className="rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white hover:bg-blue-700"
              >
                Track Application
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/services")
                }
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Back to Services
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN UI
  |--------------------------------------------------------------------------
  */

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-20 pt-28">
      <div className="mx-auto max-w-6xl">

        <button
          type="button"
          onClick={() =>
            navigate("/services")
          }
          className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to Services
        </button>

        <div className="mb-8">
          <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-blue-600">
            {applicationType ===
            "scholarship"
              ? "Scholarship Application"
              : "Government Job Application"}
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
            {opportunity.name ||
              opportunity.title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            A&A will use the information and
            documents you provide to complete the
            government application.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">

          <section className="space-y-6">

            {/* APPLICATION DETAILS */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-xl font-black text-slate-900">
                Application Details
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Start Date
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {formatDate(
                      opportunity.start_date ||
                        opportunity.application_start_date
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Last Date
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {formatDate(
                      opportunity.end_date ||
                        opportunity.application_end_date ||
                        opportunity.last_date
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Government Fee
                  </p>

                  <p className="mt-1 font-black text-slate-900">
                    {formatCurrency(
                      governmentFee
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    A&A Service Fee
                  </p>

                  <p className="mt-1 font-black text-slate-900">
                    ₹100
                  </p>
                </div>

              </div>

              {(
                opportunity.notification_pdf_url ||
                opportunity.notification_url ||
                opportunity.pdf_url
              ) && (
                <a
                  href={
                    opportunity.notification_pdf_url ||
                    opportunity.notification_url ||
                    opportunity.pdf_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50"
                >
                  <FileText size={17} />
                  Official Notification PDF
                </a>
              )}
            </div>

            {/* REQUIRED DOCUMENTS */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-xl font-black text-slate-900">
                Required Documents
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Upload the documents required for
                this notification.
              </p>

              {requiredDocuments.length ? (
                <div className="mt-5 space-y-2">
                  {requiredDocuments.map(
                    (item, index) => (
                      <div
                        key={`${getRequirementName(
                          item
                        )}-${index}`}
                        className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3"
                      >
                        <CheckCircle2
                          size={17}
                          className="mt-0.5 shrink-0 text-emerald-600"
                        />

                        <span className="text-sm font-semibold text-slate-700">
                          {getRequirementName(
                            item
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
                  Required document information
                  is not available for this
                  notification.
                </p>
              )}
            </div>

            {/* CUSTOMER DETAILS */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-xl font-black text-slate-900">
                Customer Details
              </h2>

              <div className="mt-5 grid gap-5">

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-600">
                    Full Name
                  </label>

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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-blue-500"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-600">
                    Mobile Number
                  </label>

                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateForm(
                        "phone",
                        event.target.value.replace(
                          /\D/g,
                          ""
                        ).slice(0, 10)
                      )
                    }
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-blue-500"
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-600">
                    Email
                  </label>

                  <input
                    type="email"
                    value={
                      form.customer_email
                    }
                    onChange={(event) =>
                      updateForm(
                        "customer_email",
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-blue-500"
                    placeholder="Email address"
                  />
                </div>

              </div>
            </div>

            {/* UPLOAD */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Upload Documents
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    PDF, JPG, PNG, DOC and DOCX ·
                    10 MB each
                  </p>
                </div>

                <FileText
                  size={24}
                  className="text-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="mt-5 w-full rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-blue-300 hover:bg-blue-50"
              >
                <Upload
                  size={38}
                  className="mx-auto text-blue-500"
                />

                <p className="mt-4 font-bold text-slate-900">
                  Choose documents
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Upload all required documents
                </p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(event) => {
                  addFiles(
                    event.target.files
                  );

                  event.target.value =
                    "";
                }}
              />

              {documents.length > 0 && (
                <div className="mt-5 space-y-2">
                  {documents.map(
                    (file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-700">
                            {file.name}
                          </p>

                          <p className="text-xs text-slate-400">
                            {(
                              file.size /
                              1024 /
                              1024
                            ).toFixed(2)}{" "}
                            MB
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFile(
                              index
                            )
                          }
                          className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

          </section>

          {/* PAYMENT SUMMARY */}

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">

              <p className="text-xs font-black uppercase tracking-wider text-blue-600">
                Payment Summary
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                {applicationType ===
                "scholarship"
                  ? "Scholarship Application"
                  : "Job Application"}
              </h2>

              <div className="mt-6 space-y-3">

                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">
                    Government Fee
                  </span>

                  <span className="font-bold text-slate-900">
                    {formatCurrency(
                      governmentFee
                    )}
                  </span>
                </div>

                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">
                    A&A Service Fee
                  </span>

                  <span className="font-bold text-slate-900">
                    ₹100
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex justify-between gap-4">
                    <span className="font-black text-slate-900">
                      Total
                    </span>

                    <span className="text-xl font-black text-blue-700">
                      {formatCurrency(
                        totalAmount
                      )}
                    </span>
                  </div>
                </div>

              </div>

              {error && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {paymentError && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  {paymentError}
                </div>
              )}

              <button
                type="button"
                disabled={
                  loading ||
                  paymentLoading ||
                  !documents.length
                }
                onClick={
                  submitApplication
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ||
                paymentLoading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    {paymentLoading
                      ? "Processing payment..."
                      : "Submitting..."}
                  </>
                ) : (
                  <>
                    Continue to Payment
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                A&A will complete the actual
                government application using the
                information and documents you provide.
              </p>

            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}