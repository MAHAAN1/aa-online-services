import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const RAW_API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

const API_URL = (() => {
  const value = RAW_API_URL.replace(/\/+$/, "");

  if (/\/api$/i.test(value)) {
    return value;
  }

  return `${value}/api`;
})();

const ORDER_STATUSES = [
  "received",
  "reviewing",
  "awaiting_payment",
  "processing",
  "ready",
  "completed",
  "needs_customer_action",
  "cancelled",
];

const ENQUIRY_STATUSES = [
  "new",
  "reviewing",
  "replied",
  "resolved",
  "cancelled",
];

const getAdminHeaders = () => {
  const token =
    sessionStorage.getItem(
      "aa_admin_token"
    );

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "₹0.00";
  }

  return `₹${number.toFixed(2)}`;
};

const formatStatus = (value) => {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
};

const formatColor = (value) => {
  return value === "color"
    ? "Colour"
    : "B&W";
};

const formatSides = (value) => {
  return value === "double"
    ? "Double Side"
    : "Single Side";
};

const formatService = (value) => {
  if (
    value === "xerox" ||
    value === "photocopy"
  ) {
    return "Xerox";
  }

  return "Printing";
};

const getDocuments = (
  state
) => {
  if (
    Array.isArray(state)
  ) {
    return state;
  }

  return Array.isArray(
    state?.documents
  )
    ? state.documents
    : [];
};

