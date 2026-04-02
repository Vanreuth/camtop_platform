import { Suspense } from "react";
import VerifyEmailCallbackClient from "./VerifyEmailCallbackClient";
import { Loader2 } from "lucide-react";
import Image from "next/image";

function VerifyEmailCallbackFallback() {
  return (
    <div className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/Property-Valuation.webp"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-slate-950/60" />
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-lg">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p>Verifying your email...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailCallbackPage() {
  return (
    <Suspense fallback={<VerifyEmailCallbackFallback />}>
      <VerifyEmailCallbackClient />
    </Suspense>
  );
}
