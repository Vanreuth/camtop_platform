"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GoogleButtonProps = {
  className?: string;
};

const GoogleButtonClient = dynamic<GoogleButtonProps>(
  () => import("./GoogleButtonClient").then((mod) => mod.GoogleButtonClient),
  {
    ssr: false,
    loading: () => (
      <Button
        type="button"
        className="mx-auto block w-full max-w-[400px]"
        variant="outline"
        disabled
      >
        Loading Google sign-in...
      </Button>
    ),
  }
);

export function GoogleButton({ className }: GoogleButtonProps) {
  return <GoogleButtonClient className={cn("w-full", className)} />;
}
