import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    "admin@aa-online-services.com"
  );
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/admin/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.message || "Login failed."
        );
      }

      sessionStorage.setItem(
        "aa_admin",
        JSON.stringify(data.admin)
      );
      sessionStorage.setItem(
        "aa_admin_token",
        data.token
      );
      navigate("/admin");
    } catch (err) {
      setError(
        err.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071426] px-4 text-white">

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
            <ShieldCheck
              size={30}
              className="text-white/70"
            />
          </div>

          <h1 className="mt-6 text-3xl font-black">
            A&A Admin
          </h1>

          <p className="mt-2 text-sm text-white/40">
            Sign in to manage orders and enquiries.
          </p>

        </div>


        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl md:p-8">

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">

              <XCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span>{error}</span>

            </div>
          )}

          <form
            onSubmit={login}
            className="space-y-5"
          >

            <div>

              <label className="mb-2 block text-sm text-white/45">
                Admin email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="admin@example.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white outline-none placeholder:text-white/25 focus:border-white/30"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm text-white/45">
                Password
              </label>

              <div className="relative">

                <LockKeyhole
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-4 text-white outline-none placeholder:text-white/25 focus:border-white/30"
                />

              </div>

            </div>


            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <ArrowRight size={18} />
                </>
              )}

            </button>

          </form>

        </section>

      </div>

    </main>
  );
}