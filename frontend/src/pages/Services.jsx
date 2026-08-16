import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  LoaderCircle,
  Plane,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Train,
  X,
} from "lucide-react";

const API =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

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
  {
    value: "all",
    label: "All Services",
  },
  {
    value: "printing",
    label: "Printing",
  },
  {
    value: "xerox",
    label: "Xerox",
  },
  {
    value: "finishing",
    label: "Finishing",
  },
  {
    value: "applications",
    label: "Applications",
  },
  {
    value: "scholarships",
    label: "Scholarships",
  },
];

const governmentServices = [
  {
    id: "online-applications",
    title: "All Online Applications & Scholarships",
    description:
      "A&A assists with all types of online government applications and scholarship applications.",
    organization: "A&A Online Services",
    price: "₹100 service charge",
    url: "#applications",
    icon: FileCheck2,
  },
  {
    id: "travel-bookings",
    title: "Bus / Train / Flight Bookings",
    description:
      "Bus, train and flight ticket booking assistance is available.",
    organization: "A&A Booking Services",
    price: "Ticket fare + applicable booking charges",
    url: "https://www.irctc.co.in/",
    icon: Train,
  },
  {
    id: "ttd-darshanam",
    title: "TTD Darshanam Tickets",
    description:
      "TTD Darshanam ticket booking assistance is available.",
    organization: "A&A Booking Services",
    price: "Official ticket price + applicable service charges",
    url: "https://ttdevasthanams.ap.gov.in/",
    icon: GraduationCap,
  },
  {
    id: "aadhaar-print",
    title: "Aadhaar Printing",
    description:
      "Black & white print, colour print and lamination.",
    organization: "UIDAI",
    price: "B&W ₹10 · Colour ₹30 · Lamination ₹60",
    url: "https://myaadhaar.uidai.gov.in/",
    icon: ShieldCheck,
  },
  {
    id: "pan-apply",
    title: "PAN Card",
    description:
      "PAN card application assistance.",
    organization: "Income Tax Department",
    price: "₹300 total",
    url: "https://www.incometax.gov.in/iec/foportal/",
    icon: FileText,
  },
  {
    id: "passport",
    title: "Passport Assistance",
    description:
      "Passport application assistance.",
    organization: "Passport Seva",
    price: "Official passport fee + ₹300",
    url: "https://www.passportindia.gov.in/",
    icon: Plane,
  },
  {
    id: "ration",
    title: "Telangana Ration Card",
    description:
      "Ration card application and document assistance.",
    organization: "Telangana Civil Supplies",
    price: "₹10 service charge",
    url: "https://epds.telangana.gov.in/",
    icon: FileCheck2,
  },
];

function formatPrice(
  service
) {
  if (
    service?.category ===
    "printing"
  ) {
    return "B&W ₹2 single / ₹3 double · Colour ₹5 single / ₹8 double";
  }

  if (
    service?.category ===
    "xerox"
  ) {
    return "B&W ₹5 first + ₹3 next · Colour ₹10 first + ₹6 next";
  }

  if (
    service?.pricing_type ===
    "per_unit"
  ) {
    return `₹${service.price} / ${service.unit}`;
  }

  if (
    service?.pricing_type ===
    "fixed"
  ) {
    return `From ₹${service.price}`;
  }

  return "Price confirmed after review";
}

function getIcon(
  category
) {
  return (
    serviceIcons[
      category
    ] ||
    FileText
  );
}

