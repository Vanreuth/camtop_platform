"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck, Loader2 } from "lucide-react";
import { Link } from "@/lib/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { authApi } from "@/hooks/auth/auth.api";
import Image from "next/image";

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    const email = sessionStorage.getItem("pending_verify_email") || "";
    if (!email) {
      toast.error("No email found. Please register again.");
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.resendVerification(email);
      toast.success(res.message || "Verification email resent!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Resend failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative isolate flex min-h-dvh w-full items-start justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:items-center">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/Property-Valuation.webp"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-slate-950/55" />
      </div>

      <Card className="my-2 w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl border-white/25 bg-white/95 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="mt-3 text-2xl">Verify your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email. Click the link to activate your account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            Didn&apos;t receive it? Check spam or resend below.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button onClick={handleResend} className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
          <Button variant="link" asChild>
            <Link href="/login">Back to login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
