import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Printer,
  FileText,
  GraduationCap,
  Train,
  Plane,
  Upload,
  MessageCircle,
  Search,
  ArrowRight,
  ShieldCheck,
  Clock,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const serviceIcons = {
  printing: Printer,
  xerox: FileText,
  finishing: FileText,
  applications: FileText,
  scholarships: GraduationCap,
  booking: Train,
  travel: Plane,
};

const formatPrice = (service) => {
  if (service.pricing_type === "per_unit") {
    return `₹${service.price} / ${service.unit}`;
  }

  if (service.pricing_type === "fixed") {
    return `From ₹${service.price}`;
  }

  return "Price confirmed after review";
};

export default function Home() {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadServices = async () => {
      try {
        setLoadingServices(true);
        setServiceError("");

        const response = await fetch(`${API}/orders/services`);

        if (!response.ok) {
          throw new Error("Failed to fetch services");
        }

        const data = await response.json();

        if (!cancelled) {
          setServices(data.services || []);
        }
      } catch (error) {
        console.error("Services API error:", error);

        if (!cancelled) {
          setServiceError(
            "Services are temporarily unavailable. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingServices(false);
        }
      }
    };

    loadServices();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden text-white">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="fixed inset-x-0 top-0 z-50 px-4 py-3 sm:px-6">
        <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-3 sm:px-5">

          {/* BRAND */}

          <Link
            to="/"
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-black ring-1 ring-white/10">
              A&A
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold sm:text-base">
                A&A Online Services
              </h1>

              <p className="hidden text-xs text-white/45 sm:block">
                Digital Service & Printing Center
              </p>
            </div>
          </Link>

          {/* NAVIGATION */}

          <div className="hidden items-center gap-7 md:flex">
            <Link
              to="/"
              className="text-sm text-white/75 transition hover:text-white"
            >
              Home
            </Link>

            <Link
              to="/services"
              className="text-sm text-white/75 transition hover:text-white"
            >
              Services
            </Link>

            <Link
              to="/track"
              className="text-sm text-white/75 transition hover:text-white"
            >
              Track Order
            </Link>
          </div>

          <Link
            to="/enquiry"
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5"
          >
            <span className="hidden sm:inline">Ask A&A</span>
            <MessageCircle
              size={18}
              className="sm:hidden"
            />
          </Link>
        </nav>
      </header>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">


        {/* =====================================================
            HERO
        ===================================================== */}

        <section className="relative grid min-h-[calc(100vh-6rem)] items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-20">

          {/* Decorative glow */}

          <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />

          <div className="pointer-events-none absolute right-0 top-20 h-96 w-96 rounded-full bg-purple-500/10 blur-[140px]" />


          {/* HERO CONTENT */}

          <div className="relative">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
              Your digital service counter
            </div>


            <h2 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Your documents.
              <br />

              <span className="gradient-text">
                Our service.
              </span>
            </h2>


            <p className="mt-7 max-w-2xl text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
              Send documents for printing, Xerox, lamination and
              binding. Enquire about applications, scholarships,
              bookings and other online services — all from one place.
            </p>


            {/* ACTIONS */}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">

              <Link
                to="/print"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-slate-900 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:shadow-2xl"
              >
                <Upload size={20} />
                Send Documents
                <ArrowRight size={17} />
              </Link>


              <Link
                to="/enquiry"
                className="glass-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-semibold"
              >
                <MessageCircle size={20} />
                Ask A&A
              </Link>

            </div>


            {/* TRUST */}

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/45">

              <span className="flex items-center gap-2">
                <ShieldCheck size={17} />
                Private documents
              </span>

              <span className="flex items-center gap-2">
                <Clock size={17} />
                Temporary storage
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} />
                Simple tracking
              </span>

            </div>

          </div>


          {/* =====================================================
              QUICK PRINT CARD
          ===================================================== */}

          <div className="relative">

            <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-blue-500/10 blur-[90px]" />

            <div className="glass relative rounded-[32px] p-4 sm:p-6">

              <div className="flex items-center justify-between px-1 pb-5">

                <div>
                  <p className="text-sm text-white/45">
                    Quick service
                  </p>

                  <h3 className="mt-1 text-xl font-bold sm:text-2xl">
                    Send a print request
                  </h3>
                </div>

                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <Printer size={22} />
                </div>

              </div>


              <Link
                to="/print"
                className="group block rounded-[26px] border border-dashed border-white/15 bg-white/[0.025] p-8 text-center transition hover:border-white/25 hover:bg-white/[0.06] sm:p-12"
              >

                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 transition group-hover:scale-105">
                  <Upload size={32} className="text-white/75" />
                </div>

                <p className="text-lg font-bold">
                  Upload your documents
                </p>

                <p className="mt-2 text-sm text-white/40">
                  PDF, JPG, PNG, DOC and DOCX
                </p>

                <div className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition group-hover:-translate-y-0.5">
                  Continue
                  <ArrowRight size={17} />
                </div>

              </Link>


              {/* SERVICE TYPES */}

              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">

                {["Print", "Lamination", "Binding"].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl bg-white/[0.06] px-2 py-3 text-center text-xs text-white/45 ring-1 ring-white/5"
                  >
                    {item}
                  </div>
                ))}

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            SERVICES
        ===================================================== */}

        <section className="py-20">

          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                Services
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need, one counter.
              </h2>

              <p className="mt-3 max-w-2xl text-white/45">
                Choose a service and send your request directly to A&A.
              </p>
            </div>

            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-white"
            >
              View all
              <ChevronRight size={17} />
            </Link>

          </div>


          {/* LOADING */}

          {loadingServices && (

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="glass h-48 animate-pulse rounded-3xl"
                />
              ))}

            </div>

          )}


          {/* ERROR */}

          {!loadingServices && serviceError && (

            <div className="glass rounded-3xl border-red-400/10 p-8">

              <div className="flex items-start gap-4">

                <div className="rounded-xl bg-red-400/10 p-3 text-red-300">
                  <AlertCircle size={22} />
                </div>

                <div>
                  <h3 className="font-semibold">
                    Services couldn't be loaded
                  </h3>

                  <p className="mt-1 text-sm text-white/45">
                    {serviceError}
                  </p>

                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900"
                  >
                    Try again
                  </button>
                </div>

              </div>

            </div>

          )}


          {/* SERVICES */}

          {!loadingServices &&
            !serviceError &&
            services.length > 0 && (

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

                {services.map((service) => {

                  const Icon =
                    serviceIcons[service.category] || FileText;

                  return (

                    <Link
                      key={service.id}
                      to="/print"
                      className="glass glass-hover group rounded-3xl p-6"
                    >

                      <div className="flex items-start justify-between">

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/5">
                          <Icon size={22} />
                        </div>

                        <ArrowRight
                          size={18}
                          className="text-white/25 transition group-hover:translate-x-1 group-hover:text-white/70"
                        />

                      </div>


                      <h3 className="mt-6 text-lg font-bold">
                        {service.name}
                      </h3>


                      <p className="mt-2 text-sm text-white/45">
                        {formatPrice(service)}
                      </p>


                      <div className="mt-5 h-px bg-white/10" />


                      <p className="mt-4 text-sm font-semibold text-white/65">
                        Get started
                      </p>

                    </Link>

                  );
                })}

              </div>

            )}


          {/* EMPTY */}

          {!loadingServices &&
            !serviceError &&
            services.length === 0 && (

              <div className="glass rounded-3xl p-10 text-center">

                <FileText
                  className="mx-auto mb-4 text-white/30"
                  size={34}
                />

                <p className="text-white/50">
                  No services are currently available.
                </p>

              </div>

            )}

        </section>


        {/* =====================================================
            HOW IT WORKS
        ===================================================== */}

        <section className="py-16">

          <div className="mb-10 text-center">

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
              Simple process
            </p>

            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              Send it. We handle it.
            </h2>

          </div>


          <div className="grid gap-5 md:grid-cols-3">

            {[
              {
                number: "01",
                title: "Send your request",
                text: "Upload your documents and select what you need."
              },
              {
                number: "02",
                title: "A&A processes it",
                text: "We check your request, confirm the price and process your documents."
              },
              {
                number: "03",
                title: "Collect your order",
                text: "Track your order online and collect it from A&A when it's ready."
              }
            ].map((step) => (

              <div
                key={step.number}
                className="glass glass-hover rounded-3xl p-7"
              >

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 font-bold text-white/70">
                  {step.number}
                </div>

                <h3 className="mt-6 text-xl font-bold">
                  {step.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-white/45">
                  {step.text}
                </p>

              </div>

            ))}

          </div>

        </section>


        {/* =====================================================
            TRACK ORDER
        ===================================================== */}

        <section className="py-16">

          <div className="glass relative overflow-hidden rounded-[32px] p-8 text-center sm:p-14">

            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-blue-500/10 blur-[80px]" />

            <div className="relative">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Search size={25} />
              </div>

              <h2 className="mt-6 text-3xl font-bold sm:text-4xl">
                Already submitted something?
              </h2>

              <p className="mx-auto mt-3 max-w-lg text-white/45">
                Track your A&A request using your order number.
              </p>

              <Link
                to="/track"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-slate-900 transition hover:-translate-y-1"
              >
                Track Order
                <ArrowRight size={17} />
              </Link>

            </div>

          </div>

        </section>


        {/* =====================================================
            FOOTER
        ===================================================== */}

        <footer className="border-t border-white/10 py-10">

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="font-bold">
                A&A Online Services
              </p>

              <p className="mt-1 text-sm text-white/40">
                Digital Service & Printing Center
              </p>

            </div>


            <div className="flex flex-wrap gap-5 text-sm text-white/45">

              <Link
                to="/services"
                className="transition hover:text-white"
              >
                Services
              </Link>

              <Link
                to="/track"
                className="transition hover:text-white"
              >
                Track Order
              </Link>

              <Link
                to="/enquiry"
                className="transition hover:text-white"
              >
                Ask A&A
              </Link>

            </div>

          </div>

          <p className="mt-8 text-xs text-white/25">
            © {new Date().getFullYear()} A&A Online Services. All rights reserved.
          </p>

        </footer>

      </main>
    </div>
  );
}