"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

type Props = {
  enabled: boolean;
  onFromCreate: () => void;
};

export default function SearchParamsEffect({ enabled, onFromCreate }: Props) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;

    const fromCreate = searchParams?.get("from") === "create";
    if (!fromCreate) return;

    const timer = setTimeout(() => {
      onFromCreate();
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, onFromCreate, searchParams]);

  return null;
}
