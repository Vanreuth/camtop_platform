"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Camera, Loader2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/auth/useAuth";

const profileFormSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 2 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
  firstName: z
    .string()
    .min(2, {
      message: "First name must be at least 2 characters.",
    })
    .max(50, {
      message: "First name must not be longer than 50 characters.",
    }),
  lastName: z
    .string()
    .min(2, {
      message: "Last name must be at least 2 characters.",
    })
    .max(50, {
      message: "Last name must not be longer than 50 characters.",
    }),
  email: z
    .string({
      required_error: "Please enter an email address.",
    })
    .email(),
  bio: z
    .string()
    .max(500, {
      message: "Bio must not be longer than 500 characters.",
    })
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function SettingsPage() {
  const { user, isLoading, updateProfile } = useAuth();

  type UpdateProfileResult = {
    profilePicture?: string;
    // add other fields as needed
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      bio: "",
    },
    mode: "onChange",
  });

  // Populate form with user data
  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        bio: user?.bio || "",
      });

      if (user.profilePicture) {
        setPreviewUrl(user.profilePicture);
      }
    }
  }, [user, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please select an image smaller than 5MB.",
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type", {
          description: "Please select an image file.",
        });
        return;
      }

      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    setIsSubmitting(true);
    try {
      const result = (await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        bio: data.bio || undefined,
        profilePicture: profileImage || undefined,
      })) as UpdateProfileResult | void;

      toast.success("Profile updated successfully!", {
        description: "Your profile has been updated.",
      });

      // Update preview URL if a new profile picture was uploaded
      if (
        result &&
        typeof result === "object" &&
        "profilePicture" in result &&
        result.profilePicture &&
        profileImage
      ) {
        setPreviewUrl(result.profilePicture);
      }

      setProfileImage(null);
    } catch (error: any) {
      toast.error("Failed to update profile", {
        description: error || "Something went wrong.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const getUserInitials = () => {
    if (!user) return "U";
    const firstInitial = user.firstName?.[0] || "";
    const lastInitial = user.lastName?.[0] || "";
    return (
      (firstInitial + lastInitial).toUpperCase() ||
      user.username?.[0]?.toUpperCase() ||
      "U"
    );
  };

  const getUserRoles = () => {
    if (!user?.roles || user.roles.length === 0) return [];
    return user.roles.map((ur) => ({
      name: ur.roleName,
      code: ur.roleCode,
    }));
  };

  const getRoleColor = (roleCode: string) => {
    switch (roleCode) {
      case "SUPER_ADMIN":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "PROP_MGR":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "DATA_ENTRY":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "VIEWER":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-2 sm:p-3">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Separator />
        <div className="space-y-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-20" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Unable to load user profile.</p>
      </div>
    );
  }

  const roles = getUserRoles();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-2 sm:p-3">
      <div>
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-muted-foreground">
          This is how others will see you on the site.
        </p>
      </div>
      <Separator />

      {/* User Info Card */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <Avatar className="h-16 w-16 ring-2 ring-offset-2 ring-offset-background ring-primary/10">
            <AvatarImage
              src={user.profilePicture || undefined}
              alt={user.username}
            />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-semibold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-semibold">
                {user.firstName} {user.lastName}
              </h4>
              <Badge
                variant={user.status === "ACTIVE" ? "default" : "secondary"}
                className={
                  user.status === "ACTIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : ""
                }
              >
                {user.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              @{user.username} • {user.email}
            </p>
            {user.bio && (
              <p className="text-sm text-muted-foreground pt-1">{user.bio}</p>
            )}
            {roles.length > 0 && (
              <div className="flex flex-col items-start gap-2 pt-2 sm:flex-row sm:items-center">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => (
                    <Badge
                      key={role.code}
                      variant="outline"
                      className={`text-xs ${getRoleColor(role.code)}`}
                    >
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
          {/* Profile Picture */}
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Avatar className="h-20 w-20 ring-2 ring-offset-2 ring-offset-background ring-primary/10">
              <AvatarImage src={previewUrl || undefined} alt={user.username} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="picture">Profile Picture</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => document.getElementById("picture")?.click()}
                  disabled={isSubmitting}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Change Picture
                </Button>
                {previewUrl && previewUrl !== user.profilePicture && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProfileImage(null);
                      setPreviewUrl(user.profilePicture || null);
                    }}
                    disabled={isSubmitting}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <input
                id="picture"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>
          </div>

          {/* Username and Email */}
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="username"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    This is your public display username.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="john.doe@example.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Your email address for notifications.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* First and Last Name */}
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Doe"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Bio */}
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us a little bit about yourself"
                    className="resize-none min-h-[100px]"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormDescription>
                  Brief description for your profile. Max 500 characters.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update profile
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                form.reset();
                setProfileImage(null);
                setPreviewUrl(user.profilePicture || null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