function getDescription(
  category
) {
  const descriptions = {
    printing:
      "High-quality document printing with single-side and double-side options.",

    xerox:
      "Quick and reliable B&W and colour Xerox service.",

    finishing:
      "Professional finishing for documents, projects and assignments.",

    applications:
      "Assistance with online applications, forms and submissions.",

    scholarships:
      "Help with scholarship applications and required documentation.",

    booking:
      "Online travel and ticket booking assistance.",

    travel:
      "Convenient online travel service assistance.",
  };

  return (
    descriptions[
      category
    ] ||
    "Professional online service assistance from A&A."
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Not published";
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function daysRemaining(
  value
) {
  if (!value) {
    return null;
  }

  const end =
    new Date(
      `${value}T23:59:59`
    );

  return Math.ceil(
    (end.getTime() -
      Date.now()) /
      86400000
  );
}

function getOpportunityStatus(
  item
) {
  if (
    item.status ===
    "closed"
  ) {
    return "Closed";
  }

  if (
    item.status ===
    "open"
  ) {
    const days =
      daysRemaining(
        item.application_end
      );

    if (
      days !== null &&
      days >= 0 &&
      days <= 7
    ) {
      return `Closing in ${days} day${
        days === 1
          ? ""
          : "s"
      }`;
    }

    return "Applications Open";
  }

  return "Check Official Notice";
}

function OpportunityCard({
  item,
  expanded,
  onToggle,
}) {
  const days = daysRemaining(item.application_end);

  const customer = item.customer_requirements || {};

  const documents = Array.isArray(customer.documents)
    ? customer.documents
    : Array.isArray(item.required_documents)
    ? item.required_documents
    : [];

  const displayDocuments = [
    ...new Set(documents.map(cleanDocumentName).filter(Boolean)),
  ];

  const age =
    customer.age ||
    getCleanAge(item.age_requirements);

  const governmentFee = getGovernmentFee(
    customer.government_fee,
    item.government_fee,
    item.fee_details
  );

  return (
    <article className="glass rounded-3xl p-6">
      <div className="flex flex-col gap-5">

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/50">
                {item.region || "India"}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === "open"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : item.status === "closed"
                    ? "bg-red-400/10 text-red-300"
                    : "bg-blue-400/10 text-blue-300"
                }`}
              >
                {getOpportunityStatus(item)}
              </span>
            </div>

            <h4 className="text-xl font-bold leading-8">
              {item.title}
            </h4>

            <p className="mt-2 text-sm text-white/40">
              {item.organization}
            </p>
          </div>

          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] sm:flex">
            {item.type === "scholarship" ? (
              <GraduationCap size={22} className="text-white/70" />
            ) : (
              <BriefcaseBusiness size={22} className="text-white/70" />
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <p className="text-xs text-white/30">Application Start</p>
            <p className="mt-1 font-semibold">
              {item.application_start
                ? formatDate(item.application_start)
                : "Not published"}
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4">
            <p className="text-xs text-white/30">Application End</p>
            <p className="mt-1 font-semibold">
              {item.application_end
                ? formatDate(item.application_end)
                : "Not published"}
            </p>
          </div>
        </div>

        {days !== null && days >= 0 && (
          <div
            className={`rounded-2xl p-4 text-sm ${
              days <= 7
                ? "bg-red-400/10 text-red-200"
                : "bg-emerald-400/10 text-emerald-200"
            }`}
          >
            {days === 0
              ? "Last day to apply."
              : `${days} day${days === 1 ? "" : "s"} remaining.`}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">
            Required Details
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-xs text-white/30">Documents</p>
              <p className="mt-1 font-semibold">
                {displayDocuments.length
                  ? `${displayDocuments.length} required`
                  : "See official notice"}
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-xs text-white/30">Age Requirement</p>
              <p className="mt-1 font-semibold">{age}</p>
            </div>

            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-xs text-white/30">Government Fee</p>
              <p className="mt-1 font-semibold">
                {typeof governmentFee === "number"
                  ? `₹${governmentFee}`
                  : "As per notice"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
            A&A Service Charge
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
            <span className="text-sm text-white/50">
              Online application / scholarship assistance
            </span>
            <span className="font-bold">₹100</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={
              item.official_apply_url ||
              item.official_notification_url ||
              item.source_url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]"
          >
            Official Website
            <ExternalLink size={15} />
          </a>

          <a
            href={
              item.notification_pdf_url ||
              item.official_notification_url ||
              item.source_url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Notification PDF
            <ExternalLink size={15} />
          </a>

          <button
            type="button"
            onClick={onToggle}
            className="rounded-xl bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/70"
          >
            {expanded ? "Hide Requirements" : "View Requirements"}
          </button>
        </div>

        {expanded && (
          <div className="space-y-4">

            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
                Required Documents
              </p>

              {displayDocuments.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {displayDocuments.map((document, index) => (
                    <div
                      key={`${item.id}-document-${index}`}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-sm text-emerald-300">
                        ✓
                      </span>
                      <span className="text-sm font-medium text-white/75">
                        {document}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/40">
                  Required documents will be shown when published by A&A.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
                Age Requirement
              </p>
              <p className="mt-3 text-lg font-bold">{age}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
                Application Fee
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
                  <span className="text-sm text-white/50">
                    Government Application Fee
                  </span>
                  <span className="font-semibold">
                    {typeof governmentFee === "number"
                      ? `₹${governmentFee}`
                      : "As per official notice"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
                  <span className="text-sm text-white/50">
                    A&A Online Services
                  </span>
                  <span className="font-semibold">₹100</span>
                </div>
              </div>
            </div>

          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/25">
          <span>{item.source || "A&A notification"}</span>
          <span>{item.admin_posted ? "Posted by A&A" : "Official source"}</span>
        </div>
      </div>
    </article>
  );
}

function cleanDocumentName(document) {
  let value = String(document || "").trim();

  const replacements = [
    [/\bmatriculation\b/gi, "SSC Memo"],
    [/\bsecondary school certificate\b/gi, "SSC Memo"],
    [/\b10th\s+(class|standard)\b/gi, "SSC Memo"],
    [/\bintermediate certificate\b/gi, "Intermediate Memo"],
    [/\b12th\s+(class|standard)\b/gi, "Intermediate Memo"],
    [/\baadhar\b/gi, "Aadhaar Card"],
    [/\baadhaar\b/gi, "Aadhaar Card"],
    [/\bincome certificate\b/gi, "Income Certificate"],
    [/\bcaste certificate\b/gi, "Caste Certificate"],
    [/\bcommunity certificate\b/gi, "Community / Caste Certificate"],
    [/\bdomicile certificate\b/gi, "Domicile Certificate"],
    [/\bresidence certificate\b/gi, "Residence Certificate"],
    [/\bstudy certificate\b/gi, "Study Certificate"],
    [/\bbonafide certificate\b/gi, "Bonafide Certificate"],
    [/\bexperience certificate\b/gi, "Experience Certificate"],
    [/\bdegree certificate\b/gi, "Degree Certificate"],
    [/\bdiploma certificate\b/gi, "Diploma Certificate"],
    [/\bdisability certificate\b/gi, "Disability Certificate"],
    [/\bmedical certificate\b/gi, "Medical Certificate"],
    [/\bpan card\b/gi, "PAN Card"],
    [/\btransfer certificate\b/gi, "Transfer Certificate"],
    [/\bno objection certificate\b/gi, "NOC"],
    [/\bpassport\s*size\s*(?:photograph|photo)\b/gi, "Passport Size Photograph"],
    [/\bsignature\b/gi, "Signature"],
  ];

  for (const [pattern, replacement] of replacements) {
    value = value.replace(pattern, replacement);
  }

  return value.replace(/\s+/g, " ").trim();
}

function getCleanAge(ageRequirements) {
  if (!Array.isArray(ageRequirements) || ageRequirements.length === 0) {
    return "See official notice";
  }

  const combined = ageRequirements.join(" ");

  const range = combined.match(
    /(\d{1,2})\s*(?:years?|yrs?)\s*(?:to|-|–)\s*(\d{1,2})\s*(?:years?|yrs?)/i
  );

  if (range) {
    return `${range[1]} years to ${range[2]} years`;
  }

  const minimum = combined.match(
    /minimum\s+(?:age\s+of\s+)?(\d{1,2})\s*(?:years?|yrs?)/i
  );

  const maximum = combined.match(
    /maximum\s+(?:age\s+of\s+)?(\d{1,2})\s*(?:years?|yrs?)/i
  );

  if (minimum && maximum) {
    return `${minimum[1]} years to ${maximum[1]} years`;
  }

  if (minimum) {
    return `Minimum ${minimum[1]} years`;
  }

  if (maximum) {
    return `Maximum ${maximum[1]} years`;
  }

  return "See official notice";
}

function getGovernmentFee(customerFee, legacyFee, feeDetails) {
  if (
    typeof customerFee === "number" &&
    Number.isFinite(customerFee)
  ) {
    return customerFee;
  }

  if (
    typeof legacyFee === "number" &&
    Number.isFinite(legacyFee) &&
    legacyFee >= 0
  ) {
    return legacyFee;
  }

  if (Array.isArray(feeDetails)) {
    const matches = [
      ...new Set(
        feeDetails
          .join(" ")
          .matchAll(
            /(?:₹|rs\.?|rupees)\s*([0-9,]+(?:\.[0-9]+)?)/gi
          )
      ),
    ];

    if (matches.length === 1) {
      const numeric = Number(
        matches[0][1].replace(/,/g, "")
      );

      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
  }

  return null;
}

export default function Services() {
  const [
    services,
    setServices,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("all");

  const [
    opportunities,
    setOpportunities,
  ] = useState({
    jobs: [],
    scholarships: [],
  });

  const [
    opportunitiesLoading,
    setOpportunitiesLoading,
  ] = useState(
    true
  );

  const [
    opportunitiesError,
    setOpportunitiesError,
  ] = useState("");

  const [
    updatedAt,
    setUpdatedAt,
  ] = useState("");

  const [
    openId,
    setOpenId,
  ] = useState(null);

  const fetchServices =
    async () => {
      try {
        setLoading(
          true
        );

        setError("");

        const response =
          await fetch(
            `${API}/orders/services`
          );

        let data;

        try {
          data =
            await response.json();
        } catch {
          throw new Error(
            "The server returned an invalid response."
          );
        }

        if (
          !response.ok ||
          data?.status ===
            "error"
        ) {
          throw new Error(
            data?.message ||
              `API returned ${response.status}`
          );
        }

        setServices(
          Array.isArray(
            data?.services
          )
            ? data.services
            : []
        );
      } catch (err) {
        console.error(
          "Services loading error:",
          err
        );

        setError(
          err.message ||
            "We couldn't load the services."
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const fetchOpportunities =
    async () => {
      try {
        setOpportunitiesLoading(
          true
        );

        setOpportunitiesError(
          ""
        );

        const response =
          await fetch(
            `${API}/opportunities`
          );

        let data;

        try {
          data =
            await response.json();
        } catch {
          throw new Error(
            "Government data server returned an invalid response."
          );
        }

        if (
          !response.ok ||
          data?.status ===
            "error"
        ) {
          throw new Error(
            data?.message ||
              `API returned ${response.status}`
          );
        }

        setOpportunities({
          jobs:
            Array.isArray(
              data?.jobs
            )
              ? data.jobs
              : [],

          scholarships:
            Array.isArray(
              data?.scholarships
            )
              ? data.scholarships
              : [],
        });

        setUpdatedAt(
          data?.updated_at ||
            new Date().toISOString()
        );

        if (
          Array.isArray(
            data?.warnings
          ) &&
          data.warnings.length
        ) {
          setOpportunitiesError(
            data.warnings.join(
              " "
            )
          );
        }
      } catch (err) {
        console.error(
          "Government opportunities error:",
          err
        );

        setOpportunitiesError(
          err.message ||
            "Government data could not be refreshed."
        );
      } finally {
        setOpportunitiesLoading(
          false
        );
      }
    };

  useEffect(() => {
    let cancelled =
      false;

    const load =
      async () => {
        if (
          cancelled
        ) {
          return;
        }

        await fetchServices();
      };

    load();

    return () => {
      cancelled =
        true;
    };
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const filteredServices =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return services.filter(
        (service) => {
          const matchesCategory =
            category ===
              "all" ||
            service.category ===
              category;

          const searchableText =
            [
              service.name,
              service.category,
              service.unit,
              service.description,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !query ||
            searchableText.includes(
              query
            );

          return (
            matchesCategory &&
            matchesSearch
          );
        }
      );
    }, [
      services,
      search,
      category,
    ]);

  const clearFilters =
    () => {
      setSearch("");
      setCategory(
        "all"
      );
    };

  const telanganaJobs =
    opportunities.jobs.filter(
      (job) =>
        job.region ===
        "Telangana"
    );

  const sscJobs =
    opportunities.jobs.filter(
      (job) =>
        job.organization ===
        "Staff Selection Commission"
    );

  return (
    <div className="min-h-screen overflow-x-hidden text-white">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="fixed inset-x-0 top-0 z-50 px-4 py-3 sm:px-6">

        <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-3 sm:px-5">

          <Link
            to="/"
            className="flex min-w-0 items-center gap-3"
          >

            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 p-1.5 ring-1 ring-white/10">

              <img
                src="/logo.png"
                alt="A&A Online Services"
                className="h-full w-full object-contain"
              />

            </div>

            <div className="min-w-0">

              <h1 className="truncate text-sm font-bold sm:text-base">
                A&A Online Services
              </h1>

              <p className="hidden text-xs text-white/45 sm:block">
                Digital Service &
                Printing Center
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
            className="rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14] hover:-translate-y-0.5"
          >
            <span className="hidden sm:inline">
              Ask A&A
            </span>

            <span className="sm:hidden">
              Ask
            </span>
          </Link>

        </nav>

      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">

        {/* =====================================================
            HERO
        ===================================================== */}

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

            <p className="mt-4 max-w-3xl text-base leading-7 text-white/50 sm:text-lg">
              Printing, Xerox, lamination, online applications,
              scholarships, document services, bookings
              and more.
            </p>

          </div>

        </section>

        {/* =====================================================
            PRINTING PRICES
        ===================================================== */}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <PriceCard
            title="B&W Single"
            value="₹2 / page"
          />

          <PriceCard
            title="B&W Double"
            value="₹3 / 2-sided sheet"
          />

          <PriceCard
            title="Colour Single"
            value="₹5 / page"
          />

          <PriceCard
            title="Colour Double"
            value="₹8 / 2-sided sheet"
          />

        </section>

        {/* =====================================================
            XEROX PRICES
        ===================================================== */}

        <section className="mb-8 grid gap-3 md:grid-cols-2">

          <div className="glass rounded-2xl p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
              B&W Xerox
            </p>

            <p className="mt-2 text-sm font-bold text-white/80">
              ₹5 first page + ₹3 each
              additional page
            </p>

          </div>

          <div className="glass rounded-2xl p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
              Colour Xerox
            </p>

            <p className="mt-2 text-sm font-bold text-white/80">
              ₹10 first page + ₹6 each
              additional page
            </p>

          </div>

        </section>

        {/* =====================================================
            SEARCH
        ===================================================== */}

        <section className="glass rounded-3xl p-4 sm:p-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">

            <div className="relative flex-1">

              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search services..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-10 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.09]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                  aria-label="Clear search"
                >
                  <X
                    size={16}
                  />
                </button>
              )}

            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[650px]">

              {categories.map(
                (item) => (
                  <button
                    key={
                      item.value
                    }
                    type="button"
                    onClick={() =>
                      setCategory(
                        item.value
                      )
                    }
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      category ===
                      item.value
                        ? "bg-white text-slate-900"
                        : "bg-white/[0.06] text-white/55 hover:bg-white/[0.10] hover:text-white"
                    }`}
                  >
                    {
                      item.label
                    }
                  </button>
                )
              )}

            </div>

          </div>

        </section>

        {!loading &&
          !error && (
            <div className="mt-8 flex items-center justify-between gap-4">

              <p className="text-sm text-white/40">
                {
                  filteredServices.length
                }{" "}
                {filteredServices.length ===
                1
                  ? "service"
                  : "services"}{" "}
                available
              </p>

              {(search ||
                category !==
                  "all") && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="text-sm font-semibold text-white/60 hover:text-white"
                >
                  Clear filters
                </button>
              )}

            </div>
          )}

        {/* =====================================================
            SERVICE LOADING
        ===================================================== */}

        {loading && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {[
              1,
              2,
              3,
              4,
              5,
              6,
            ].map(
              (item) => (
                <div
                  key={item}
                  className="glass h-64 animate-pulse rounded-3xl"
                />
              )
            )}

          </div>
        )}

        {/* =====================================================
            SERVICE ERROR
        ===================================================== */}

        {!loading &&
          error && (
            <div className="mt-8 glass rounded-3xl p-8">

              <div className="flex flex-col items-center text-center">

                <div className="rounded-2xl bg-red-400/10 p-4 text-red-300">
                  <AlertCircle
                    size={28}
                  />
                </div>

                <h2 className="mt-5 text-xl font-bold">
                  Services couldn't
                  be loaded
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={
                    fetchServices
                  }
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14] hover:-translate-y-0.5"
                >
                  <RefreshCw
                    size={16}
                  />

                  Try Again
                </button>

              </div>

            </div>
          )}

        {/* =====================================================
            SERVICE CARDS
        ===================================================== */}

        {!loading &&
          !error &&
          filteredServices.length >
            0 && (
            <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {filteredServices.map(
                (service) => {
                  const Icon =
                    getIcon(
                      service.category
                    );

                  const isPrintService =
                    service.category ===
                      "printing" ||
                    service.category ===
                      "xerox";

                  return (
                    <article
                      key={
                        service.id
                      }
                      className="glass glass-hover group rounded-3xl p-6"
                    >

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

                      <h2 className="mt-7 text-xl font-bold">
                        {
                          service.name
                        }
                      </h2>

                      <p className="mt-2 min-h-10 text-sm leading-5 text-white/40">
                        {getDescription(
                          service.category
                        )}
                      </p>

                      <div className="my-5 h-px bg-white/10" />

                      <div className="flex items-end justify-between gap-4">

                        <div className="min-w-0">

                          <p className="text-xs text-white/35">
                            Pricing
                          </p>

                          <p className="mt-1 text-sm font-bold leading-5 text-white/80">
                            {formatPrice(
                              service
                            )}
                          </p>

                        </div>

                        <Link
                          to={
                            isPrintService
                              ? "/print"
                              : "/enquiry"
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 transition group-hover:translate-x-1"
                          aria-label={`Request ${service.name}`}
                        >
                          <ArrowRight
                            size={18}
                          />
                        </Link>

                      </div>

                      <Link
                        to={
                          isPrintService
                            ? "/print"
                            : "/enquiry"
                        }
                        className="mt-5 block rounded-xl bg-white/[0.06] px-4 py-3 text-center text-sm font-semibold text-white/65 transition hover:bg-white/[0.1] hover:text-white"
                      >
                        {isPrintService
                          ? "Start Print Order"
                          : "Make Enquiry"}
                      </Link>

                    </article>
                  );
                }
              )}

            </section>
          )}

        {/* =====================================================
            OFFICIAL DOCUMENT SERVICES
        ===================================================== */}

        <section className="mt-20">

          <div className="mb-7">

            <div className="inline-flex items-center gap-2 rounded-full bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-300">

              <ShieldCheck
                size={14}
              />

              OFFICIAL GOVERNMENT SERVICES

            </div>

            <h2 className="mt-3 text-3xl font-black">
              Government, Application & Booking Services
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
              Simple services, clear charges and direct access to official portals.
            </p>

          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {governmentServices.map(
              (service) => {
                const Icon =
                  service.icon;

                return (
                  <article
                    key={
                      service.id
                    }
                    className="glass glass-hover rounded-3xl p-6"
                  >

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07]">
                      <Icon
                        size={23}
                        className="text-white/75"
                      />
                    </div>

                    <h3 className="mt-6 text-lg font-bold">
                      {
                        service.title
                      }
                    </h3>

                    <p className="mt-2 min-h-16 text-sm leading-5 text-white/40">
                      {
                        service.description
                      }
                    </p>

                    <p className="mt-4 text-xs text-white/25">
                      {service.organization}
                    </p>

                    <p className="mt-3 text-sm font-semibold text-white/70">
                      {service.price}
                    </p>

                    <a
                      href={
                        service.url === "#applications"
                          ? "#applications"
                          : service.url
                      }
                      target={
                        service.url === "#applications"
                          ? undefined
                          : "_blank"
                      }
                      rel={
                        service.url === "#applications"
                          ? undefined
                          : "noopener noreferrer"
                      }
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                    >
                      Open Official Service

                      <ExternalLink
                        size={15}
                      />
                    </a>

                  </article>
                );
              }
            )}

          </div>

        </section>

        <section
          id="applications"
          className="mt-12 rounded-3xl border border-white/10 bg-white/[0.025] p-6"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10">
              <FileCheck2
                size={22}
                className="text-emerald-300"
              />
            </div>

            <div className="min-w-0">
              <h3 className="text-xl font-bold">
                ALL APPLICATIONS & SCHOLARSHIPS
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/45">
                All types of online government applications and scholarship
                applications are handled by A&A.
              </p>

              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                <span className="text-sm text-white/50">
                  A&A Online Services Charge
                </span>

                <span className="text-lg font-bold text-emerald-300">
                  ₹100
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
          <div className="grid gap-4 sm:grid-cols-3">

            <div className="rounded-2xl bg-white/[0.04] p-5">
              <p className="text-sm font-bold">
                Bus Bookings
              </p>
              <p className="mt-2 text-xs leading-5 text-white/40">
                Bus ticket booking assistance available.
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-5">
              <p className="text-sm font-bold">
                Train Bookings
              </p>
              <p className="mt-2 text-xs leading-5 text-white/40">
                Train ticket booking assistance available.
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-5">
              <p className="text-sm font-bold">
                Flight Bookings
              </p>
              <p className="mt-2 text-xs leading-5 text-white/40">
                Flight ticket booking assistance available.
              </p>
            </div>

          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">
                  TTD Darshanam Tickets
                </p>
                <p className="mt-1 text-xs text-white/40">
                  TTD Darshanam ticket booking assistance is available.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/50">
                Booking Available
              </span>
            </div>
          </div>
        </section>

        {/* =====================================================
            CTA
        ===================================================== */}

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
                  If you don't see the service
                  you need, send us an enquiry
                  and we'll tell you how we can
                  help.
                </p>

              </div>

              <Link
                to="/enquiry"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-6 py-3.5 font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14] hover:-translate-y-1"
              >
                Ask A&A

                <ArrowRight
                  size={17}
                />
              </Link>

            </div>

          </div>

        </section>

        {/* =====================================================
            FOOTER
        ===================================================== */}

        <footer className="mt-16 border-t border-white/10 py-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/10 p-1.5 ring-1 ring-white/10">

                <img
                  src="/logo.png"
                  alt="A&A Online Services"
                  className="h-full w-full object-contain"
                />

              </div>

              <div>

                <p className="font-bold">
                  A&A Online Services
                </p>

                <p className="mt-1 text-xs text-white/35">
                  Digital Service &
                  Printing Center
                </p>

              </div>

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
            ©{" "}
            {new Date().getFullYear()}{" "}
            A&A Online Services
          </p>

        </footer>

      </main>

    </div>
  );
}

function PriceCard({
  title,
  value,
}) {
  return (
    <div className="glass rounded-2xl p-4">

      <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
        {title}
      </p>

      <p className="mt-1 text-lg font-black">
        {value}
      </p>

    </div>
  );
}