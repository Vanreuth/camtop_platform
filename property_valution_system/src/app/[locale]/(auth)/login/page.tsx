import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
          <div className="h-64 w-full max-w-lg animate-pulse rounded-2xl border bg-white/80 shadow-sm" />
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
