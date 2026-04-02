"use client";
import { Bell, Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSwitcher } from "./app-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Search Bar */}
      <div className="flex items-center max-w-md flex-1">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search anything... (⌘K)"
            className="pl-10 pr-4 py-2 h-9 bg-muted/40 border-0 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all duration-200 placeholder:text-muted-foreground/60"
          />
          <kbd className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* App Switcher */}
        <AppSwitcher />

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 hover:bg-muted/50 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center font-medium animate-pulse">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end" forceMount>
            <DropdownMenuLabel className="font-normal p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <Badge variant="secondary" className="text-xs">
                  3 New
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              <DropdownMenuItem className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">New user registered</p>
                    <p className="text-xs text-muted-foreground">
                      John Doe joined your team
                    </p>
                    <p className="text-xs text-muted-foreground">
                      2 minutes ago
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Project completed</p>
                    <p className="text-xs text-muted-foreground">
                      Website redesign is ready for review
                    </p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">System update</p>
                    <p className="text-xs text-muted-foreground">
                      New features available
                    </p>
                    <p className="text-xs text-muted-foreground">3 hours ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-3 cursor-pointer text-center justify-center hover:bg-muted/50 transition-colors">
              <span className="text-sm text-primary">
                View all notifications
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-8 w-8 ring-2 ring-background hover:ring-primary/20 transition-all">
                <AvatarImage src="/avatar.png" alt="User" />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  JD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/avatar.png" alt="User" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">John Doe</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    john.doe@example.com
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem className="p-3 cursor-pointer hover:bg-muted/50 rounded-md transition-colors">
              <span className="flex items-center gap-2">👤 Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer hover:bg-muted/50 rounded-md transition-colors">
              <span className="flex items-center gap-2">⚙️ Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer hover:bg-muted/50 rounded-md transition-colors">
              <span className="flex items-center gap-2">💳 Billing</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem className="p-3 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">
              <span className="flex items-center gap-2">🚪 Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
