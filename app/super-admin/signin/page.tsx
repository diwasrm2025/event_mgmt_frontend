"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Loader } from "@/components/ui/Loader";
import { signIn, getSession } from "@/lib/auth";

export default function SuperAdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    if (!getSession()?.permissions.includes("events:manage_all")) {
      setMessage("This account does not have Super Admin access. Please use the organizer sign-in page.");
      setMessageType("error"); return;
    }
    setMessage("Super Admin authenticated! Redirecting...");
    setMessageType("success");
    window.setTimeout(() => router.push("/super-admin"), 350);
  };

  return (
    <AuthFormShell
      eyebrow="Master Administration Portal"
      title="Super Admin Sign In"
      subtitle="Sign in with your administrator account."
      footer={<Link href="/signin">Return to regular organizer login</Link>}
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Super Admin Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your administrator email"
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
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>



        <FeedbackNotice message={message} icon={messageType || "info"} />

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
