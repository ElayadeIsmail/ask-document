"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { login, signup } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldCaption, Label } from "@/components/ui/label";

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result =
      mode === "signup"
        ? await signup(email.trim(), username.trim(), password)
        : await login(email.trim(), password);
    if ("error" in result) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-line bg-[#fffdf8] px-6 py-8 shadow-[0_16px_40px_rgba(28,24,20,0.06)] sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">PFE · RAG</p>
        <h1 className="mt-2 font-serif text-4xl italic">AskDoc</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {mode === "login"
            ? "Log in to your library, shared PDFs, and chats."
            : "Create an account to upload PDFs and share them."}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <Label>
            <FieldCaption>Email</FieldCaption>
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1"
            />
          </Label>
          {mode === "signup" && (
            <Label>
              <FieldCaption>Username</FieldCaption>
              <Input
                required
                minLength={2}
                maxLength={32}
                pattern="[A-Za-z0-9_.]+"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1"
              />
            </Label>
          )}
          <Label>
            <FieldCaption>Password</FieldCaption>
            <Input
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1"
            />
          </Label>
          {error && <p className="text-sm leading-6 text-clay">{error}</p>}
          <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full">
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="mt-4"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </Button>
      </section>
    </main>
  );
}