export default function Admin() {
  const [authenticated, setAuthenticated] =
    useState(false);

  const [admin, setAdmin] =
    useState(null);

  const [tab, setTab] =
    useState("orders");

  const [orders, setOrders] =
    useState([]);

  const [enquiries, setEnquiries] =
    useState([]);

  const [documents, setDocuments] =
    useState({});

  const [loadingDocuments, setLoadingDocuments] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [paymentFilter, setPaymentFilter] =
    useState("all");

  const [updatingOrder, setUpdatingOrder] =
    useState(null);

  const [updatingEnquiry, setUpdatingEnquiry] =
    useState(null);

  useEffect(() => {
    const savedAdmin =
      sessionStorage.getItem(
        "aa_admin"
      );

    const token =
      sessionStorage.getItem(
        "aa_admin_token"
      );

    if (!savedAdmin || !token) {
      window.location.href =
        "/admin/login";
      return;
    }

    try {
      const parsed =
        JSON.parse(savedAdmin);

      setAdmin(parsed);
      setAuthenticated(true);
    } catch {
      sessionStorage.removeItem(
        "aa_admin"
      );

      sessionStorage.removeItem(
        "aa_admin_token"
      );

      window.location.href =
        "/admin/login";
    }
  }, []);

  const handleUnauthorized = useCallback(
    () => {
      sessionStorage.removeItem(
        "aa_admin"
      );

      sessionStorage.removeItem(
        "aa_admin_token"
      );

      window.location.href =
        "/admin/login";
    },
    []
  );

  const loadOrderDocuments =
    useCallback(
      async (orderId) => {
        try {
          setLoadingDocuments(
            (current) => ({
              ...current,
              [orderId]: true,
            })
          );

          const response =
            await fetch(
              `${API_URL}/orders/admin/${orderId}/documents`,
              {
                method: "GET",
                headers:
                  getAdminHeaders(),
              }
            );

          if (
            response.status ===
            401
          ) {
            handleUnauthorized();
            return;
          }

          const data =
            await response.json();

          if (
            !response.ok ||
            data.status ===
              "error"
          ) {
            throw new Error(
              data.message ||
                "Unable to load documents."
            );
          }

          setDocuments(
            (current) => ({
              ...current,
              [orderId]: {
                order:
                  data.order ||
                  null,
                documents:
                  Array.isArray(
                    data.documents
                  )
                    ? data.documents
                    : [],
              },
            })
          );
        } catch (err) {
          console.error(
            "Load documents error:",
            err
          );

          setDocuments(
            (current) => ({
              ...current,
              [orderId]: {
                order: null,
                documents: [],
              },
            })
          );
        } finally {
          setLoadingDocuments(
            (current) => ({
              ...current,
              [orderId]: false,
            })
          );
        }
      },
      [handleUnauthorized]
    );

  const loadData = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        /*
         * IMPORTANT:
         *
         * server.js:
         *
         * app.use("/api/orders", ordersRouter)
         * app.use("/api/enquiries", enquiriesRouter)
         *
         * orders.js:
         * router.get("/admin/all")
         *
         * enquiries.js:
         * router.get("/admin/all")
         *
         * Therefore the final URLs are:
         *
         * /api/orders/admin/all
         * /api/enquiries/admin/all
         */

        const [
          ordersResponse,
          enquiriesResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/orders/admin/all`,
            {
              method: "GET",
              headers:
                getAdminHeaders(),
            }
          ),

          fetch(
            `${API_URL}/enquiries/admin/all`,
            {
              method: "GET",
              headers:
                getAdminHeaders(),
            }
          ),
        ]);

        if (
          ordersResponse.status ===
            401 ||
          enquiriesResponse.status ===
            401
        ) {
          handleUnauthorized();
          return;
        }

        const ordersData =
          await ordersResponse.json();

        const enquiriesData =
          await enquiriesResponse.json();

        if (
          !ordersResponse.ok ||
          ordersData.status ===
            "error"
        ) {
          throw new Error(
            ordersData.message ||
              "Unable to load orders."
          );
        }

        if (
          !enquiriesResponse.ok ||
          enquiriesData.status ===
            "error"
        ) {
          throw new Error(
            enquiriesData.message ||
              "Unable to load enquiries."
          );
        }

        const loadedOrders =
          Array.isArray(
            ordersData.orders
          )
            ? ordersData.orders
            : [];

        const loadedEnquiries =
          Array.isArray(
            enquiriesData.enquiries
          )
            ? enquiriesData.enquiries
            : [];

        setOrders(
          loadedOrders
        );

        setEnquiries(
          loadedEnquiries
        );

        /*
         * Load exact customer requirements
         * for every order.
         *
         * This is intentionally separate
         * from the main order request so
         * one document failure cannot hide
         * the complete order list.
         */

        await Promise.allSettled(
          loadedOrders.map(
            (order) =>
              loadOrderDocuments(
                order.id
              )
          )
        );
      } catch (err) {
        console.error(
          "Load admin data error:",
          err
        );

        setError(
          err.message ||
            "Unable to load admin data."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      handleUnauthorized,
      loadOrderDocuments,
    ]
  );

  useEffect(() => {
    if (authenticated) {
      loadData();
    }
  }, [
    authenticated,
    loadData,
  ]);

  const updateOrderStatus =
    async (
      orderId,
      status
    ) => {
      try {
        setUpdatingOrder(
          orderId
        );

        const response =
          await fetch(
            `${API_URL}/orders/admin/${orderId}/status`,
            {
              method: "PATCH",
              headers:
                getAdminHeaders(),
              body: JSON.stringify({
                status,
              }),
            }
          );

        if (
          response.status ===
          401
        ) {
          handleUnauthorized();
          return;
        }

        const data =
          await response.json();

        if (
          !response.ok ||
          data.status ===
            "error"
        ) {
          throw new Error(
            data.message ||
              "Unable to update order."
          );
        }

        setOrders(
          (current) =>
            current.map(
              (order) =>
                order.id ===
                orderId
                  ? {
                      ...order,
                      ...data.order,
                    }
                  : order
            )
        );
      } catch (err) {
        console.error(
          "Update order error:",
          err
        );

        setError(
          err.message ||
            "Unable to update order."
        );
      } finally {
        setUpdatingOrder(
          null
        );
      }
    };

  const updateEnquiry =
    async (
      enquiryId,
      status,
      adminReply
    ) => {
      try {
        setUpdatingEnquiry(
          enquiryId
        );

        const response =
          await fetch(
            `${API_URL}/enquiries/admin/${enquiryId}`,
            {
              method: "PATCH",
              headers:
                getAdminHeaders(),
              body: JSON.stringify({
                status,
                admin_reply:
                  adminReply,
              }),
            }
          );

        if (
          response.status ===
          401
        ) {
          handleUnauthorized();
          return;
        }

        const data =
          await response.json();

        if (
          !response.ok ||
          data.status ===
            "error"
        ) {
          throw new Error(
            data.message ||
              "Unable to update enquiry."
          );
        }

        setEnquiries(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                enquiryId
                  ? data.enquiry
                  : item
            )
        );
      } catch (err) {
        console.error(
          "Update enquiry error:",
          err
        );

        setError(
          err.message ||
            "Unable to update enquiry."
        );
      } finally {
        setUpdatingEnquiry(
          null
        );
      }
    };

  const viewDocument =
    async (
      document,
      orderId
    ) => {
      try {
        const token =
          sessionStorage.getItem(
            "aa_admin_token"
          );

        if (!token) {
          handleUnauthorized();
          return;
        }

        let endpoint;

        if (document?.id) {
          endpoint =
            `${API_URL}/orders/admin/document/${document.id}`;
        } else {
          endpoint =
            `${API_URL}/orders/admin/${orderId}/document`;
        }

        const response =
          await fetch(
            endpoint,
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          response.status ===
          401
        ) {
          handleUnauthorized();
          return;
        }

        const data =
          await response.json();

        if (
          !response.ok ||
          data.status ===
            "error"
        ) {
          throw new Error(
            data.message ||
              "Unable to open document."
          );
        }

        const url =
          data.url;

        if (!url) {
          throw new Error(
            "Document URL was not generated."
          );
        }

        const newWindow =
          window.open(
            "",
            "_blank"
          );

        if (!newWindow) {
          throw new Error(
            "Popup was blocked by the browser."
          );
        }

        newWindow.location.href =
          url;
      } catch (err) {
        console.error(
          "View document error:",
          err
        );

        setError(
          err.message ||
            "Unable to open document."
        );
      }
    };

  const filteredOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const searchText = [
            order.order_number,
            order.customer_name,
            order.phone,
            order.customer_email,
            order.service,
            order.status,
            order.payment_status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchText.includes(
              query
            );

          const matchesStatus =
            statusFilter ===
              "all" ||
            order.status ===
              statusFilter;

          const matchesPayment =
            paymentFilter ===
              "all" ||
            order.payment_status ===
              paymentFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPayment
          );
        }
      );
    }, [
      orders,
      search,
      statusFilter,
      paymentFilter,
    ]);

  const filteredEnquiries =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return enquiries;
      }

      return enquiries.filter(
        (enquiry) =>
          [
            enquiry.enquiry_number,
            enquiry.customer_name,
            enquiry.phone,
            enquiry.email,
            enquiry.category,
            enquiry.subject,
            enquiry.message,
            enquiry.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [
      enquiries,
      search,
    ]);

  const stats =
    useMemo(() => {
      const paidOrders =
        orders.filter(
          (order) =>
            order.payment_status ===
            "paid"
        );

      const paidRevenue =
        paidOrders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.paid_amount ??
                order.amount ??
                0
            ),
          0
        );

      const activeOrders =
        orders.filter(
          (order) =>
            ![
              "completed",
              "cancelled",
            ].includes(
              order.status
            )
        ).length;

      return {
        totalOrders:
          orders.length,

        activeOrders,

        paidOrders:
          paidOrders.length,

        paidRevenue,

        enquiries:
          enquiries.length,
      };
    }, [
      orders,
      enquiries,
    ]);

  const logout = () => {
    sessionStorage.removeItem(
      "aa_admin"
    );

    sessionStorage.removeItem(
      "aa_admin_token"
    );

    window.location.href =
      "/admin/login";
  };

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071426] text-white">
        <LoaderCircle
          size={28}
          className="animate-spin text-white/40"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071426] text-white">

      {/* HEADER */}

      <header className="border-b border-white/10 bg-[#071426]">

        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1">

              <img
                src="/logo.png"
                alt="A&A Online Services"
                className="h-full w-full object-contain"
              />

            </div>

            <div>

              <h2 className="font-bold">
                A&A Admin
              </h2>

              <p className="text-xs text-white/35">
                {admin?.email ||
                  admin?.username ||
                  "Administrator"}
              </p>

            </div>

          </div>

          <div className="flex gap-2">

            <button
              type="button"
              onClick={
                loadData
              }
              disabled={
                loading
              }
              className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/60 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
            >

              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh

            </button>

            <button
              type="button"
              onClick={
                logout
              }
              className="flex items-center gap-2 rounded-xl bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300"
            >

              <XCircle
                size={17}
              />

              Logout

            </button>

          </div>

        </div>

      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-8">

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">

            <XCircle
              size={18}
            />

            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-auto text-white/40 hover:text-white"
            >
              ×
            </button>

          </div>
        )}

        {/* DASHBOARD TITLE */}

        <div className="mb-8">

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/45">

            <ShieldCheck
              size={14}
            />

            Protected Admin Dashboard

          </div>

          <h1 className="text-5xl font-black tracking-tight">
            Dashboard
          </h1>

          <p className="mt-3 text-white/40">
            Manage customer orders,
            payments and enquiries.
          </p>

        </div>

        {/* STATS */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <StatCard
            title="Total Orders"
            value={
              stats.totalOrders
            }
            icon={
              <ClipboardList
                size={20}
              />
            }
          />

          <StatCard
            title="Active Orders"
            value={
              stats.activeOrders
            }
            icon={
              <LoaderCircle
                size={20}
              />
            }
          />

          <StatCard
            title="Paid Orders"
            value={
              stats.paidOrders
            }
            icon={
              <CheckCircle2
                size={20}
              />
            }
          />

          <StatCard
            title="Paid Revenue"
            value={formatCurrency(
              stats.paidRevenue
            )}
            icon={
              <CreditCard
                size={20}
              />
            }
          />

          <StatCard
            title="Enquiries"
            value={
              stats.enquiries
            }
            icon={
              <FileText
                size={20}
              />
            }
          />

        </div>

        {/* TABS */}

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex gap-2">

            <button
              type="button"
              onClick={() => {
                setTab(
                  "orders"
                );
                setSearch("");
              }}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${
                tab ===
                "orders"
                  ? "bg-white text-slate-900"
                  : "bg-white/[0.05] text-white/45"
              }`}
            >
              Orders{" "}
              <span className="ml-1 opacity-50">
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab(
                  "enquiries"
                );
                setSearch("");
              }}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${
                tab ===
                "enquiries"
                  ? "bg-white text-slate-900"
                  : "bg-white/[0.05] text-white/45"
              }`}
            >
              Enquiries{" "}
              <span className="ml-1 opacity-50">
                {enquiries.length}
              </span>
            </button>

          </div>

          <div className="relative w-full lg:max-w-md">

            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder={
                tab ===
                "orders"
                  ? "Search orders..."
                  : "Search enquiries..."
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.055] py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
            />

          </div>

        </div>

        {/* ORDERS FILTERS */}

        {tab ===
          "orders" && (
          <div className="mb-5 flex flex-wrap gap-3">

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
              className="rounded-xl border border-white/10 bg-[#111d30] px-4 py-3 text-sm text-white outline-none"
            >

              <option value="all">
                All statuses
              </option>

              {ORDER_STATUSES.map(
                (
                  status
                ) => (
                  <option
                    key={
                      status
                    }
                    value={
                      status
                    }
                  >
                    {formatStatus(
                      status
                    )}
                  </option>
                )
              )}

            </select>

            <select
              value={
                paymentFilter
              }
              onChange={(
                event
              ) =>
                setPaymentFilter(
                  event.target
                    .value
                )
              }
              className="rounded-xl border border-white/10 bg-[#111d30] px-4 py-3 text-sm text-white outline-none"
            >

              <option value="all">
                All payments
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="failed">
                Failed
              </option>

              <option value="refunded">
                Refunded
              </option>

            </select>

          </div>
        )}

        {/* CONTENT */}

        {loading ? (
          <div className="flex min-h-[350px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.035]">

            <div className="flex items-center gap-3 text-white/40">

              <LoaderCircle
                size={25}
                className="animate-spin"
              />

              Loading dashboard...

            </div>

          </div>
        ) : tab ===
          "orders" ? (
          <div className="space-y-5">

            {filteredOrders.length ===
            0 ? (
              <EmptyState
                icon={
                  <ClipboardList
                    size={28}
                  />
                }
                title="No orders found"
                text="There are no orders matching the current filters."
              />
            ) : (
              filteredOrders.map(
                (order) => (
                  <OrderCard
                    key={
                      order.id
                    }
                    order={
                      order
                    }
                    documentState={
                      documents[
                        order.id
                      ]
                    }
                    loadingDocuments={
                      loadingDocuments[
                        order.id
                      ]
                    }
                    updating={
                      updatingOrder ===
                      order.id
                    }
                    onStatusChange={
                      updateOrderStatus
                    }
                    onViewDocument={
                      viewDocument
                    }
                    onLoadDocuments={
                      loadOrderDocuments
                    }
                  />
                )
              )
            )}

          </div>
        ) : (
          <div className="space-y-5">

            {filteredEnquiries.length ===
            0 ? (
              <EmptyState
                icon={
                  <MessageSquare
                    size={28}
                  />
                }
                title="No enquiries found"
                text="There are no enquiries matching the current search."
              />
            ) : (
              filteredEnquiries.map(
                (enquiry) => (
                  <EnquiryCard
                    key={
                      enquiry.id
                    }
                    enquiry={
                      enquiry
                    }
                    updating={
                      updatingEnquiry ===
                      enquiry.id
                    }
                    onUpdate={
                      updateEnquiry
                    }
                  />
                )
              )
            )}

          </div>
        )}

      </div>

    </main>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5">

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.07] text-white/55">
        {icon}
      </div>

      <p className="mt-5 text-xs uppercase tracking-wider text-white/30">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   ORDER CARD
============================================================ */

function OrderCard({
  order,
  documentState,
  loadingDocuments,
  updating,
  onStatusChange,
  onViewDocument,
  onLoadDocuments,
}) {
  const documents =
    getDocuments(
      documentState
    );

  const serverOrder =
    documentState?.order ||
    null;

  const amount =
    order.amount ??
    serverOrder?.amount ??
    0;

  const paymentStatus =
    order.payment_status ??
    serverOrder?.payment_status ??
    "pending";

  const paidAmount =
    order.paid_amount ??
    serverOrder?.paid_amount ??
    0;

  const razorpayPaymentId =
    order.razorpay_payment_id ??
    serverOrder?.razorpay_payment_id;

  const razorpayOrderId =
    order.razorpay_order_id ??
    serverOrder?.razorpay_order_id;

  const documentCharges =
    documents.reduce(
      (sum, document) =>
        sum +
        Number(
          document.amount || 0
        ),
      0
    );

  const totalPages =
    documents.reduce(
      (sum, document) =>
        sum +
        Number(
          document.pages || 0
        ),
      0
    );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl md:p-6">

      {/* ORDER HEADER */}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-3">

            <span className="font-bold">
              {order.order_number}
            </span>

            <StatusBadge
              status={
                order.status
              }
            />

            <PaymentBadge
              status={
                paymentStatus
              }
            />

          </div>

          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">

            <Info
              label="Customer"
              value={
                order.customer_name
              }
            />

            <Info
              label="Phone"
              value={
                order.phone
              }
            />

            <Info
              label="Total Amount"
              value={formatCurrency(
                amount
              )}
            />

            <Info
              label="Amount Paid"
              value={
                paymentStatus ===
                "paid"
                  ? formatCurrency(
                      paidAmount ||
                        amount
                    )
                  : "Not Paid"
              }
            />

          </div>

          {/* PAYMENT */}

          <div className="mt-5 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.035] p-4">

            <div className="mb-4 flex items-center gap-2">

              <CreditCard
                size={17}
                className="text-emerald-300"
              />

              <p className="font-semibold">
                Payment
              </p>

            </div>

            <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">

              <Info
                label="Payment Status"
                value={formatStatus(
                  paymentStatus
                )}
              />

              <Info
                label="Amount Paid"
                value={
                  paymentStatus ===
                  "paid"
                    ? formatCurrency(
                        paidAmount ||
                          amount
                      )
                    : "₹0.00"
                }
              />

              <Info
                label="Razorpay Payment ID"
                value={
                  razorpayPaymentId
                }
              />

              <Info
                label="Razorpay Order ID"
                value={
                  razorpayOrderId
                }
              />

              <Info
                label="Order Amount"
                value={formatCurrency(
                  amount
                )}
              />

              <Info
                label="Document Charges"
                value={formatCurrency(
                  documentCharges
                )}
              />

            </div>

          </div>

          {/* DOCUMENTS */}

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">

            <div className="mb-4 flex items-center justify-between">

              <div className="flex items-center gap-2">

                <FileText
                  size={17}
                  className="text-white/50"
                />

                <p className="font-semibold">
                  Documents
                </p>

                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                  {documents.length}
                </span>

              </div>

              <button
                type="button"
                onClick={() =>
                  onLoadDocuments(
                    order.id
                  )
                }
                disabled={
                  loadingDocuments
                }
                className="text-xs text-white/40 hover:text-white disabled:opacity-40"
              >
                {loadingDocuments
                  ? "Loading..."
                  : "Refresh"}
              </button>

            </div>

            {loadingDocuments ? (
              <div className="flex items-center gap-2 py-5 text-xs text-white/35">

                <LoaderCircle
                  size={15}
                  className="animate-spin"
                />

                Loading customer
                requirements...

              </div>
            ) : documents.length ===
              0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4 text-xs text-white/30">
                No document details
                found.
              </div>
            ) : (
              <div className="space-y-4">

                {documents.map(
                  (
                    document,
                    index
                  ) => (
                    <DocumentCard
                      key={
                        document.id ||
                        `${order.id}-${index}`
                      }
                      document={
                        document
                      }
                      index={
                        index
                      }
                      orderId={
                        order.id
                      }
                      onView={
                        onViewDocument
                      }
                    />
                  )
                )}

              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-5 border-t border-white/5 pt-4 text-xs text-white/40">

              <span>
                Total pages:{" "}
                <b className="text-white/70">
                  {totalPages}
                </b>
              </span>

              <span>
                Document charges:{" "}
                <b className="text-white/70">
                  {formatCurrency(
                    documentCharges
                  )}
                </b>
              </span>

            </div>

          </div>

          {order.notes && (
            <div className="mt-4 rounded-xl bg-black/10 p-3 text-sm text-white/40">

              <span className="text-white/25">
                Customer Notes:
              </span>{" "}

              {order.notes}

            </div>
          )}

        </div>

        {/* STATUS */}

        <div className="flex w-full flex-col gap-3 xl:w-56">

          <label className="text-xs text-white/30">
            Update status
          </label>

          <select
            value={
              order.status ||
              "received"
            }
            disabled={
              updating
            }
            onChange={(event) =>
              onStatusChange(
                order.id,
                event.target
                  .value
              )
            }
            className="w-full rounded-xl border border-white/10 bg-[#111d30] px-3 py-3 text-sm text-white outline-none"
          >

            {ORDER_STATUSES.map(
              (status) => (
                <option
                  key={
                    status
                  }
                  value={
                    status
                  }
                >
                  {formatStatus(
                    status
                  )}
                </option>
              )
            )}

          </select>

          {updating && (
            <div className="flex items-center gap-2 text-xs text-white/30">

              <LoaderCircle
                size={14}
                className="animate-spin"
              />

              Updating...

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   DOCUMENT CARD
============================================================ */

function DocumentCard({
  document,
  index,
  orderId,
  onView,
}) {
  const pages =
    Number(
      document.pages
    ) || 0;

  const copies =
    Math.max(
      1,
      Number(
        document.copies
      ) || 1
    );

  const service =
    document.service_type ||
    "printing";

  const serviceName =
    document.service_name ||
    formatService(
      service
    );

  const color =
    document.color_mode ||
    "bw";

  const sides =
    document.sides ||
    "single";

  const amount =
    Number(
      document.amount
    ) || 0;

  const requestText =
    service === "xerox" ||
    service === "photocopy"
      ? `${formatColor(
          color
        )} Xerox`
      : `${formatColor(
          color
        )} · ${formatSides(
          sides
        )}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">

      <div className="flex flex-col gap-4">

        <div className="flex items-start justify-between gap-4">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">

              <FileText
                size={18}
                className="text-white/45"
              />

            </div>

            <div className="min-w-0">

              <p className="text-[10px] uppercase tracking-wider text-white/25">
                Document{" "}
                {index + 1}
              </p>

              <p className="truncate text-sm font-bold text-white/75">
                {document.original_name ||
                  document.file_name ||
                  document.name ||
                  `Document ${
                    index + 1
                  }`}
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              onView(
                document,
                orderId
              )
            }
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/[0.1] hover:text-white"
          >
            View
          </button>

        </div>

        {/* EXACT CUSTOMER REQUEST */}

        <div className="rounded-xl border border-blue-400/10 bg-blue-400/[0.035] p-4">

          <div className="flex items-center justify-between gap-3">

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300/70">
              Customer Print Request
            </p>

            <span className="rounded-full bg-blue-400/10 px-3 py-1 text-[10px] font-black text-blue-300">
              EXACT REQUEST
            </span>

          </div>

          <p className="mt-2 text-sm font-black text-blue-200">
            {requestText}
          </p>

        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

          <Requirement
            label="Service"
            value={
              serviceName
            }
          />

          <Requirement
            label="Colour"
            value={formatColor(
              color
            )}
          />

          <Requirement
            label="Sides"
            value={
              service ===
                "xerox" ||
              service ===
                "photocopy"
                ? "N/A"
                : formatSides(
                    sides
                  )
            }
          />

          <Requirement
            label="Pages"
            value={
              pages
            }
          />

          <Requirement
            label="Copies"
            value={
              copies
            }
          />

        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/10 px-4 py-3">

          <div>

            <p className="text-[10px] uppercase tracking-wider text-white/25">
              Print Instructions
            </p>

            <p className="mt-1 text-sm font-bold text-white/65">
              {pages} pages ×{" "}
              {copies}{" "}
              {copies ===
              1
                ? "copy"
                : "copies"}{" "}
              ·{" "}
              {requestText}
            </p>

          </div>

          <div className="text-right">

            <p className="text-[10px] uppercase tracking-wider text-white/25">
              Amount
            </p>

            <p className="mt-1 font-black">
              {formatCurrency(
                amount
              )}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   ENQUIRY CARD
