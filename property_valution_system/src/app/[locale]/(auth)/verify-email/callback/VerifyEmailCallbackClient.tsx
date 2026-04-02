"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import { authApi } from "@/hooks/auth/auth.api";
import { getApiErrorMessage } from "@/utils/helpers";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function VerifyEmailCallbackClient() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get("token");

    if (!token) {
      toast.error("Missing verification token");
      router.push("/verify-email");
      return;
    }

    (async () => {
      try {
        await authApi.verifyEmail(token);
        toast.success("Email verified successfully. Please login.");
        sessionStorage.removeItem("pending_verify_email");
        router.push("/login");
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, "Verification failed"));
        router.push("/verify-email");
      }
    })();
  }, [params, router]);

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
