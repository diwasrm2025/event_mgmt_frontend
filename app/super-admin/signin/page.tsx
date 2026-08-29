"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Loader } from "@/components/ui/Loader";
import { signIn, getSession } from "@/lib/auth";

export default function SuperAdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@pulseframe.app");
  const [password, setPassword] = useState("SuperAdminPass2026!");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/super-admin");
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const result = await signIn(email.trim(), password);
    setPending(false);

    if (!result.ok) {
      setMessage(result.message || "Unable to sign in as Super Admin.");
      setMessageType("error");
      return;
    }

    setMessage("Super Admin authenticated! Redirecting...");
    setMessageType("success");
    window.setTimeout(() => router.push("/super-admin"), 350);
  };

  return (
    <AuthFormShell
      eyebrow="Master Administration Portal"
      title="Super Admin Sign In"
      subtitle="Sign in with your Super Admin credentials configured in .env"
      footer={<Link href="/signin">Return to regular organizer login</Link>}
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Super Admin Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Super Admin Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255, 255, 255, 0.04)", borderRadius: 8, fontSize: "0.85rem", color: "var(--muted)" }}>
          <strong style={{ color: "var(--text)" }}>Default .env Credentials:</strong>
          <br />
          Email: <code style={{ color: "#a5f3fc" }}>superadmin@pulseframe.app</code>
          <br />
          Password: <code style={{ color: "#a5f3fc" }}>SuperAdminPass2026!</code>
        </div>

        {message ? <div className={`form-msg show ${messageType}`} style={{ marginTop: 14 }}>{message}</div> : null}

        <button type="submit" className="btn btn-accent" style={{ width: "100%", marginTop: 20 }} disabled={pending}>
          {pending ? (
            <span className="inline-loader" style={{ color: "inherit" }}>
              <Loader size={15} /> Authenticating Super Admin...
            </span>
          ) : (
            "Access Super Admin Portal"
          )}
        </button>
      </form>
    </AuthFormShell>
  );
}
