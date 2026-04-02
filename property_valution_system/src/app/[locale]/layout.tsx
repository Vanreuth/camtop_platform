import type { Metadata } from "next";
import { Inter,Hanuman } from "next/font/google";
import "../globals.css";
import { getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/providers/QueryProviders";
import { notFound } from "next/navigation";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/hooks/auth/AuthBootstrap";
// english font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
// khmer font
const hanuman = Hanuman({
  subsets: ["khmer"],
  weight: ["300", "400", "700"],
  variable: "--font-hanuman",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    template: "%s | CAMTOP Property System",
    default: "CAMTOP Property System",
  },
  description:
    "CAMTOP Property System is a professional platform for property valuation, property mapping, and real estate data management in Cambodia.",
  applicationName: "CAMTOP Property System",
  keywords: [
    "CAMTOP Property System",
    "property valuation",
    "property map",
    "real estate management",
    "Cambodia property",
  ],
  authors: [{ name: "CAMTOP Property System" }],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/camtop_logo.svg",
    apple: "/apple-touch-icon.png", // Recommended to add this if available
  },
  openGraph: {
    title: "CAMTOP Property System",
    description:
      "Professional property valuation, property mapping, and real estate data management platform for Cambodia.",
    siteName: "CAMTOP Property System",
    images: ["/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CAMTOP Property System",
    description:
      "Professional property valuation, property mapping, and real estate data management platform for Cambodia.",
    images: ["/og-image.png"],
  },
};

const locales = ["en", "kh"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Validate that the incoming locale parameter is valid
  if (!locales.includes(locale)) {
    notFound();
  }

  // Providing all messages to the client side
  const messages = await getMessages({ locale });

  return (
     <html lang={locale} suppressHydrationWarning>
      <body 
      className={`${inter.variable} ${hanuman.variable} antialiased bg-background font-sans`}
       suppressHydrationWarning={true}
      >
      {googleClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>
          <Providers messages={messages} locale={locale}>
            <AuthProvider>{children}</AuthProvider>
            <Toaster richColors position="top-right" closeButton />
          </Providers>
        </GoogleOAuthProvider>
      ) : (
        <Providers messages={messages} locale={locale}>
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors position="top-right" closeButton />
        </Providers>
      )}
      </body>
    </html>
  );
}
