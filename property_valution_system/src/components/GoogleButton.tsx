"use client";

import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleButtonProps = {
  className?: string;
};

export function GoogleButton({ className }: GoogleButtonProps) {
  const { loginWithGoogle } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number>(0);
  const renderWidth = buttonWidth > 0 ? Math.min(buttonWidth, 400) : undefined;

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const updateWidth = () => {
      const width = Math.floor(node.getBoundingClientRect().width);
      setButtonWidth(width > 0 ? width : 0);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <Button
        type="button"
        className={cn("mx-auto block w-full max-w-[400px]", className)}
        variant="outline"
        disabled
      >
        Google sign-in is not configured
      </Button>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("mx-auto flex w-full justify-center", className)}
    >
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          try {
            const idToken = credentialResponse.credential;
            if (!idToken) {
              toast.error("Google sign-in did not return a token");
              return;
            }

            await loginWithGoogle(idToken);
          } catch (e: unknown) {
            const error = e as { response?: { data?: { message?: string } }; message?: string };
            toast.error(
              error?.response?.data?.message || error?.message || "Google authentication failed"
            );
          }
        }}
        onError={() => toast.error("Google sign-in failed")}
        useOneTap={false}      
        width={renderWidth}
        size="large"
        text="continue_with"
        theme="outline"
        containerProps={{
          className: "mx-auto",
          style: { width: renderWidth ? `${renderWidth}px` : undefined, marginLeft: "auto", marginRight: "auto" },
        }}
      />
    </div>
  );
}
