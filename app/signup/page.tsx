"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Loader } from "@/components/ui/Loader";
import { redirectIfAuthed, signUp } from "@/lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

  useEffect(() => {
    redirectIfAuthed();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setMessageType("error");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      setMessageType("error");
      return;
    }

    setPending(true);
    const result = await signUp(name.trim(), email.trim(), password);
    setPending(false);

    if (!result.ok) {
      setMessage(result.message || "Unable to create your account.");
      setMessageType("error");
      return;
    }

    setMessage("Account created. Redirecting...");
    setMessageType("success");
    window.setTimeout(() => router.push("/dashboard"), 350);
  };

  return (
    <AuthFormShell
      eyebrow="Get started"
      title="Create your account"
      subtitle="Set up an organizer account to start creating and managing events."
      footer={
        <>
          Already have an account? <Link href="/signin">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>
        <p className="hint">Use at least 8 characters.</p>

        <FeedbackNotice message={message} icon={messageType || "info"} />

        <button type="submit" className="btn btn-accent" style={{ width: "100%", marginTop: 20 }} disabled={pending}>
          {pending ? (
            <span className="inline-loader" style={{ color: "inherit" }}>
              <Loader size={15} /> Creating account...
            </span>
          ) : (
            "Create account"
          )}
        </button>
      </form>
    </AuthFormShell>
  );
}
