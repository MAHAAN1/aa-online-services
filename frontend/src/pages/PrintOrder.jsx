import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

const SERVICES = {
  "B&W Printing": 1,
  "Colour Printing": 5,
  "B&W Xerox": 1,
  "Colour Xerox": 5,
};

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function PrintOrder() {
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    customer_email: "",
    service_name: "B&W Printing",
    copies: 1,
    color_mode: "bw",
    sides: "single",
    lamination: false,
    spiral_binding: false,
    notes: "",
  });

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // ==========================================
  // FILE SELECTION
  // ==========================================

  const handleFiles = (selectedFiles) => {
    setError("");
    setSuccess(null);

    const incomingFiles = Array.from(selectedFiles || []);

    if (!incomingFiles.length) return;

    if (files.length + incomingFiles.length > MAX_FILES) {
      setError(
        `You can upload a maximum of ${MAX_FILES} documents.`
      );
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const allowedExtensions =
      /\.(pdf|jpg|jpeg|png|doc|docx)$/i;

    const validFiles = [];

    for (const file of incomingFiles) {
      if (
        !allowedTypes.includes(file.type) &&
        !allowedExtensions.test(file.name)
      ) {
        setError(
          `${file.name}: Please upload PDF, JPG, PNG, DOC or DOCX files.`
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(
          `${file.name}: File size must be below 20 MB.`
        );
        return;
      }

      validFiles.push(file);
    }

    setFiles((current) => [
      ...current,
      ...validFiles,
    ]);
  };

  // ==========================================
  // REMOVE FILE
  // ==========================================

  const removeFile = (index) => {
    setFiles((current) =>
      current.filter(
        (_, fileIndex) => fileIndex !== index
      )
    );

    setError("");
  };

  // ==========================================
  // PRICE
  // ==========================================

  const price = useMemo(() => {
    const basePrice =
      SERVICES[form.service_name] || 0;

    const copies =
      Math.max(1, Number(form.copies) || 1);

    let total = basePrice * copies;

    if (form.lamination) {
      total += 20;
    }

    if (form.spiral_binding) {
      total += 40;
    }

    return total;
  }, [form]);

  // ==========================================
  // SUBMIT ORDER
  // ==========================================

  const submitOrder = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess(null);

    if (!files.length) {
      setError(
        "Please upload at least one document."
      );
      return;
    }

    if (!form.customer_name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[0-9]{10}$/.test(form.phone)) {
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
      const formData = new FormData();

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
        "service_name",
        form.service_name
      );

      formData.append(
        "copies",
        String(form.copies)
      );

      formData.append(
        "color_mode",
        form.color_mode
      );

      formData.append(
        "sides",
        form.sides
      );

      formData.append(
        "lamination",
        String(form.lamination)
      );

      formData.append(
        "spiral_binding",
        String(form.spiral_binding)
      );

      formData.append(
        "notes",
        form.notes.trim()
      );

      // ==========================================
      // ADD ALL DOCUMENTS
      // ==========================================

      files.forEach((file) => {
        formData.append(
          "documents",
          file
        );
      });

      const response = await fetch(
        `${API_URL}/orders/create`,
        {
          method: "POST",
          body: formData,
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Server returned an invalid response."
        );
      }

      if (
        !response.ok ||
        data.status === "error"
      ) {
        throw new Error(
          data.message ||
            "Unable to create order."
        );
      }

      setSuccess(data.order);

      setFiles([]);

      setForm({
        customer_name: "",
        phone: "",
        customer_email: "",
        service_name: "B&W Printing",
        copies: 1,
        color_mode: "bw",
        sides: "single",
        lamination: false,
        spiral_binding: false,
        notes: "",
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (err) {
      setError(
        err.message ||
          "Unable to create order."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#071426] px-4 pb-20 pt-28 text-white">

      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-10">

          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
            A&A Online Services
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Send a print request.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/50">
            Upload your documents, choose the required
            service and submit your order directly to A&A.
          </p>

        </div>

        {/* SUCCESS */}

        {success && (
          <div className="mb-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">

            <div className="flex items-start gap-4">

              <CheckCircle className="mt-1 h-6 w-6 text-emerald-400" />

              <div>

                <h2 className="text-xl font-bold">
                  Order submitted successfully
                </h2>

                <p className="mt-2 text-white/60">
                  Your documents have been received by A&A.
                </p>

                <div className="mt-4 rounded-2xl bg-black/20 p-4">

                  <p className="text-xs uppercase tracking-wider text-white/40">
                    Order Number
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {success.order_number}
                  </p>

                  <p className="mt-2 text-sm text-white/50">
                    Status:{" "}
                    <span className="text-white">
                      {success.status || "received"}
                    </span>
                  </p>

                  <p className="text-sm text-white/50">
                    Payment:{" "}
                    <span className="text-white">
                      {success.payment_status || "pending"}
                    </span>
                  </p>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mb-8 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={submitOrder}>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">

            {/* MAIN FORM */}

            <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

              {/* UPLOAD */}

              <div>

                <h2 className="text-xl font-bold">
                  01. Upload documents
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  PDF, JPG, PNG, DOC and DOCX
                </p>

                <div
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="mt-5 cursor-pointer rounded-3xl border border-dashed border-white/20 bg-black/10 p-8 text-center transition hover:border-white/40 hover:bg-white/5"
                >

                  <Upload className="mx-auto h-10 w-10 text-white/50" />

                  {files.length === 0 ? (
                    <>
                      <p className="mt-4 font-semibold">
                        Choose your documents
                      </p>

                      <p className="mt-2 text-sm text-white/40">
                        Select up to 20 files • Maximum 20 MB each
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 font-semibold">
                        {files.length} document
                        {files.length > 1
                          ? "s"
                          : ""}{" "}
                        selected
                      </p>

                      <p className="mt-2 text-sm text-white/40">
                        Click to add more files
                        {" "}({MAX_FILES - files.length} remaining)
                      </p>
                    </>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) =>
                      handleFiles(
                        e.target.files
                      )
                    }
                  />

                </div>

                {/* SELECTED FILES */}

                {files.length > 0 && (
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">

                    {files.map(
                      (file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >

                          <div className="flex min-w-0 items-center gap-3">

                            <FileText className="h-5 w-5 shrink-0 text-white/50" />

                            <div className="min-w-0">

                              <p className="truncate text-sm font-medium">
                                {file.name}
                              </p>

                              <p className="text-xs text-white/35">
                                {(
                                  file.size /
                                  1024 /
                                  1024
                                ).toFixed(2)}{" "}
                                MB
                              </p>

                            </div>

                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="shrink-0 rounded-lg p-2 text-white/35 transition hover:bg-white/10 hover:text-white"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>

              {/* CUSTOMER DETAILS */}

              <div className="mt-10">

                <h2 className="text-xl font-bold">
                  02. Your details
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">

                  <input
                    value={form.customer_name}
                    onChange={(e) =>
                      updateForm(
                        "customer_name",
                        e.target.value
                      )
                    }
                    placeholder="Full name"
                    className="input-field"
                    required
                  />

                  <input
                    value={form.phone}
                    onChange={(e) =>
                      updateForm(
                        "phone",
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10)
                      )
                    }
                    placeholder="Phone number"
                    inputMode="numeric"
                    className="input-field"
                    required
                  />

                  <input
                    value={form.customer_email}
                    onChange={(e) =>
                      updateForm(
                        "customer_email",
                        e.target.value
                      )
                    }
                    placeholder="Email address (optional)"
                    type="email"
                    className="input-field md:col-span-2"
                  />

                </div>

              </div>

              {/* SERVICE */}

              <div className="mt-10">

                <h2 className="text-xl font-bold">
                  03. Select service
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">

                  {Object.keys(SERVICES).map(
                    (service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => {
                          updateForm(
                            "service_name",
                            service
                          );

                          updateForm(
                            "color_mode",
                            service.includes("Colour")
                              ? "color"
                              : "bw"
                          );
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          form.service_name === service
                            ? "border-white/40 bg-white text-slate-900"
                            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >

                        <p className="font-semibold">
                          {service}
                        </p>

                        <p className="mt-1 text-sm opacity-60">
                          ₹
                          {SERVICES[service]}{" "}
                          / page
                        </p>

                      </button>
                    )
                  )}

                </div>

              </div>

              {/* OPTIONS */}

              <div className="mt-10">

                <h2 className="text-xl font-bold">
                  04. Print options
                </h2>

                <div className="mt-5 grid gap-5 md:grid-cols-3">

                  <div>

                    <label className="label">
                      Copies
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={form.copies}
                      onChange={(e) =>
                        updateForm(
                          "copies",
                          Math.max(
                            1,
                            Number(
                              e.target.value
                            )
                          )
                        )
                      }
                      className="input-field"
                    />

                  </div>

                  <div>

                    <label className="label">
                      Colour
                    </label>

                    <select
                      value={form.color_mode}
                      onChange={(e) =>
                        updateForm(
                          "color_mode",
                          e.target.value
                        )
                      }
                      className="input-field"
                    >
                      <option value="bw">
                        Black & White
                      </option>

                      <option value="color">
                        Colour
                      </option>
                    </select>

                  </div>

                  <div>

                    <label className="label">
                      Sides
                    </label>

                    <select
                      value={form.sides}
                      onChange={(e) =>
                        updateForm(
                          "sides",
                          e.target.value
                        )
                      }
                      className="input-field"
                    >
                      <option value="single">
                        Single Side
                      </option>

                      <option value="double">
                        Double Side
                      </option>
                    </select>

                  </div>

                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">

                  <label className="option-card">

                    <input
                      type="checkbox"
                      checked={
                        form.lamination
                      }
                      onChange={(e) =>
                        updateForm(
                          "lamination",
                          e.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>
                        Lamination
                      </strong>

                      <small>
                        ₹20 per sheet
                      </small>
                    </span>

                  </label>

                  <label className="option-card">

                    <input
                      type="checkbox"
                      checked={
                        form.spiral_binding
                      }
                      onChange={(e) =>
                        updateForm(
                          "spiral_binding",
                          e.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>
                        Spiral Binding
                      </strong>

                      <small>
                        ₹40 per job
                      </small>
                    </span>

                  </label>

                </div>

              </div>

              {/* NOTES */}

              <div className="mt-10">

                <h2 className="text-xl font-bold">
                  05. Additional notes
                </h2>

                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    updateForm(
                      "notes",
                      e.target.value
                    )
                  }
                  placeholder="Any special instructions?"
                  rows={4}
                  className="input-field mt-5 resize-none"
                />

              </div>

            </section>

            {/* SUMMARY */}

            <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl lg:sticky lg:top-28">

              <div className="flex items-center gap-3">

                <FileText className="h-5 w-5 text-white/60" />

                <h2 className="text-xl font-bold">
                  Order summary
                </h2>

              </div>

              <div className="mt-6 space-y-4 text-sm">

                <div className="flex justify-between gap-4">

                  <span className="text-white/40">
                    Documents
                  </span>

                  <span className="text-right font-medium">
                    {files.length}
                  </span>

                </div>

                <div className="flex justify-between gap-4">

                  <span className="text-white/40">
                    Service
                  </span>

                  <span className="text-right font-medium">
                    {form.service_name}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-white/40">
                    Copies
                  </span>

                  <span>
                    {form.copies}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-white/40">
                    Colour
                  </span>

                  <span>
                    {form.color_mode ===
                    "bw"
                      ? "B&W"
                      : "Colour"}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-white/40">
                    Sides
                  </span>

                  <span>
                    {form.sides ===
                    "single"
                      ? "Single"
                      : "Double"}
                  </span>

                </div>

                <div className="border-t border-white/10 pt-4">

                  <div className="flex justify-between">

                    <span className="text-white/40">
                      Printing
                    </span>

                    <span>
                      ₹
                      {(
                        SERVICES[
                          form.service_name
                        ] *
                        Number(
                          form.copies || 1
                        )
                      ).toFixed(2)}
                    </span>

                  </div>

                  {form.lamination && (
                    <div className="mt-2 flex justify-between">

                      <span className="text-white/40">
                        Lamination
                      </span>

                      <span>
                        ₹20.00
                      </span>

                    </div>
                  )}

                  {form.spiral_binding && (
                    <div className="mt-2 flex justify-between">

                      <span className="text-white/40">
                        Binding
                      </span>

                      <span>
                        ₹40.00
                      </span>

                    </div>
                  )}

                </div>

                <div className="border-t border-white/10 pt-5">

                  <div className="flex items-end justify-between">

                    <span className="text-white/40">
                      Estimated total
                    </span>

                    <span className="text-3xl font-bold">
                      ₹{price.toFixed(2)}
                    </span>

                  </div>

                  <p className="mt-2 text-xs text-white/30">
                    Final amount may be confirmed by A&A
                    before processing.
                  </p>

                </div>

              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  files.length === 0
                }
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    Submit Order
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}

              </button>

              <p className="mt-4 text-center text-xs leading-5 text-white/30">
                Your documents are stored temporarily
                for processing.
              </p>

            </aside>

          </div>

        </form>

      </div>

      {/* LOCAL STYLES */}

      <style>{`
        .input-field {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          padding: 13px 15px;
          color: white;
          outline: none;
          transition: 0.2s;
        }

        .input-field::placeholder {
          color: rgba(255,255,255,0.35);
        }

        .input-field:focus {
          border-color: rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.08);
        }

        .input-field option {
          background: #111827;
          color: white;
        }

        .label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.45);
        }

        .option-card {
          display: flex;
          align-items: center;
          gap: 13px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 15px;
          background: rgba(255,255,255,0.04);
        }

        .option-card input {
          width: 18px;
          height: 18px;
          accent-color: white;
        }

        .option-card span {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .option-card small {
          color: rgba(255,255,255,0.4);
        }
      `}</style>

    </main>
  );
}