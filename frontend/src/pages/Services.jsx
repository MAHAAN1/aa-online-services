import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  GraduationCap,
  LoaderCircle,
  Plane,
  Printer,
  Search,
  Train,
  X,
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

const categories = [
  { value: "all", label: "All Services" },
  { value: "printing", label: "Printing" },
  { value: "xerox", label: "Xerox" },
  { value: "finishing", label: "Finishing" },
  { value: "applications", label: "Applications" },
  { value: "scholarships", label: "Scholarships" },
  { value: "booking", label: "Bookings" },
];

function formatPrice(service) {
  if (service.pricing_type === "per_unit") {
    return `₹${service.price} / ${service.unit}`;
  }

  if (service.pricing_type === "fixed") {
    return `From ₹${service.price}`;
  }

  return "Price confirmed after review";
}

function getIcon(category) {
  return serviceIcons[category] || FileText;
}

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function fetchServices() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API}/orders/services`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setServices(data.services || []);
        }
      } catch (err) {
        console.error("Services loading error:", err);

        if (!cancelled) {
          setError(
            "We couldn't load the services. Please check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchServices();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory =
        category === "all" || service.category === category;

      const matchesSearch =
        !query ||
        service.name?.toLowerCase().includes(query) ||
        service.category?.toLowerCase().includes(query) ||
        service.unit?.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [services, search, category]);

  return (
    <div className="min-h-screen overflow-x-hidden text-white">

      {/* =========================================
          NAVBAR
      ========================================= */}

      <header className="fixed inset-x-0 top-0 z-50 px-4 py-3 sm:px-6">
        <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-3 sm:px-5">

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

          <div className="hidden items-center gap-7 md:flex">
            <Link
              to="/"
              className="text-sm text-white/60 transition hover:text-white"
            >
              Home
            </Link>

            <Link
              to="/services"
              className="text-sm font-semibold text-white"
            >
              Services
            </Link>

            <Link
              to="/track"
              className="text-sm text-white/60 transition hover:text-white"
            >
              Track Order
            </Link>
          </div>

          <Link
            to="/enquiry"
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5"
          >
            Ask A&A
          </Link>

        </nav>
      </header>


      {/* =========================================
          MAIN
      ========================================= */}

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">

        {/* =========================================
            HEADER
        ========================================= */}

        <section className="relative py-10">

          <div className="pointer-events-none absolute -left-40 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />

          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-purple-500/10 blur-[130px]" />

          <div className="relative">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white/60">

              <CheckCircle2
                size={16}
                className="text-emerald-400"
              />

              A&A service center

            </div>

            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              Our Services
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
              Printing, Xerox, lamination, binding, applications,
              scholarships, bookings and other online services.
            </p>

          </div>

        </section>


        {/* =========================================
            SEARCH + FILTER
        ========================================= */}

        <section className="glass rounded-3xl p-4 sm:p-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">

            {/* SEARCH */}

            <div className="relative flex-1">

              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-10 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.09]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}

            </div>


            {/* CATEGORY */}

            <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[650px]">

              {categories.map((item) => (

                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    category === item.value
                      ? "bg-white text-slate-900"
                      : "bg-white/[0.06] text-white/55 hover:bg-white/[0.10] hover:text-white"
                  }`}
                >
                  {item.label}
                </button>

              ))}

            </div>

          </div>

        </section>


        {/* =========================================
            RESULTS INFO
        ========================================= */}

        {!loading && !error && (

          <div className="mt-8 flex items-center justify-between">

            <p className="text-sm text-white/40">
              {filteredServices.length}{" "}
              {filteredServices.length === 1
                ? "service"
                : "services"}{" "}
              available
            </p>

            {(search || category !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="text-sm font-semibold text-white/60 hover:text-white"
              >
                Clear filters
              </button>
            )}

          </div>

        )}


        {/* =========================================
            LOADING
        ========================================= */}

        {loading && (

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {[1, 2, 3, 4, 5, 6].map((item) => (

              <div
                key={item}
                className="glass h-56 animate-pulse rounded-3xl"
              />

            ))}

          </div>

        )}


        {/* =========================================
            ERROR
        ========================================= */}

        {!loading && error && (

          <div className="mt-8 glass rounded-3xl p-8">

            <div className="flex flex-col items-center text-center">

              <div className="rounded-2xl bg-red-400/10 p-4 text-red-300">
                <AlertCircle size={28} />
              </div>

              <h2 className="mt-5 text-xl font-bold">
                Services couldn't be loaded
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                {error}
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5"
              >
                Try Again
              </button>

            </div>

          </div>

        )}


        {/* =========================================
            SERVICE CARDS
        ========================================= */}

        {!loading &&
          !error &&
          filteredServices.length > 0 && (

            <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {filteredServices.map((service) => {

                const Icon = getIcon(service.category);

                return (

                  <article
                    key={service.id}
                    className="glass glass-hover group rounded-3xl p-6"
                  >

                    {/* ICON + STATUS */}

                    <div className="flex items-start justify-between">

                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.08] ring-1 ring-white/10">
                        <Icon
                          size={25}
                          className="text-white/80"
                        />
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Available
                      </span>

                    </div>


                    {/* SERVICE NAME */}

                    <h2 className="mt-7 text-xl font-bold">
                      {service.name}
                    </h2>


                    {/* DESCRIPTION */}

                    <p className="mt-2 min-h-10 text-sm leading-5 text-white/40">
                      {service.category === "printing" &&
                        "High-quality document printing for your requirements."}

                      {service.category === "xerox" &&
                        "Quick and reliable document Xerox service."}

                      {service.category === "finishing" &&
                        "Professional finishing for documents and projects."}

                      {service.category === "applications" &&
                        "Assistance with online applications and submissions."}

                      {service.category === "scholarships" &&
                        "Help with scholarship applications and documentation."}

                      {service.category === "booking" &&
                        "Online travel and ticket booking assistance."}

                      {![
                        "printing",
                        "xerox",
                        "finishing",
                        "applications",
                        "scholarships",
                        "booking",
                      ].includes(service.category) &&
                        "Professional online service assistance from A&A."}
                    </p>


                    {/* DIVIDER */}

                    <div className="my-5 h-px bg-white/10" />


                    {/* PRICE */}

                    <div className="flex items-end justify-between">

                      <div>
                        <p className="text-xs text-white/35">
                          Pricing
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {formatPrice(service)}
                        </p>
                      </div>

                      <Link
                        to="/print"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 transition group-hover:translate-x-1"
                        aria-label={`Request ${service.name}`}
                      >
                        <ArrowRight size={18} />
                      </Link>

                    </div>

                  </article>

                );

              })}

            </section>

          )}


        {/* =========================================
            NO RESULTS
        ========================================= */}

        {!loading &&
          !error &&
          filteredServices.length === 0 && (

            <div className="mt-8 glass rounded-3xl p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
                <Search
                  size={25}
                  className="text-white/35"
                />
              </div>

              <h2 className="mt-5 text-xl font-bold">
                No services found
              </h2>

              <p className="mt-2 text-sm text-white/40">
                Try another search or choose a different category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900"
              >
                Show All Services
              </button>

            </div>

          )}


        {/* =========================================
            CTA
        ========================================= */}

        <section className="mt-20">

          <div className="glass relative overflow-hidden rounded-[32px] p-8 sm:p-12">

            <div className="pointer-events-none absolute right-0 top-0 h-60 w-60 rounded-full bg-purple-500/10 blur-[100px]" />

            <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">
                  Need something else?
                </p>

                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Ask A&A directly.
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                  If you don't see the service you need, send us an
                  enquiry and we'll tell you how we can help.
                </p>

              </div>

              <Link
                to="/enquiry"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-slate-900 transition hover:-translate-y-1"
              >
                Ask A&A
                <ArrowRight size={17} />
              </Link>

            </div>

          </div>

        </section>


        {/* =========================================
            FOOTER
        ========================================= */}

        <footer className="mt-16 border-t border-white/10 py-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="font-bold">
                A&A Online Services
              </p>

              <p className="mt-1 text-xs text-white/35">
                Digital Service & Printing Center
              </p>
            </div>

            <div className="flex flex-wrap gap-5 text-sm text-white/40">

              <Link
                to="/"
                className="transition hover:text-white"
              >
                Home
              </Link>

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

          <p className="mt-6 text-xs text-white/20">
            © {new Date().getFullYear()} A&A Online Services
          </p>

        </footer>

      </main>
    </div>
  );
}