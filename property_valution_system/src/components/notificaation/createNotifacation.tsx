"use client";

import { useMemo, useState } from "react";
import { Send, Shield, Users, User, Link2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

import {
  useAdminCreateNotification,
  useAdminSendAllUsers,
  useAdminSendPrivileged,
} from "@/hooks/notification/useNotification";
import { useUsers } from "@/hooks/user/useUser";

type SendMode = "single" | "all" | "privileged";

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

const ENTITY_TYPES = [
  "PROPERTY_VALUATION",
  "INDICATIVE_VALUATION",
  "PROPERTY",
  "NOTIFICATIONS",
] as const;

function normalizeActionUrl(url: string) {
  const stripped = url.replace(/^\/[a-z]{2}\//, "/");
  const m = stripped.match(/^\/valuations\/(\d+)/);
  const i =
    stripped.match(/^\/indicative-valuations\/(\d+)/) ??
    stripped.match(/^\/property-indicativeValuation\/(\d+)/);
  if (m) return `/dashboard/propertyValuation/${m[1]}`;
  if (i) return `/dashboard/propertyIndicativeValuation/${i[1]}`;
  return stripped;
}

function buildActionUrl(entityType?: string, entityId?: number) {
  if (!entityType || !entityId) return "";
  if (entityType === "PROPERTY_VALUATION") return `/dashboard/propertyValuation/${entityId}`;
  if (entityType === "INDICATIVE_VALUATION") {
    return `/dashboard/propertyIndicativeValuation/${entityId}`;
  }
  if (entityType === "PROPERTY") return `/dashboard/property/${entityId}`;
  if (entityType === "NOTIFICATIONS") return `/dashboard/notifications`;
  return "";
}

export function CreateNotificationModal({ triggerLabel = "Create Notification", onSent }: {
  triggerLabel?: string;
  onSent?: () => void;
}) {
  const createOne = useAdminCreateNotification();
  const sendAll = useAdminSendAllUsers();
  const sendPrivileged = useAdminSendPrivileged();

  const {
    data: usersData,
    isLoading: isLoadingUsers,
    isError: isUsersError,
    error: usersError,
  } = useUsers({ page: 1, limit: 100 });

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SendMode>("single");

  const [type, setType] = useState("SYSTEM_ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");

  // entity fields (only for single)
  const [entityType, setEntityType] = useState("INDICATIVE_VALUATION");
  const [entityId, setEntityId] = useState("");
  const [actionUrl, setActionUrl] = useState("");

  // search
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [typeSearchTerm, setTypeSearchTerm] = useState("");

  const isBusy = createOne.isPending || sendAll.isPending || sendPrivileged.isPending;

  const filteredUsers = useMemo(() => {
    const users = usersData?.users ?? [];
    const q = userSearchTerm.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u: any) => {
      const id = String(u.id ?? "");
      const username = String(u.username ?? "").toLowerCase();
      const email = String(u.email ?? "").toLowerCase();
      const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim().toLowerCase();
      return id.includes(q) || username.includes(q) || email.includes(q) || fullName.includes(q);
    });
  }, [usersData, userSearchTerm]);

  const filteredTypes = useMemo(() => {
    const q = typeSearchTerm.trim().toLowerCase();
    if (!q) return NOTIFICATION_TYPES;
    return NOTIFICATION_TYPES.filter((t) => t.toLowerCase().includes(q));
  }, [typeSearchTerm]);

  const entityIdNumber = useMemo(() => {
    const n = Number(entityId);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }, [entityId]);

  const computedUrl = useMemo(() => {
    // If actionUrl provided => use it.
    if (actionUrl.trim()) return normalizeActionUrl(actionUrl.trim());

    // Single user can auto build from entity
    if (mode === "single") {
      const built = buildActionUrl(entityType, entityIdNumber);
      return built ? normalizeActionUrl(built) : "";
    }

    // Broadcast: no auto entity link
    return "";
  }, [actionUrl, mode, entityType, entityIdNumber]);

  const reset = () => {
    setMode("single");
    setType("SYSTEM_ANNOUNCEMENT");
    setTitle("");
    setMessage("");
    setUserId("");
    setEntityType("INDICATIVE_VALUATION");
    setEntityId("");
    setActionUrl("");
    setUserSearchTerm("");
    setTypeSearchTerm("");
  };

  const validate = () => {
    if (!type.trim()) return "Type is required";
    if (!title.trim()) return "Title is required";
    if (!message.trim()) return "Message is required";
    if (mode === "single") {
      const n = Number(userId);
      if (!Number.isInteger(n) || n <= 0) return "Select a valid user";
    }
    return null;
  };

  const handleSend = async () => {
    const err = validate();
    if (err) return toast.error(err);

    // ✅ common (always)
    const base = {
      type: type.trim(),
      title: title.trim(),
      message: message.trim(),
    };
    const broadcastPayload = {
      ...base,
      actionUrl: computedUrl || undefined, // optional global link
      entityType: undefined,
      entityId: undefined,
    };

    // ✅ single payload => entity allowed
    const singlePayload = {
      ...base,
      entityType: entityType.trim() ? entityType.trim() : undefined,
      entityId: entityIdNumber,
      actionUrl: computedUrl || undefined,
    };

    try {
      if (mode === "single") {
        await createOne.mutateAsync({ userId: Number(userId), ...singlePayload });
        toast.success("Notification sent");
      } else if (mode === "all") {
        await sendAll.mutateAsync(broadcastPayload);
        toast.success("Sent to all users");
      } else {
        await sendPrivileged.mutateAsync(broadcastPayload);
        toast.success("Sent to privileged users");
      }

      onSent?.();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), reset()))}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Send className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Notification</DialogTitle>
          <DialogDescription>Single user (entity optional) or broadcasts (GLOBAL).</DialogDescription>
        </DialogHeader>

        {/* MODE */}
        <div className="space-y-3">
          <Label>Recipient Type</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cn("rounded-lg border p-3 text-left", mode === "single" && "border-primary bg-primary/5")}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" /> Single
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("all")}
              className={cn("rounded-lg border p-3 text-left", mode === "all" && "border-primary bg-primary/5")}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" /> All
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("privileged")}
              className={cn("rounded-lg border p-3 text-left", mode === "privileged" && "border-primary bg-primary/5")}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Privileged
              </div>
            </button>
          </div>
        </div>

        {/* USER SELECT (single mode only for sending, but always visible for clarity) */}
        <div className="space-y-2">
          <Label>
            Select User {mode === "single" ? "*" : ""}
          </Label>
          <Select value={userId} onValueChange={setUserId} disabled={mode !== "single"}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingUsers
                    ? "Loading users..."
                    : isUsersError
                    ? "Failed to load users"
                    : mode === "single"
                    ? "Select user"
                    : "Available in Single mode"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    placeholder="Search..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {isLoadingUsers ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading users...</div>
                ) : isUsersError ? (
                  <div className="py-6 text-center text-sm text-destructive">
                    {usersError instanceof Error ? usersError.message : "Failed to load users"}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {userSearchTerm ? "No users found" : "No users available"}
                  </div>
                ) : (
                  filteredUsers.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.username || u.email || `User ${u.id}`} (ID: {u.id})
                    </SelectItem>
                  ))
                )}
              </div>
            </SelectContent>
          </Select>
          {mode !== "single" && (
            <p className="text-xs text-muted-foreground">
              Switch recipient type to <strong>Single</strong> to pick a specific user.
            </p>
          )}
        </div>

        {/* CONTENT */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="h-9 pl-8"
                        placeholder="Search type..."
                        value={typeSearchTerm}
                        onChange={(e) => setTypeSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {filteredTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="font-mono">{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Message *</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[110px]" />
            </div>
          </div>
        </div>

        {/* ENTITY SECTION: ONLY FOR SINGLE */}
        {mode === "single" && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <h3 className="font-medium">Entity Link (Optional)</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="font-mono text-sm">{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Entity ID</Label>
                <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} type="number" />
              </div>

              <div className="space-y-2">
                <Label>Custom URL</Label>
                <Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>

            {computedUrl && (
              <div className="text-xs text-muted-foreground">
                URL: <span className="font-mono">{computedUrl}</span>
              </div>
            )}
          </div>
        )}

        {/* BROADCAST: OPTIONAL GLOBAL URL ONLY */}
        {mode !== "single" && (
          <div className="space-y-2 rounded-lg border p-4">
            <Label>Global Link (Optional)</Label>
            <Input
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/dashboard/notifications"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Broadcast notifications are GLOBAL: entityType/entityId will not be saved.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => (setOpen(false), reset())} disabled={isBusy} className="gap-2">
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSend} disabled={isBusy} className="gap-2">
            <Send className="h-4 w-4" /> {isBusy ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
