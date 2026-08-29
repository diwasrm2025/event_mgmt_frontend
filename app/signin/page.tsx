"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Loader } from "@/components/ui/Loader";
import { redirectIfAuthed, signIn } from "@/lib/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

  useEffect(() => {
    redirectIfAuthed();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const result = await signIn(email.trim(), password);
    setPending(false);

    if (!result.ok) {
      setMessage(result.message || "Unable to sign in.");
      setMessageType("error");
      return;
    }

    setMessage("Signed in. Redirecting...");
    setMessageType("success");
    window.setTimeout(() => router.push("/dashboard"), 350);
  };

  return (
    <AuthFormShell
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Sign in to get back to the organizer dashboard."
     
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {message ? <div className={`form-msg show ${messageType}`} style={{ marginTop: 14 }}>{message}</div> : null}

        <button type="submit" className="btn btn-accent" style={{ width: "100%", marginTop: 20 }} disabled={pending}>
          {pending ? (
            <span className="inline-loader" style={{ color: "inherit" }}>
              <Loader size={15} /> Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthFormShell>
  );
}
