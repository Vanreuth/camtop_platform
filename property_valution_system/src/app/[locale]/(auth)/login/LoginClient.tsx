"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  EyeIcon,
  EyeOffIcon,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/lib/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthState } from "@/hooks/auth/AuthBootstrap";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { loginSchema, type LoginInput } from "@/hooks/auth/auth.schemas";
import { GoogleButton } from "@/components/GoogleButton";
import { getApiErrorMessage } from "@/utils/helpers";

function safeInternalRedirect(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Ignore malformed encoding and use raw value.
  }

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//")) return fallback;

  while (/^\/(en|kh|km)(?=\/|$)/.test(decoded)) {
    decoded = decoded.replace(/^\/(en|kh|km)(?=\/|$)/, "");
  }

  if (decoded === "") decoded = "/";

  return decoded;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isReady } = useAuthState();

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { login, isLoggingIn } = useAuth();

  const nextUrl = safeInternalRedirect(
    searchParams.get("redirect") || searchParams.get("next"),
    "/dashboard"
  );

  const registered = searchParams.get("registered") === "true";
  const verified = searchParams.get("verified") === "true";

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated) {
      router.replace(nextUrl === "/login" ? "/dashboard" : nextUrl);
    }
  }, [isAuthenticated, isReady, nextUrl, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
    mode: "onSubmit",
  });

  const onSubmit = async (values: LoginInput) => {
    setSubmitError(null);

    try {
      await login(values);
      toast.success("Signed in successfully");
      router.replace(nextUrl);
    } catch (err) {
      const rawMessage = getApiErrorMessage(err, "Login failed");
      const message = rawMessage.toLowerCase().includes("invalid credentials")
        ? "Invalid username/email or password"
        : rawMessage;

      if (rawMessage.toLowerCase().includes("email not verified") && values.username.includes("@")) {
        sessionStorage.setItem("pending_verify_email", values.username.toLowerCase());
      }

      setSubmitError(message);
      toast.error(message);
    }
  };

  const onInvalid = () => {
    const msg =
      form.formState.errors.username?.message ||
      form.formState.errors.password?.message ||
      "Invalid input";
    const text = String(msg);
    setSubmitError(text);
    toast.error(text);
  };

  return (
    <div className="relative isolate flex min-h-dvh w-full items-start justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 lg:items-center lg:p-8">
      <div className="absolute inset-0 z-0">
        <Image
          src="/Property-Valuation.webp"
          alt="Background"
          fill
          className="object-cover"
          priority
          style={{ objectFit: "cover" }}
        />
        <div className="absolute inset-0 bg-slate-950/35" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,.20),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,.18),transparent_32%)]">
      </div>

      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-10 top-10 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="absolute -right-8 bottom-10 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
      </div>

      <Card className="my-2 w-full max-w-xl max-h-[calc(100dvh-1rem)] animate-in zoom-in-95 overflow-y-auto rounded-3xl border-white/30 bg-white/90 shadow-[0_24px_80px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl duration-500 sm:max-h-[calc(100dvh-2rem)]">
        <CardContent className="px-5 py-6 sm:px-9 sm:py-8 [@media(max-height:850px)]:py-5">
          <div className="mx-auto w-full max-w-[400px] space-y-5 sm:space-y-6">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure Sign In
            </div>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Image src="/camtop_logo.svg" alt="Camtop Logo" width={28} height={28} priority />
            </div>

            <div className="space-y-1.5 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Welcome back</h1>
              <p className="text-sm text-slate-600 sm:text-base">Sign in to continue using Camtop Property System</p>
            </div>

            {(registered || verified) && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{verified ? "Email verified" : "Account created"}</AlertTitle>
                <AlertDescription>
                  {verified
                    ? "Your email is verified. You can sign in now."
                    : "Your account is ready. Please sign in with your credentials."}
                </AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>
                  <p>{submitError}</p>
                  {submitError.toLowerCase().includes("not verified") && (
                    <Link href="/verify-email" className="font-medium underline">
                      Go to verify-email page
                    </Link>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4.5" noValidate>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Please enter your username"
                            disabled={isLoggingIn}
                            autoComplete="username"
                            autoFocus
                            className="h-12 rounded-xl border-slate-200 bg-white/80 pl-10 text-base shadow-sm placeholder:text-slate-400 focus-visible:ring-primary/50"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-semibold text-slate-700">Password</FormLabel>
                        <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                          Forgot password?
                        </Link>
                      </div>

                      <FormControl>
                        <div className="relative flex items-center">
                          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Please enter your password"
                            disabled={isLoggingIn}
                            className="h-12 rounded-xl border-slate-200 bg-white/80 pl-10 pr-10 text-base shadow-sm placeholder:text-slate-400 focus-visible:ring-primary/50"
                            autoComplete="current-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/25 transition hover:brightness-105"
                  disabled={isLoggingIn}
                  size="lg"
                >
                  {isLoggingIn ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Signing in...</span>
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className=" px-2 text-muted-foreground">Or continue with Google</span>
              </div>
            </div>

            <GoogleButton />

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
