"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "@/store";
import { FontProvider } from "./FontProvider";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";

interface ProvidersProps {
  children: React.ReactNode;
  messages: any;
  locale: string;
}

type ReactQueryDevtoolsProps = {
  initialIsOpen?: boolean;
};

const ReactQueryDevtools = (
  process.env.NODE_ENV === "development"
    ? dynamic<ReactQueryDevtoolsProps>(
        () =>
          import("@tanstack/react-query-devtools").then(
            (mod) => mod.ReactQueryDevtools
          ),
        { ssr: false }
      )
    : (() => null)
) as ComponentType<ReactQueryDevtoolsProps>;

export function Providers({ children, messages, locale }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Phnom_Penh"
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <FontProvider />
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </Provider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
