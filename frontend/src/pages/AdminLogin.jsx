import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api";

const ADMIN_SESSION_KEY =
  "aa_admin";

const ADMIN_TOKEN_KEY =
  "aa_admin_token";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] =
    useState(
      "admin@aa-online-services.com"
    );

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const login = async (event) => {
    event.preventDefault();

    setError("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError(
        "Enter your email and password."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setError(
        "Enter a valid admin email address."
      );
      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          `${API_URL}/admin/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email: cleanEmail,
              password,
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
            "Login failed. Check your credentials."
        );
      }

      if (!data?.token) {
        throw new Error(
          "Login succeeded but no authentication token was returned."
        );
      }

      if (!data?.admin) {
        throw new Error(
          "Login succeeded but admin information was not returned."
        );
      }

      /*
       * Clear any stale admin session before
       * creating the new authenticated session.
       */
      sessionStorage.removeItem(
        ADMIN_SESSION_KEY
      );

      sessionStorage.removeItem(
        ADMIN_TOKEN_KEY
      );

      sessionStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify(
          data.admin
        )
      );

      sessionStorage.setItem(
        ADMIN_TOKEN_KEY,
        data.token
      );

      navigate("/admin", {
        replace: true,
      });
    } catch (err) {
      console.error(
        "Admin login error:",
        err
      );

      setError(
        err.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071426] px-4 py-10 text-white">

      {/* BACKGROUND */}

      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md">

        {/* BACK TO HOME */}

        <Link
          to="/"
          className="mb-7 inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        {/* HEADER */}

        <div className="mb-8 text-center">

          {/* LOGO */}

          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl">

            <img
              src="/logo.png"
              alt="A&A Online Services"
              className="h-full w-full object-contain"
            />

          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">

            <ShieldCheck
              size={14}
            />

            Secure Admin Portal

          </div>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            A&A Admin
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">
            Sign in to securely manage
            orders, payments and
            enquiries.
          </p>

        </div>

        {/* LOGIN CARD */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

          {/* ERROR */}

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
            >

              <XCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span className="leading-5">
                {error}
              </span>

            </div>
          )}

          {/* FORM */}

          <form
            onSubmit={login}
            className="space-y-5"
            noValidate
          >

            {/* EMAIL */}

            <div>

              <label
                htmlFor="admin-email"
                className="mb-2 block text-sm font-medium text-white/50"
              >
                Admin email
              </label>

              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="admin@example.com"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                maxLength={150}
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-medium text-white/50"
              >
                Password
              </label>

              <div className="relative">

                <LockKeyhole
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  id="admin-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  maxLength={200}
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-12 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/30 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >

                  {showPassword ? (
                    <EyeOff
                      size={17}
                    />
                  ) : (
                    <Eye
                      size={17}
                    />
                  )}

                </button>

              </div>

            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 transition hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {loading ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />

                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight
                    size={18}
                  />
                </>
              )}

            </button>

          </form>

          {/* SECURITY NOTE */}

          <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-5">

            <ShieldCheck
              size={17}
              className="mt-0.5 shrink-0 text-emerald-400/70"
            />

            <p className="text-xs leading-5 text-white/30">
              This area is restricted to
              authorized A&A administrators.
              Your login session is stored
              only for the current browser
              session.
            </p>

          </div>

        </section>

        {/* FOOTER */}

        <div className="mt-6 text-center">

          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} A&A
            Online Services
          </p>

        </div>

      </div>
    </main>
  );
}