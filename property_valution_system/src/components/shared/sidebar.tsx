"use client";
import { Link, usePathname } from "@/lib/navigation";
import {
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
  FolderKanban,
  FileText,
  Calendar,
  Database,
  MessageSquare,
  Shield,
  HelpCircle,
  LogIn,
  AlertCircle,
  LogOut,
  ChevronLeft,
} from "lucide-react";
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
  SidebarRail,
} from "@/components/ui/sidebar";
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

const sidebarGroups = [
  {
    title: "General",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        badge: null,
      },
      {
        title: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        badge: "New",
        badgeVariant: "destructive" as const,
      },
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        badge: null,
      },
    ],
  },
  {
    title: "Pages",
    items: [
      {
        title: "Users",
        href: "/dashboard/users",
        icon: Users,
        badge: "12",
        badgeVariant: "secondary" as const,
      },
      {
        title: "Projects",
        href: "/dashboard/projects",
        icon: FolderKanban,
        badge: null,
      },
      {
        title: "Documents",
        href: "/dashboard/documents",
        icon: FileText,
        badge: null,
      },
      {
        title: "Calendar",
        href: "/dashboard/calendar",
        icon: Calendar,
        badge: "3",
        badgeVariant: "secondary" as const,
      },
      {
        title: "Auth Pages",
        href: "/dashboard/auth",
        icon: LogIn,
        badge: null,
      },
      {
        title: "Error Pages",
        href: "/dashboard/errors",
        icon: AlertCircle,
        badge: null,
      },
    ],
  },
  {
    title: "Others",
    items: [
      {
        title: "Messages",
        href: "/dashboard/messages",
        icon: MessageSquare,
        badge: "5",
        badgeVariant: "secondary" as const,
      },
      {
        title: "Database",
        href: "/dashboard/database",
        icon: Database,
        badge: null,
      },
      {
        title: "Security",
        href: "/dashboard/security",
        icon: Shield,
        badge: "!",
        badgeVariant: "destructive" as const,
      },
      {
        title: "Help",
        href: "/dashboard/help",
        icon: HelpCircle,
        badge: null,
      },
    ],
  },
];

interface SidebarProps {
  onMobileClose?: () => void;
}

export function AppSidebar({ onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Dashboard</span>
                  <span className="truncate text-xs">Admin Panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sidebarGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent className="mt-1 space-y-0.5">
              <SidebarMenu className="space-y-2">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        onClick={handleLinkClick}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                          {item.badge && (
                            <Badge
                              variant={item.badgeVariant || "secondary"}
                              className="ml-auto"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuAction>
                          <Badge
                            variant={item.badgeVariant || "secondary"}
                            className="h-5 px-1.5 text-xs"
                          >
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src="/avatar.png" alt="User" />
                    <AvatarFallback className="rounded-lg">JD</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">John Doe</span>
                    <span className="truncate text-xs">
                      john.doe@example.com
                    </span>
                  </div>
                  <ChevronLeft className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src="/avatar.png" alt="User" />
                      <AvatarFallback className="rounded-lg">JD</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">John Doe</span>
                      <span className="truncate text-xs">
                        john.doe@example.com
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <div className="flex size-2 rounded-full bg-green-500 mr-2" />
                  Online
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex size-2 rounded-full bg-yellow-500 mr-2" />
                  Away
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex size-2 rounded-full bg-gray-500 mr-2" />
                  Offline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
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
