"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserRound } from "lucide-react";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginId, password }) });
      if (!response.ok) { setError("The login details were not recognised."); setIsSubmitting(false); return; }
      window.location.assign("/");
    } catch { setError("Unable to connect securely. Please try again."); setIsSubmitting(false); }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f3ec] px-5 py-8 text-[#172033] sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#e5c365]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 h-[30rem] w-[30rem] rounded-full bg-[#9bb7d4]/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white/35 shadow-[20px_20px_60px_rgba(80,70,55,0.14),-12px_-12px_40px_rgba(255,255,255,0.8)] backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden min-h-[650px] flex-col justify-between overflow-hidden bg-[#172033] p-10 text-white lg:flex xl:p-14">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#e5c365]/25 blur-2xl" />
            <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[#6d89ad]/30 blur-3xl" />
            <div className="relative">
              <div className="mb-16 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5c365] text-[#172033] shadow-[inset_3px_3px_7px_rgba(255,255,255,0.35),inset_-4px_-4px_8px_rgba(80,60,0,0.2)]"><Sparkles className="h-5 w-5" /></div><div><p className="text-sm font-semibold tracking-[0.2em] text-[#e5c365]">UP ELECTIONS</p><p className="text-xs text-white/55">Political intelligence workspace</p></div></div>
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">Private access</p>
              <h1 className="max-w-lg font-serif text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">A clearer view of every seat.</h1>
              <p className="mt-6 max-w-md text-base leading-7 text-white/65">Explore constituency intelligence, historical results, party movement, and election signals in one considered workspace.</p>
            </div>
            <div className="relative grid grid-cols-2 gap-3 text-sm text-white/70"><div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl"><ShieldCheck className="mb-5 h-5 w-5 text-[#e5c365]" /><p className="font-medium text-white">Protected workspace</p><p className="mt-1 text-xs text-white/45">Invitation-only access</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl"><Sparkles className="mb-5 h-5 w-5 text-[#e5c365]" /><p className="font-medium text-white">Election intelligence</p><p className="mt-1 text-xs text-white/45">Built for focused analysis</p></div></div>
          </section>
          <section className="flex min-h-[650px] items-center justify-center p-6 sm:p-10 xl:p-14"><div className="w-full max-w-md">
            <div className="mb-10 lg:hidden"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#172033] text-[#e5c365] shadow-[8px_8px_18px_rgba(23,32,51,0.16)]"><Sparkles className="h-5 w-5" /></div><p className="text-xs font-bold tracking-[0.24em] text-[#a38325]">UP ELECTIONS</p></div>
            <div className="mb-8"><p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#a38325]">Welcome back</p><h2 className="font-serif text-4xl font-bold tracking-tight text-[#172033]">Enter the workspace.</h2><p className="mt-3 text-sm leading-6 text-[#5f6878]">Sign in to continue to your election intelligence dashboard.</p></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#687184]">Login ID</span><span className="relative block"><UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b94a3]" /><input required autoComplete="username" value={loginId} onChange={(event) => setLoginId(event.target.value)} className="h-14 w-full rounded-2xl border border-white/90 bg-white/60 pl-11 pr-4 text-sm text-[#172033] shadow-[inset_3px_3px_8px_rgba(80,70,55,0.08),6px_6px_15px_rgba(80,70,55,0.06)] outline-none transition focus:border-[#d4af37] focus:bg-white/85 focus:ring-4 focus:ring-[#d4af37]/15" placeholder="Enter your login ID" /></span></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#687184]">Password</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b94a3]" /><input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-14 w-full rounded-2xl border border-white/90 bg-white/60 pl-11 pr-12 text-sm text-[#172033] shadow-[inset_3px_3px_8px_rgba(80,70,55,0.08),6px_6px_15px_rgba(80,70,55,0.06)] outline-none transition focus:border-[#d4af37] focus:bg-white/85 focus:ring-4 focus:ring-[#d4af37]/15" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b94a3] transition hover:text-[#172033]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
              <button disabled={isSubmitting} className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#172033] text-sm font-semibold text-white shadow-[8px_8px_18px_rgba(23,32,51,0.2),inset_2px_2px_4px_rgba(255,255,255,0.1)] transition hover:-translate-y-0.5 hover:bg-[#202c45] disabled:cursor-wait disabled:opacity-70">{isSubmitting ? "Verifying access..." : "Enter dashboard"}{!isSubmitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}</button>
            </form>
            <p className="mt-8 text-center text-xs leading-5 text-[#8b94a3]">This workspace is restricted to authorised users.</p>
          </div></section>
        </div>
      </div>
    </main>
  );
}
