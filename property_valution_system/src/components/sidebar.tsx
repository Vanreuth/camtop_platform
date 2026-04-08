"use client";

import { useMemo, useState } from "react";
import { Link, usePathname, useRouter } from "@/lib/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth/useAuth";
import { useTranslations } from "next-intl";
import { useUnreadCount } from "@/hooks/notification/useNotification";


import {
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  UserCog,
  BadgeDollarSignIcon,
  Building2,
  School,
  MapPinned,
  Bell,
  WalletCards,
  ChevronsUpDown,
  BookAlert,
  MapPinHouse,
  CircleDollarSign,
  FileSpreadsheet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Badge } from "@/components/ui/badge";

type SidebarBadgeVariant = "secondary" | "destructive";

type SidebarChildItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
};

type SidebarLeafItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | null;
  badgeVariant?: SidebarBadgeVariant;
};

type SidebarParentItem = {
  key: string;
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: SidebarChildItem[];
};

type SidebarItem = SidebarLeafItem | SidebarParentItem;

type SidebarGroupConfig = {
  title: string;
  items: SidebarItem[];
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const { setOpenMobile, isMobile } = useSidebar();
  
  const { user, logout, hasHierarchyLevel, hasAnyPermission, isSuperAdmin } = useAuth();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const unreadCountQuery = useUnreadCount();
  const unreadCount = typeof unreadCountQuery.data === "number" ? unreadCountQuery.data : 0;
  const isAdmin = isSuperAdmin();
  const canViewDashboardAndAnalytics = hasHierarchyLevel(3);
  const canViewUserManagement = hasHierarchyLevel(2);
  const canViewSecurity = hasHierarchyLevel(2);
  const canViewValuationAndMap = hasHierarchyLevel(3);
  const canAccessReports =
    hasHierarchyLevel(2) ||
    hasAnyPermission(["property:read", "dashboard:read", "user:read", "user:manage"]);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const sidebarInteractiveClass =
    "hover:bg-primary/15 hover:text-primary active:bg-primary/20 active:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[state=open]:bg-primary/15 data-[state=open]:text-primary";

  const isActiveLink = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Improved Link Handler: Uses context instead of prop drilling
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setUserMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      setUserMenuOpen(false);
      await logout();
      toast.success("Logged out successfully");
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  const sidebarGroups = useMemo<SidebarGroupConfig[]>(
    () => {
      const groups: SidebarGroupConfig[] = [
        {
          title: tCommon("general"),
          items: [
            ...(canViewDashboardAndAnalytics
              ? [
                  {
                    title: tNav("dashboard"),
                    href: "/dashboard",
                    icon: LayoutDashboard,
                  },
                  {
                    title: tNav("analytics"),
                    href: "/dashboard/analytics",
                    icon: BarChart3,
                  },
                ]
              : []),
            ...(canAccessReports
              ? [
                  {
                    title: tNav("reports"),
                    href: "/dashboard/reports",
                    icon: FileSpreadsheet,
                  },
                ]
              : []),
            { title: tNav("settings"), href: "/dashboard/settings", icon: Settings },
          ],
        },
      ];

      if (canViewUserManagement) {
        groups.push({
          title: tCommon("usermanagement"),
          items: [
            { title: tNav("users"), href: "/dashboard/users", icon: Users },
            ...(isAdmin
              ? [
                  {
                    title: tNav("rolePermission"),
                    href: "/dashboard/role_permission",
                    icon: UserCog,
                  },
                ]
              : []),
          ],
        });
      }

      groups.push(
        {
          title: tCommon("propertymanagement"),
          items: [
            {
              key: "propertyMenu",
              title: tNav("properties"),
              icon: School,
              defaultOpen: true,
              children: [
                { title: tNav("propertyData"), href: "/dashboard/property", icon: Building2 },
                ...(canViewValuationAndMap
                  ? [
                      {
                        title: tNav("propertyValuation"),
                        href: "/dashboard/propertyValuation",
                        icon: CircleDollarSign,
                      },
                      {
                        title: tNav("propertyIndicativeValuation"),
                        href: "/dashboard/propertyIndicativeValuation",
                        icon: BookAlert,
                      },
                    ]
                  : []),
              ],
            },
            ...(canViewValuationAndMap
              ? [{ title: tNav("propertyMap"), href: "/dashboard/propertyMap", icon: MapPinHouse }]
              : []),
          ],
        },
        {
          title: "Others",
          items: [
            {
              title: tNav("notifications"),
              href: "/dashboard/notifications",
              icon: Bell,
              badge: unreadCount
                ? unreadCount > 9
                  ? "9+"
                  : unreadCount.toString()
                : null,
              badgeVariant: "secondary" as const,
            },
            ...(canViewSecurity
              ? [
                  {
                    title: tNav("security"),
                    href: "/dashboard/security",
                    icon: Shield,
                    badge: "!",
                    badgeVariant: "destructive" as const,
                  },
                ]
              : []),
            { title: tNav("help"), href: "/dashboard/help", icon: HelpCircle },
          ],
        }
      );

      return groups;
    },
    [
      tCommon,
      tNav,
      unreadCount,
      canViewDashboardAndAnalytics,
      canViewUserManagement,
      canViewSecurity,
      canViewValuationAndMap,
      canAccessReports,
      isAdmin,
    ]
  );

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="border-r border-sidebar-border/70 bg-sidebar/95 supports-[backdrop-filter]:bg-sidebar/90"
    >
      <SidebarHeader className="border-b border-sidebar-border/60 px-1 py-2">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className={`h-12 transition-all duration-200 ${sidebarInteractiveClass}`}
            >
              <Link href="/dashboard" onClick={handleLinkClick}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                   {/* Optimized Logo Container */}
                  <Image
                    src="/camtop_logo.svg"
                    alt="Camtop Logo"
                    width={32}
                    height={32}
                    className="size-6" 
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">Camtop Property System</span>
                  <span className="truncate text-xs text-muted-foreground">Valuation , Advisory & Agency</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-1 pb-2 pt-2">
        {sidebarGroups.map((group) => (
          <SidebarGroup key={group.title}>
            {/* Hide Label when collapsed to save space/clean UI */}
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                {group.title}
            </SidebarGroupLabel>
            
            <SidebarGroupContent className="mt-1">
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const itemKey = "key" in item ? item.key : item.href;
                  const isChildActive =
                    "children" in item
                      ? item.children.some((child) => isActiveLink(child.href))
                      : false;
                  const isActive =
                    "children" in item ? isChildActive : isActiveLink(item.href);
                  const Icon = item.icon;

                  if ("children" in item) {
                    if (item.children.length === 0) {
                      return null;
                    }

                    return (
                      <Collapsible
                        key={itemKey}
                        defaultOpen={item.defaultOpen}
                        asChild
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={item.title}
                              isActive={isActive}
                              className={`h-9 ${sidebarInteractiveClass}`}
                            >
                              {Icon && <Icon />}
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="mt-1 gap-1.5 px-2 pb-2">
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    size="md"
                                    isActive={isActiveLink(child.href)}
                                    onClick={handleLinkClick}
                                    className={sidebarInteractiveClass}
                                  >
                                    <Link href={child.href}>
                                      {child.icon && <child.icon className="size-4" />}
                                      <span>{child.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        onClick={handleLinkClick}
                        className={`h-9 ${sidebarInteractiveClass}`}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      
                      {/* Badge Logic moved outside button for cleaner layout */}
                      {item.badge && (
                        <SidebarMenuAction className="pointer-events-none show-on-hover">
                           <Badge variant={item.badgeVariant || "secondary"} className="h-5 px-1.5 text-[10px]">
                            {item.badge}
                           </Badge>
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className={sidebarInteractiveClass}
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.profilePicture || undefined} alt={user?.username} />
                    <AvatarFallback className="rounded-lg">
                      {user?.username?.slice(0, 2)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Hide user details instantly when sidebar collapses */}
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{user?.username}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                  
                  {/* Use Chevrons for better affordance, hide when collapsed */}
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              
              {/* Force dropdown to the right if sidebar is collapsed, otherwise top/bottom */}
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"} 
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                   <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage 
                        src={user?.profilePicture || undefined} 
                        alt={user?.username} 
                      />
                      <AvatarFallback className="rounded-lg">
                         {user?.username?.slice(0, 2)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.username}</span>
                      <span className="truncate text-xs">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setUserMenuOpen(false); router.push("/dashboard/settings"); }}>
                  <Settings className="mr-2 h-4 w-4" />
                  {tNav("settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {tCommon("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
