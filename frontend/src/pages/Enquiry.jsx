import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  Send,
  XCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

const CATEGORIES = [
  "Applications",
  "Scholarships",
  "Bookings",
  "Printing & Xerox",
  "Documents",
  "General Enquiry",
  "Other",
];

const INITIAL_FORM = {
  customer_name: "",
  phone: "",
  email: "",
  category: "",
  subject: "",
  message: "",
};

export default function Enquiry() {
  const [form, setForm] =
    useState(INITIAL_FORM);

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState("");

  const updateField = (
    field,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const submitEnquiry = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setResult(null);

    const name =
      form.customer_name.trim();

    const cleanPhone =
      form.phone.trim();

    const email =
      form.email.trim();

    const subject =
      form.subject.trim();

    const message =
      form.message.trim();

    if (!name) {
      setError(
        "Please enter your name."
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

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    if (!form.category) {
      setError(
        "Please select a category."
      );
      return;
    }

    if (!subject) {
      setError(
        "Please enter a subject."
      );
      return;
    }

    if (!message) {
      setError(
        "Please describe your enquiry."
      );
      return;
    }

    if (subject.length > 150) {
      setError(
        "Subject must be 150 characters or less."
      );
      return;
    }

    if (message.length > 3000) {
      setError(
        "Enquiry must be 3000 characters or less."
      );
      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          `${API_URL}/enquiries`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              customer_name: name,
              phone: cleanPhone,
              email,
              category:
                form.category,
              subject,
              message,
            }),
          }
        );

      let data;

      try {
        data =
          await response.json();
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
            "Unable to submit enquiry."
        );
      }

      if (!data?.enquiry) {
        throw new Error(
          "Enquiry was submitted but no enquiry details were returned."
        );
      }

      setResult(
        data.enquiry
      );

      setForm({
        ...INITIAL_FORM,
      });
    } catch (err) {
      console.error(
        "Enquiry submission error:",
        err
      );

      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071426] px-4 pb-20 pt-24 text-white">

      <div className="mx-auto max-w-4xl">

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

          <div className="mb-5 flex items-center gap-3">

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

            <MessageCircle
              size={15}
            />

            Ask A&A

          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            How can we help?
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/45">
            Send us your question or request.
            Our team will review it and get
            back to you.
          </p>

        </div>

        {/* =====================================================
            SUCCESS
        ===================================================== */}

        {result && (
          <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">

                <CheckCircle2
                  size={22}
                  className="text-emerald-300"
                />

              </div>

              <div className="min-w-0">

                <h2 className="text-lg font-bold text-emerald-200">
                  Enquiry submitted successfully
                </h2>

                <p className="mt-1 text-sm text-emerald-200/60">
                  Keep this enquiry number for
                  future reference.
                </p>

                {result.enquiry_number && (
                  <div className="mt-4 inline-flex rounded-xl bg-black/20 px-4 py-2">

                    <span className="break-all text-sm font-bold tracking-wide text-emerald-100">
                      {result.enquiry_number}
                    </span>

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-200">

            <XCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>

              <p className="font-semibold">
                Unable to submit enquiry
              </p>

              <p className="mt-1 text-red-200/65">
                {error}
              </p>

            </div>

          </div>
        )}

        {/* =====================================================
            FORM
        ===================================================== */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

          <form
            onSubmit={submitEnquiry}
            className="space-y-6"
          >

            {/* NAME + PHONE */}

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Your name
                </label>

                <input
                  value={
                    form.customer_name
                  }
                  onChange={(event) =>
                    updateField(
                      "customer_name",
                      event.target.value
                    )
                  }
                  placeholder="Enter your name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Phone number
                </label>

                <input
                  value={
                    form.phone
                  }
                  onChange={(event) =>
                    updateField(
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
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>

            </div>

            {/* EMAIL + CATEGORY */}

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Email
                  <span className="ml-1 text-white/20">
                    optional
                  </span>
                </label>

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(event) =>
                    updateField(
                      "email",
                      event.target.value
                    )
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={150}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Category
                </label>

                <select
                  value={
                    form.category
                  }
                  onChange={(event) =>
                    updateField(
                      "category",
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#111d30] px-4 py-3.5 text-white outline-none transition focus:border-white/30"
                >

                  <option value="">
                    Select a category
                  </option>

                  {CATEGORIES.map(
                    (category) => (
                      <option
                        key={category}
                        value={
                          category
                        }
                      >
                        {category}
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>

            {/* SUBJECT */}

            <div>

              <div className="mb-2 flex items-center justify-between">

                <label className="block text-sm text-white/45">
                  Subject
                </label>

                <span className="text-xs text-white/20">
                  {form.subject.length}/150
                </span>

              </div>

              <input
                value={
                  form.subject
                }
                onChange={(event) =>
                  updateField(
                    "subject",
                    event.target.value
                  )
                }
                placeholder="What do you need help with?"
                maxLength={150}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
              />

            </div>

            {/* MESSAGE */}

            <div>

              <div className="mb-2 flex items-center justify-between">

                <label className="block text-sm text-white/45">
                  Your enquiry
                </label>

                <span className="text-xs text-white/20">
                  {form.message.length}/3000
                </span>

              </div>

              <textarea
                value={
                  form.message
                }
                onChange={(event) =>
                  updateField(
                    "message",
                    event.target.value
                  )
                }
                placeholder="Describe what you need..."
                rows={6}
                maxLength={3000}
                required
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
              />

            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {loading ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />

                  Sending enquiry...
                </>
              ) : (
                <>
                  <Send size={18} />

                  Send Enquiry
                </>
              )}

            </button>

          </form>

        </section>

        {/* =====================================================
            TRACK ENQUIRY
        ===================================================== */}

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center">

          <p className="text-sm text-white/40">
            Already submitted an enquiry?
          </p>

          <p className="mt-1 text-sm text-white/25">
            Keep your enquiry number. It can be
            used by A&A to identify your request.
          </p>

        </div>

      </div>
    </main>
  );
}