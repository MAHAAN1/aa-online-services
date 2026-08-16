import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

const getAdminHeaders = () => {
  const token = sessionStorage.getItem("aa_admin_token");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

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

export default function Admin() {
  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const [authenticated, setAuthenticated] = useState(false);

  // ==========================================
  // STATE
  // ==========================================

  const [tab, setTab] = useState("orders");

  const [orders, setOrders] = useState([]);
  const [enquiries, setEnquiries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [updatingEnquiry, setUpdatingEnquiry] = useState(null);

  // ==========================================
  // DOCUMENT STATE
  // ==========================================

  const [documents, setDocuments] = useState({});
  const [loadingDocuments, setLoadingDocuments] = useState({});

  // ==========================================
  // CHECK LOGIN
  // ==========================================

  useEffect(() => {
    const admin = sessionStorage.getItem("aa_admin");

    if (!admin) {
      window.location.href = "/admin/login";
      return;
    }

    try {
      JSON.parse(admin);
      setAuthenticated(true);
    } catch {
      sessionStorage.removeItem("aa_admin");
      sessionStorage.removeItem("aa_admin_token");
      window.location.href = "/admin/login";
    }
  }, []);

  // ==========================================
  // LOAD DOCUMENTS FOR AN ORDER
  // ==========================================

  const loadOrderDocuments = async (orderId) => {
    try {
      setLoadingDocuments((current) => ({
        ...current,
        [orderId]: true,
      }));

      const response = await fetch(
        `${API_URL}/orders/admin/${orderId}/documents`,
        {
          method: "GET",
          headers: getAdminHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.message || "Unable to load order documents."
        );
      }

      const orderDocuments = Array.isArray(data.documents)
        ? data.documents
        : [];

      setDocuments((current) => ({
        ...current,
        [orderId]: orderDocuments,
      }));
    } catch (err) {
      console.error(
        "LOAD ORDER DOCUMENTS ERROR:",
        err
      );

      // Keep any documents already loaded instead of
      // replacing them with an empty list on refresh failure.
      setDocuments((current) => ({
        ...current,
        [orderId]: Array.isArray(current[orderId])
          ? current[orderId]
          : [],
      }));

      // Do not block the entire dashboard with an alert.
      // The order card will display the existing documents
      // or the "No documents found" state.
      setError(
        err.message ||
          "Unable to load order documents."
      );
    } finally {
      // This was the missing state reset causing
      // "Loading documents..." to remain forever.
      setLoadingDocuments((current) => ({
        ...current,
        [orderId]: false,
      }));
    }
  };

  // ==========================================
  // VIEW DOCUMENT
  // ==========================================

  const viewDocument = async (document, orderId) => {
    try {
      const token = sessionStorage.getItem("aa_admin_token");

      if (!token) {
        window.location.href = "/admin/login";
        return;
      }

      // ------------------------------------------
      // NEW MULTI-DOCUMENT ROUTE
      // ------------------------------------------

      if (document?.id) {
        const response = await fetch(
          `${API_URL}/orders/admin/document/${document.id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok || data.status === "error") {
          throw new Error(
            data.message || "Unable to open document."
          );
        }

        if (!data.url) {
          throw new Error(
            "Document URL was not generated."
          );
        }

        const newWindow = window.open("", "_blank");

        if (!newWindow) {
          throw new Error(
            "Popup was blocked by the browser."
          );
        }

        newWindow.location.href = data.url;
        return;
      }

      // ------------------------------------------
      // FALLBACK FOR OLD SINGLE DOCUMENT ORDERS
      // ------------------------------------------

      if (orderId) {
        const response = await fetch(
          `${API_URL}/orders/admin/${orderId}/document`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok || data.status === "error") {
          throw new Error(
            data.message || "Unable to open document."
          );
        }

        if (!data.url) {
          throw new Error(
            "Document URL was not generated."
          );
        }

        const newWindow = window.open("", "_blank");

        if (!newWindow) {
          throw new Error(
            "Popup was blocked by the browser."
          );
        }

        newWindow.location.href = data.url;
        return;
      }

      throw new Error("Document information is missing.");
    } catch (err) {
      console.error("View document error:", err);

      alert(
        err.message || "Unable to open document."
      );
    }
  };

  // ==========================================
  // LOAD DATA
  // ==========================================

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [ordersResponse, enquiriesResponse] =
        await Promise.all([
          fetch(`${API_URL}/orders/admin/all`, {
            method: "GET",
            headers: getAdminHeaders(),
          }),

          fetch(`${API_URL}/enquiries/admin/all`, {
            method: "GET",
            headers: getAdminHeaders(),
          }),
        ]);

      const ordersData = await ordersResponse.json();
      const enquiriesData = await enquiriesResponse.json();

      if (!ordersResponse.ok || ordersData.status === "error") {
        throw new Error(
          ordersData.message || "Unable to load orders."
        );
      }

      if (
        !enquiriesResponse.ok ||
        enquiriesData.status === "error"
      ) {
        throw new Error(
          enquiriesData.message ||
            "Unable to load enquiries."
        );
      }

      const loadedOrders = ordersData.orders || [];

      setOrders(loadedOrders);
      setEnquiries(enquiriesData.enquiries || []);

      // ------------------------------------------
      // LOAD DOCUMENTS FOR EVERY ORDER
      // ------------------------------------------

      if (loadedOrders.length > 0) {
        await Promise.all(
          loadedOrders.map((order) =>
            loadOrderDocuments(order.id)
          )
        );
      }
    } catch (err) {
      console.error("Load admin data error:", err);

      setError(
        err.message || "Unable to load admin data."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    if (authenticated) {
      loadData();
    }
  }, [authenticated]);

  // ==========================================
  // FILTER ORDERS
  // ==========================================

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return orders;
    }

    return orders.filter((order) =>
      [
        order.order_number,
        order.customer_name,
        order.phone,
        order.service,
        order.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        )
    );
  }, [orders, search]);

  // ==========================================
  // FILTER ENQUIRIES
  // ==========================================

  const filteredEnquiries = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return enquiries;
    }

    return enquiries.filter((enquiry) =>
      [
        enquiry.enquiry_number,
        enquiry.customer_name,
        enquiry.phone,
        enquiry.category,
        enquiry.subject,
        enquiry.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        )
    );
  }, [enquiries, search]);

  // ==========================================
  // UPDATE ORDER STATUS
  // ==========================================

  const updateOrderStatus = async (
    orderId,
    status
  ) => {
    try {
      setUpdatingOrder(orderId);

      const response = await fetch(
        `${API_URL}/orders/admin/${orderId}/status`,
        {
          method: "PATCH",
          headers: getAdminHeaders(),
          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.message || "Unable to update order."
        );
      }

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: data.order.status,
                updated_at: data.order.updated_at,
              }
            : order
        )
      );
    } catch (err) {
      alert(
        err.message || "Unable to update order."
      );
    } finally {
      setUpdatingOrder(null);
    }
  };

  // ==========================================
  // UPDATE ENQUIRY
  // ==========================================

  const updateEnquiry = async (
    enquiryId,
    status,
    adminReply
  ) => {
    try {
      setUpdatingEnquiry(enquiryId);

      const response = await fetch(
        `${API_URL}/enquiries/admin/${enquiryId}`,
        {
          method: "PATCH",
          headers: getAdminHeaders(),
          body: JSON.stringify({
            status,
            admin_reply: adminReply,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.message ||
            "Unable to update enquiry."
        );
      }

      setEnquiries((current) =>
        current.map((item) =>
          item.id === enquiryId
            ? data.enquiry
            : item
        )
      );
    } catch (err) {
      alert(
        err.message ||
          "Unable to update enquiry."
      );
    } finally {
      setUpdatingEnquiry(null);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = () => {
    sessionStorage.removeItem("aa_admin");
    sessionStorage.removeItem("aa_admin_token");

    window.location.href = "/admin/login";
  };

  // ==========================================
  // COUNTS
  // ==========================================

  const newOrders = orders.filter(
    (order) =>
      order.status === "received" ||
      order.status === "reviewing"
  ).length;

  const newEnquiries = enquiries.filter(
    (enquiry) => enquiry.status === "new"
  ).length;

  // ==========================================
  // WAIT FOR AUTH
  // ==========================================

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071426] text-white">
        <LoaderCircle
          size={25}
          className="animate-spin text-white/40"
        />
      </div>
    );
  }

  // ==========================================
  // ADMIN UI
  // ==========================================

  return (
    <main className="min-h-screen bg-[#071426] px-4 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50">
              <ClipboardList size={15} />
              A&A Admin
            </div>

            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Dashboard
            </h1>

            <p className="mt-3 text-white/40">
              Manage customer orders and enquiries.
            </p>
          </div>

          <div className="flex gap-3">

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              onClick={logout}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Logout
            </button>

          </div>
        </div>

        {/* STATS */}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">

          <StatCard
            title="Total Orders"
            value={orders.length}
          />

          <StatCard
            title="Orders Needing Attention"
            value={newOrders}
          />

          <StatCard
            title="New Enquiries"
            value={newEnquiries}
          />

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            <XCircle size={18} />
            {error}
          </div>
        )}

        {/* TABS */}

        <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2">

          <button
            onClick={() => {
              setTab("orders");
              setSearch("");
            }}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
              tab === "orders"
                ? "bg-white text-slate-900"
                : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
          >
            <ClipboardList size={17} />

            Orders

            <span className="ml-1 opacity-50">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => {
              setTab("enquiries");
              setSearch("");
            }}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
              tab === "enquiries"
                ? "bg-white text-slate-900"
                : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
          >
            <MessageSquare size={17} />

            Enquiries

            <span className="ml-1 opacity-50">
              {enquiries.length}
            </span>
          </button>

        </div>

        {/* SEARCH */}

        <div className="relative mb-6">

          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder={
              tab === "orders"
                ? "Search orders, customers, phone numbers..."
                : "Search enquiries, customers, subjects..."
            }
            className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />

        </div>

        {/* CONTENT */}

        {loading ? (

          <div className="flex min-h-[300px] items-center justify-center">

            <div className="flex items-center gap-3 text-white/40">

              <LoaderCircle
                size={22}
                className="animate-spin"
              />

              Loading dashboard...

            </div>

          </div>

        ) : tab === "orders" ? (

          <div className="space-y-4">

            {filteredOrders.length === 0 ? (

              <EmptyState
                icon={<ClipboardList size={28} />}
                title="No orders found"
                text="There are no orders matching your search."
              />

            ) : (

              filteredOrders.map((order) => (

                <OrderCard
                  key={order.id}
                  order={order}
                  documents={documents[order.id] || []}
                  loadingDocuments={
                    loadingDocuments[order.id]
                  }
                  updating={
                    updatingOrder === order.id
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

              ))

            )}

          </div>

        ) : (

          <div className="space-y-4">

            {filteredEnquiries.length === 0 ? (

              <EmptyState
                icon={<MessageSquare size={28} />}
                title="No enquiries found"
                text="There are no enquiries matching your search."
              />

            ) : (

              filteredEnquiries.map(
                (enquiry) => (

                  <EnquiryCard
                    key={enquiry.id}
                    enquiry={enquiry}
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


/* ============================================
   STAT CARD
============================================ */

function StatCard({
  title,
  value,
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl">

      <p className="text-sm text-white/35">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>

    </div>
  );
}


/* ============================================
   ORDER CARD
============================================ */

function OrderCard({
  order,
  documents,
  loadingDocuments,
  updating,
  onStatusChange,
  onViewDocument,
  onLoadDocuments,
}) {
  const documentCount = documents.length;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl backdrop-blur-xl md:p-6">

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-3">

            <span className="font-bold">
              {order.order_number}
            </span>

            <StatusBadge
              status={order.status}
            />

          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">

            <Info
              label="Customer"
              value={order.customer_name}
            />

            <Info
              label="Phone"
              value={order.phone}
            />

            <Info
              label="Service"
              value={order.service}
            />

            <Info
              label="Copies"
              value={order.copies}
            />

          </div>

          {/* DOCUMENTS */}

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">

            <div className="mb-3 flex items-center justify-between">

              <div className="flex items-center gap-2">

                <FileText
                  size={17}
                  className="text-white/50"
                />

                <p className="text-sm font-semibold">
                  Documents
                </p>

                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                  {documentCount}
                </span>

              </div>

              <button
                type="button"
                onClick={() =>
                  onLoadDocuments(order.id)
                }
                disabled={loadingDocuments}
                className="text-xs text-white/40 transition hover:text-white disabled:opacity-40"
              >
                {loadingDocuments
                  ? "Loading..."
                  : "Refresh"}
              </button>

            </div>

            {documents.length > 0 ? (

              <div className="space-y-2">

                {documents.map(
                  (document, index) => (

                    <div
                      key={
                        document.id ||
                        `${order.id}-${index}`
                      }
                      className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                          <FileText
                            size={16}
                            className="text-white/40"
                          />
                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-sm font-medium text-white/70">
                            {document.original_name ||
                              document.file_name ||
                              document.name ||
                              `Document ${index + 1}`}
                          </p>

                          {document.mime_type && (
                            <p className="mt-0.5 text-xs text-white/25">
                              {document.mime_type}
                            </p>
                          )}

                        </div>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onViewDocument(
                            document,
                            order.id
                          )
                        }
                        className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/10 hover:text-white"
                      >
                        <FileText size={14} />
                        View
                      </button>

                    </div>

                  )
                )}

              </div>

            ) : loadingDocuments ? (

              <div className="flex items-center gap-2 py-3 text-xs text-white/35">

                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />

                Loading documents...

              </div>

            ) : (

              <div className="py-2 text-xs text-white/30">
                No documents found for this order.
              </div>

             )}

          </div>

          {order.notes && (
            <div className="mt-4 rounded-xl bg-black/10 p-3 text-sm text-white/40">

              <span className="text-white/25">
                Notes:
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
            value={order.status || ""}
            disabled={updating}
            onChange={(e) =>
              onStatusChange(
                order.id,
                e.target.value
              )
            }
            className="w-full rounded-xl border border-white/10 bg-[#111d30] px-3 py-3 text-sm text-white outline-none"
          >

            {ORDER_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(status)}
                </option>
              )
            )}

          </select>

          {updating && (
            <div className="flex items-center gap-2 text-xs text-white/30">

              <LoaderCircle
                size={13}
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


/* ============================================
   ENQUIRY CARD
============================================ */

function EnquiryCard({
  enquiry,
  updating,
  onUpdate,
}) {
  const [reply, setReply] = useState(
    enquiry.admin_reply || ""
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl backdrop-blur-xl md:p-6">

      <div className="flex flex-col gap-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-3">

              <span className="font-bold">
                {enquiry.enquiry_number}
              </span>

              <StatusBadge
                status={enquiry.status}
              />

            </div>

            <h3 className="mt-4 text-lg font-bold">
              {enquiry.subject}
            </h3>

            <p className="mt-1 text-sm text-white/35">
              {enquiry.category}
            </p>

          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:text-right">

            <Info
              label="Customer"
              value={enquiry.customer_name}
            />

            <Info
              label="Phone"
              value={enquiry.phone}
            />

          </div>

        </div>

        <div className="rounded-2xl bg-black/10 p-4">

          <p className="mb-2 text-xs uppercase tracking-wider text-white/25">
            Customer message
          </p>

          <p className="whitespace-pre-wrap text-sm leading-6 text-white/65">
            {enquiry.message}
          </p>

        </div>

        <div>

          <label className="mb-2 block text-xs uppercase tracking-wider text-white/25">
            Admin reply
          </label>

          <textarea
            value={reply}
            onChange={(e) =>
              setReply(e.target.value)
            }
            rows={3}
            placeholder="Write a reply..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
          />

        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <select
            value={enquiry.status || ""}
            disabled={updating}
            onChange={(e) =>
              onUpdate(
                enquiry.id,
                e.target.value,
                reply
              )
            }
            className="rounded-xl border border-white/10 bg-[#111d30] px-4 py-3 text-sm text-white outline-none"
          >

            {ENQUIRY_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(status)}
                </option>
              )
            )}

          </select>

          <button
            disabled={updating}
            onClick={() =>
              onUpdate(
                enquiry.id,
                enquiry.status,
                reply
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-white/90 disabled:opacity-50"
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
                <CheckCircle2 size={15} />

                Save Reply
              </>
            )}

          </button>

        </div>

      </div>

    </div>
  );
}


/* ============================================
   INFO
============================================ */

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
        {value || "—"}
      </p>

    </div>
  );
}


/* ============================================
   STATUS BADGE
============================================ */

function StatusBadge({
  status,
}) {
  const danger =
    status === "cancelled";

  const success =
    status === "completed" ||
    status === "ready" ||
    status === "resolved";

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
      {formatStatus(status)}
    </span>
  );
}


/* ============================================
   FORMAT STATUS
============================================ */

function formatStatus(status) {
  if (!status) {
    return "Unknown";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


/* ============================================
   EMPTY STATE
============================================ */

function EmptyState({
  icon,
  title,
  text,
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/30">
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