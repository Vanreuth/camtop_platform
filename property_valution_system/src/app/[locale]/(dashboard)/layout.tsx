"use client";

import { AppSidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthState } from "@/hooks/auth/AuthBootstrap";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isReady } = useAuthState();
  if (!isReady) {
    return <div className="p-6">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "15.25rem",
          "--sidebar-width-icon": "3.25rem",
          "--sidebar-width-mobile": "min(88vw, 22rem)",
        } as React.CSSProperties
      }
    >
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <AppSidebar />
        <MainLayout>{children}</MainLayout>
      </div>
    </SidebarProvider>
  );
}
