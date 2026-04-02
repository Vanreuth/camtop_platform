"use client";

import { Users, RefreshCw, Filter, X, Calendar, Hash, FileType, Eye, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreateNotificationModal } from "./createNotifacation";
import { useUsers } from "@/hooks/user/useUser";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Common notification types - adjust these based on your application
const NOTIFICATION_TYPES = [
  "PROPERTY_SUBMITTED",
  "PROPERTY_APPROVED",
  "PROPERTY_REJECTED",
  "VALUATION_SUBMITTED",
  "VALUATION_APPROVED",
  "VALUATION_REJECTED",
  "INDICATIVE_VALUATION_SUBMITTED",
  "INDICATIVE_VALUATION_APPROVED",
  "INDICATIVE_VALUATION_REJECTED",
  "SYSTEM_ANNOUNCEMENT",
] as const;
const ALL_USERS_VALUE = "all";




export function NotificationsAdminToolbar(props: {
  adminUserId: string;
  setAdminUserId: (v: string) => void;
  adminType: string;
  setAdminType: (v: string) => void;
  adminIsRead: "" | "true" | "false";
  setAdminIsRead: (v: "" | "true" | "false") => void;
  adminDateFrom: string;
  setAdminDateFrom: (v: string) => void;
  adminDateTo: string;
  setAdminDateTo: (v: string) => void;

  onRefresh: () => void;
  onSent: () => void;
  onClearUser?: (userId: number) => void;
  onDeleteByType?: (type: string) => void;
}) {
  const {
    adminUserId,
    setAdminUserId,
    adminType,
    setAdminType,
    adminIsRead,
    setAdminIsRead,
    adminDateFrom,
    setAdminDateFrom,
    adminDateTo,
    setAdminDateTo,
    onRefresh,
    onSent,
    onClearUser,
    onDeleteByType,
  } = props;

  // Fetch users for the dropdown
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    isError: isUsersError,
    error: usersError,
  } = useUsers({ page: 1, limit: 50 });
  
  // Search state for user dropdown
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    
    const searchLower = userSearchTerm.toLowerCase();
    return usersData.users.filter((user: any) => {
      const userId = user.id?.toString() || "";
      const userName = user.username?.toLowerCase() || "";
      const userEmail = user.email?.toLowerCase() || "";
      const userFullName = user.name?.toLowerCase() || "";
      
      return (
        userId.includes(searchLower) ||
        userName.includes(searchLower) ||
        userEmail.includes(searchLower) ||
        userFullName.includes(searchLower)
      );
    });
  }, [usersData, userSearchTerm]);

  // Get selected user details for display
  const selectedUser = useMemo(() => {
    if (!adminUserId || !usersData?.users) return null;
    return usersData.users.find((user: any) => user.id?.toString() === adminUserId);
  }, [adminUserId, usersData]);

  // Check if any filters are active
  const hasActiveFilters =
    adminUserId || adminType || adminIsRead || adminDateFrom || adminDateTo;

  const activeFilterCount = [
    adminUserId,
    adminType,
    adminIsRead,
    adminDateFrom,
    adminDateTo,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setAdminUserId("");
    setAdminType("");
    setAdminIsRead("");
    setAdminDateFrom("");
    setAdminDateTo("");
  }; 


  const getInitials = (name?: string) => {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "U";
};

const UserAvatar = ({
  src,
  name,
  size = 24,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) => {
  const initials = getInitials(name ?? undefined);

  return (
    <span
      className="relative inline-flex shrink-0 overflow-hidden rounded-full border bg-muted"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? "User"}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {initials}
        </span>
      )}
    </span>
  );
};

