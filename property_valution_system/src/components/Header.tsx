import { usePathname } from "@/lib/navigation";
import { generateBreadcrumbs } from "@/lib/breadcrumb-uttils";
import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import React from "react";
import { Topbar } from "./topbar";


export const Header = ({ sidebarWidth }: { sidebarWidth: string }) => {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <header
      className="fixed right-0 top-0 z-20 flex h-14 items-center justify-between border-b bg-background/85 px-3 backdrop-blur-xl transition-all duration-300 sm:px-4 md:h-16 md:px-6"
      style={{ left: sidebarWidth }}
    >
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <SidebarTrigger className="-ml-1 h-8 w-8 hover:bg-muted/50 transition-colors flex-shrink-0" />
        <Separator
          orientation="vertical"
          className="h-4 md:h-6 bg-border/50 flex-shrink-0"
        />
        <Breadcrumb className="hidden sm:flex min-w-0">
          <BreadcrumbList className="flex-wrap">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                <BreadcrumbItem>
                  {crumb.isCurrentPage ? (
                    <BreadcrumbPage className="text-foreground font-medium truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors truncate"
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="text-muted-foreground/50" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {/* Mobile breadcrumb - show only current page */}
        <div className="sm:hidden truncate">
          <span className="text-sm font-medium text-foreground">
            {breadcrumbs[breadcrumbs.length - 1]?.label}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-shrink-0 pl-2">
        <Topbar />
      </div>
    </header>
  );
};