============================================================ */

function EnquiryCard({
  enquiry,
  updating,
  onUpdate,
}) {
  const [reply, setReply] =
    useState(
      enquiry.admin_reply ||
        ""
    );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl md:p-6">

      <div className="flex flex-col gap-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-3">

              <span className="font-bold">
                {enquiry.enquiry_number ||
                  "Enquiry"}
              </span>

              <StatusBadge
                status={
                  enquiry.status
                }
              />

            </div>

            <h3 className="mt-4 text-lg font-bold">
              {enquiry.subject ||
                "Customer Enquiry"}
            </h3>

            <p className="mt-1 text-sm text-white/35">
              {enquiry.category ||
                "General"}
            </p>

          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">

            <Info
              label="Customer"
              value={
                enquiry.customer_name
              }
            />

            <Info
              label="Phone"
              value={
                enquiry.phone
              }
            />

          </div>

        </div>

        <div className="rounded-2xl bg-black/10 p-4">

          <p className="mb-2 text-xs uppercase tracking-wider text-white/25">
            Customer Message
          </p>

          <p className="whitespace-pre-wrap text-sm leading-6 text-white/65">
            {enquiry.message ||
              "—"}
          </p>

        </div>

        <div>

          <label className="mb-2 block text-xs uppercase tracking-wider text-white/25">
            Admin Reply
          </label>

          <textarea
            value={reply}
            onChange={(event) =>
              setReply(
                event.target.value
              )
            }
            rows={3}
            placeholder="Write a reply..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
          />

        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <select
            value={
              enquiry.status ||
              "new"
            }
            disabled={
              updating
            }
            onChange={(event) =>
              onUpdate(
                enquiry.id,
                event.target
                  .value,
                reply
              )
            }
            className="rounded-xl border border-white/10 bg-[#111d30] px-4 py-3 text-sm text-white outline-none"
          >

            {ENQUIRY_STATUSES.map(
              (status) => (
                <option
                  key={
                    status
                  }
                  value={
                    status
                  }
                >
                  {formatStatus(
                    status
                  )}
                </option>
              )
            )}

          </select>

          <button
            type="button"
            disabled={
              updating
            }
            onClick={() =>
              onUpdate(
                enquiry.id,
                enquiry.status ||
                  "new",
                reply
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 disabled:opacity-50"
          >

            {updating ? (
              <>
                <LoaderCircle
                  size={15}
                  className="animate-spin"
                />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2
                  size={15}
                />
                Save Reply
              </>
            )}

          </button>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   REQUIREMENT
============================================================ */

function Requirement({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-[#111d30] p-3">

      <p className="text-[10px] uppercase tracking-wider text-white/25">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-white/70">
        {value ?? "—"}
      </p>

    </div>
  );
}

/* ============================================================
   INFO
============================================================ */

function Info({
  label,
  value,
}) {
  return (
    <div>

      <p className="text-xs text-white/25">
        {label}
      </p>

      <p className="mt-1 truncate font-medium text-white/70">
        {value ||
          "—"}
      </p>

    </div>
  );
}

/* ============================================================
   STATUS BADGE
============================================================ */

function StatusBadge({
  status,
}) {
  const danger =
    status ===
    "cancelled";

  const success = [
    "completed",
    "ready",
    "resolved",
  ].includes(
    status
  );

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        danger
          ? "bg-red-400/10 text-red-300"
          : success
          ? "bg-emerald-400/10 text-emerald-300"
          : "bg-white/10 text-white/55"
      }`}
    >
      {formatStatus(
        status
      )}
    </span>
  );
}

/* ============================================================
   PAYMENT BADGE
============================================================ */

function PaymentBadge({
  status,
}) {
  const paid =
    status ===
    "paid";

  const failed =
    status ===
      "failed" ||
    status ===
      "refunded";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        paid
          ? "bg-emerald-400/10 text-emerald-300"
          : failed
          ? "bg-red-400/10 text-red-300"
          : "bg-amber-400/10 text-amber-300"
      }`}
    >
      {formatStatus(
        status ||
          "pending"
      )}
    </span>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  icon,
  title,
  text,
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-14 text-center">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] text-white/30">
        {icon}
      </div>

      <h2 className="mt-5 text-lg font-bold">
        {title}
      </h2>

      <p className="mt-2 text-sm text-white/30">
        {text}
      </p>

    </div>
  );
}