const userLabel = (u: any) => u?.name || u?.username || u?.email || `User ${u?.id ?? ""}`;

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Admin Tools</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage and filter notifications
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={onRefresh}
              className="gap-2 shadow-sm"
              size="default"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <CreateNotificationModal triggerLabel="Create Notification" onSent={onSent} />

            {/* Advanced Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 shadow-sm">
                  <Filter className="h-4 w-4" />
                  Advanced Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Bulk Operations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {adminUserId && onClearUser && (
                  <DropdownMenuItem
                    onClick={() => onClearUser(Number(adminUserId))}
                    className="text-orange-600 focus:text-orange-600"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Clear User Inbox
                  </DropdownMenuItem>
                )}
                
                {adminType && onDeleteByType && (
                  <DropdownMenuItem
                    onClick={() => onDeleteByType(adminType)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All '{adminType}'
                  </DropdownMenuItem>
                )}

                {(!adminUserId && !adminType) && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Apply filters to enable bulk actions
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Filter Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Filters</h3>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-2 text-xs">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 gap-1.5 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>

          {/* Filter Inputs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* User Dropdown Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-userId" className="flex items-center gap-1.5 text-xs font-medium">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                User
              </Label>
              <Select 
                value={adminUserId} 
                onValueChange={(val) => {
                  if (val === ALL_USERS_VALUE) {
                    setAdminUserId("");
                  } else {
                    setAdminUserId(val);
                  }
                }}
              >
                <SelectTrigger id="filter-userId">
                  <SelectValue
                    placeholder={
                      isLoadingUsers
                        ? "Loading users..."
                        : isUsersError
                        ? "Failed to load users"
                        : "Select user"
                    }
                  >
                    {selectedUser ? (
                      <span className="truncate">
                        { selectedUser.profilePicture || selectedUser.username || `User ${selectedUser.id}`}
                      </span>
                    ) : (
                      "All users"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
  <div className="sticky top-0 z-10 border-b bg-background p-2">
    <Input
      placeholder="Search users..."
      value={userSearchTerm}
      onChange={(e) => setUserSearchTerm(e.target.value)}
      className="h-8 text-sm"
      onClick={(e) => e.stopPropagation()}
    />
  </div>

  <SelectItem value={ALL_USERS_VALUE}>All users</SelectItem>

  {isLoadingUsers ? (
    <div className="py-6 text-center text-sm text-muted-foreground">
      Loading users...
    </div>
  ) : isUsersError ? (
    <div className="py-6 text-center text-sm text-destructive">
      {usersError instanceof Error ? usersError.message : "Failed to load users"}
    </div>
  ) : filteredUsers.length === 0 ? (
    <div className="py-6 text-center text-sm text-muted-foreground">
      {userSearchTerm ? "No users found" : "No users available"}
    </div>
  ) : (
    filteredUsers.map((user: any) => {
      const label =
        user.name || user.username || user.email || `User ${user.id}`;

      const initials = (label ?? "U")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase())
        .join("");

      return (
        <SelectItem key={user.id} value={user.id.toString()}>
          <div className="flex items-center gap-3 py-1">
            {/* Avatar (NO next/image) */}
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border bg-muted">
              {user.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={label}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Hide broken image and show fallback initials
                    const img = e.currentTarget;
                    img.style.display = "none";
                    const fallback = img.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}

              {/* Fallback initials */}
              <div
                className="absolute inset-0 hidden items-center justify-center text-[10px] font-semibold text-muted-foreground"
                style={{ display: user.profilePicture ? "none" : "flex" }}
              >
                {initials || "U"}
              </div>
            </div>

            <div className="min-w-0 flex flex-col">
              <span className="truncate font-medium">{label}</span>

              {user.email && user.name && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}

              <span className="text-xs text-muted-foreground">ID: {user.id}</span>
            </div>
          </div>
        </SelectItem>
      );
    })
  )}
