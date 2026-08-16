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
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

const CATEGORIES = [
  "Applications",
  "Scholarships",
  "Bookings",
  "Printing & Xerox",
  "Documents",
  "General Enquiry",
  "Other",
];

export default function Enquiry() {
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    category: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const submitEnquiry = async (event) => {
    event.preventDefault();

    setError("");
    setResult(null);

    if (!form.customer_name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[0-9]{10}$/.test(form.phone)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    if (!form.category) {
      setError("Please select a category.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!form.message.trim()) {
      setError("Please describe your enquiry.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/enquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.message || "Unable to submit enquiry."
        );
      }

      setResult(data.enquiry);

      setForm({
        customer_name: "",
        phone: "",
        email: "",
        category: "",
        subject: "",
        message: "",
      });
    } catch (err) {
      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#071426] px-4 pb-20 pt-28 text-white">

      <div className="mx-auto max-w-4xl">

        {/* HEADER */}

        <div className="mb-10">

          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55">
            <MessageCircle size={15} />
            Ask A&A
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            How can we help?
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/45">
            Send us your question or request. Our team will
            review it and get back to you.
          </p>

        </div>


        {/* SUCCESS */}

        {result && (

          <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                <CheckCircle2
                  size={22}
                  className="text-emerald-300"
                />
              </div>

              <div>

                <h2 className="text-lg font-bold text-emerald-200">
                  Enquiry submitted successfully
                </h2>

                <p className="mt-1 text-sm text-emerald-200/60">
                  Keep this enquiry number for future reference.
                </p>

                <div className="mt-4 inline-flex rounded-xl bg-black/20 px-4 py-2">
                  <span className="text-sm font-bold tracking-wide text-emerald-100">
                    {result.enquiry_number}
                  </span>
                </div>

              </div>

            </div>

          </div>

        )}


        {/* ERROR */}

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


        {/* FORM */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

          <form onSubmit={submitEnquiry} className="space-y-6">

            {/* NAME + PHONE */}

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Your name
                </label>

                <input
                  value={form.customer_name}
                  onChange={(e) =>
                    updateField(
                      "customer_name",
                      e.target.value
                    )
                  }
                  placeholder="Enter your name"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>


              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Phone number
                </label>

                <input
                  value={form.phone}
                  onChange={(e) =>
                    updateField(
                      "phone",
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10)
                    )
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
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
                  value={form.email}
                  onChange={(e) =>
                    updateField("email", e.target.value)
                  }
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
                />

              </div>


              <div>

                <label className="mb-2 block text-sm text-white/45">
                  Category
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    updateField(
                      "category",
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111d30] px-4 py-3.5 text-white outline-none transition focus:border-white/30"
                >

                  <option value="">
                    Select a category
                  </option>

                  {CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}

                </select>

              </div>

            </div>


            {/* SUBJECT */}

            <div>

              <label className="mb-2 block text-sm text-white/45">
                Subject
              </label>

              <input
                value={form.subject}
                onChange={(e) =>
                  updateField(
                    "subject",
                    e.target.value
                  )
                }
                placeholder="What do you need help with?"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09]"
              />

            </div>


            {/* MESSAGE */}

            <div>

              <label className="mb-2 block text-sm text-white/45">
                Your enquiry
              </label>

              <textarea
                value={form.message}
                onChange={(e) =>
                  updateField(
                    "message",
                    e.target.value
                  )
                }
                placeholder="Describe what you need..."
                rows={6}
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


        {/* TRACK ENQUIRY */}

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center">

          <p className="text-sm text-white/40">
            Already submitted an enquiry?
          </p>

          <p className="mt-1 text-sm text-white/25">
            Keep your enquiry number. We will use it to track
            the request.
          </p>

        </div>

      </div>

    </main>
  );
}