</SelectContent>

              </Select>
            </div>

            {/* Type Dropdown Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-type" className="flex items-center gap-1.5 text-xs font-medium">
                <FileType className="h-3.5 w-3.5 text-muted-foreground" />
                Type
              </Label>
              <Select 
                value={adminType} 
                onValueChange={(val) => {
                  if (val === " ") {
                    setAdminType("");
                  } else {
                    setAdminType(val);
                  }
                }}
              >
                <SelectTrigger id="filter-type">
                  <SelectValue placeholder="All types">
                    {adminType ? (
                      <span className="font-mono text-sm">{adminType}</span>
                    ) : (
                      "All types"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All types</SelectItem>
                  {NOTIFICATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className="font-mono text-sm">{type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Read Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-isRead" className="flex items-center gap-1.5 text-xs font-medium">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                Read Status
              </Label>
              <Select 
                value={adminIsRead} 
                onValueChange={(v) => {
                  if (v === " ") {
                    setAdminIsRead("");
                  } else {
                    setAdminIsRead(v as "" | "true" | "false");
                  }
                }}
              >
                <SelectTrigger id="filter-isRead">
                  <SelectValue placeholder="All statuses">
                    {adminIsRead === "true" ? "Read" : adminIsRead === "false" ? "Unread" : "All statuses"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All statuses</SelectItem>
                  <SelectItem value="true">Read</SelectItem>
                  <SelectItem value="false">Unread</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-dateFrom" className="flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                From Date
              </Label>
              <div className="relative">
                <Input
                  id="filter-dateFrom"
                  type="date"
                  value={adminDateFrom}
                  onChange={(e) => setAdminDateFrom(e.target.value)}
                  className="pr-8"
                />
                {adminDateFrom && (
                  <button
                    type="button"
                    onClick={() => setAdminDateFrom("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-dateTo" className="flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                To Date
              </Label>
              <div className="relative">
                <Input
                  id="filter-dateTo"
                  type="date"
                  value={adminDateTo}
                  onChange={(e) => setAdminDateTo(e.target.value)}
                  className="pr-8"
                />
                {adminDateTo && (
                  <button
                    type="button"
                    onClick={() => setAdminDateTo("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Active filters:
                </span>
                {adminUserId && (
                  <Badge variant="secondary" className="gap-1.5">
                    User: {selectedUser?.username || selectedUser?.email || `ID ${adminUserId}`}
                    <button
                      type="button"
                      onClick={() => setAdminUserId("")}
                      className="ml-1 rounded-sm hover:bg-background transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {adminType && (
                  <Badge variant="secondary" className="gap-1.5">
                    Type: {adminType}
                    <button
                      type="button"
                      onClick={() => setAdminType("")}
                      className="ml-1 rounded-sm hover:bg-background transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {adminIsRead && (
                  <Badge variant="secondary" className="gap-1.5">
                    Status: {adminIsRead === "true" ? "Read" : "Unread"}
                    <button
                      type="button"
                      onClick={() => setAdminIsRead("")}
                      className="ml-1 rounded-sm hover:bg-background transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {adminDateFrom && (
                  <Badge variant="secondary" className="gap-1.5">
                    From: {new Date(adminDateFrom).toLocaleDateString()}
                    <button
                      type="button"
                      onClick={() => setAdminDateFrom("")}
                      className="ml-1 rounded-sm hover:bg-background transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {adminDateTo && (
                  <Badge variant="secondary" className="gap-1.5">
                    To: {new Date(adminDateTo).toLocaleDateString()}
                    <button
                      type="button"
                      onClick={() => setAdminDateTo("")}
                      className="ml-1 rounded-sm hover:bg-background transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Quick Filter Presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-muted-foreground self-center">Quick filters:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdminIsRead("false");
                setAdminDateFrom("");
                setAdminDateTo("");
              }}
              className="h-7 text-xs"
            >
              Unread Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setAdminDateFrom(lastWeek.toISOString().split('T')[0]);
                setAdminDateTo(today.toISOString().split('T')[0]);
              }}
              className="h-7 text-xs"
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                setAdminDateFrom(lastMonth.toISOString().split('T')[0]);
                setAdminDateTo(today.toISOString().split('T')[0]);
              }}
              className="h-7 text-xs"
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdminType("SYSTEM_ANNOUNCEMENT");
              }}
              className="h-7 text-xs"
            >
              System Announcements
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
