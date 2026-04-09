"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Control, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
  User,
  Mail,
  Phone,
  Shield,
  Camera,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UserPayload,
} from "@/hooks/auth/auth.schemas";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const ROLE_COLOR_MAP: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  PROP_MGR: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  DATA_ENTRY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  VIEWER: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

const DEFAULT_ROLE_COLOR =
  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
const PASSWORD_HAS_NUMBER_REGEX = /[0-9]/;

function getRoleColor(roleCode: string) {
  return ROLE_COLOR_MAP[roleCode] ?? DEFAULT_ROLE_COLOR;
}

function getProfileFormValues(user?: UserPayload | null): UpdateProfileInput {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    bio: user?.bio ?? "",
    profilePicture: undefined,
  };
}

function ValidationItem({
  isValid,
  text,
}: {
  isValid: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {isValid ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span
        className={
          isValid
            ? "text-green-600 dark:text-green-400"
            : "text-muted-foreground"
        }
      >
        {text}
      </span>
    </div>
  );
}

function PasswordRequirements({
  control,
}: {
  control: Control<ChangePasswordInput>;
}) {
  const newPasswordValue = useWatch({
    control,
    name: "newPassword",
    defaultValue: "",
  });

  const passwordValidation = useMemo(
    () => ({
      minLength: newPasswordValue.length >= 8,
      hasNumber: PASSWORD_HAS_NUMBER_REGEX.test(newPasswordValue),
    }),
    [newPasswordValue]
  );

  if (!newPasswordValue) return null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/50 p-4">
      <p className="mb-2 text-xs font-semibold text-foreground">
        Password Requirements:
      </p>
      <ValidationItem
        isValid={passwordValidation.minLength}
        text="At least 8 characters"
      />
      <ValidationItem
        isValid={passwordValidation.hasNumber}
        text="At least one number"
      />
    </div>
  );
}

function PasswordMatchStatus({
  control,
}: {
  control: Control<ChangePasswordInput>;
}) {
  const newPasswordValue = useWatch({
    control,
    name: "newPassword",
    defaultValue: "",
  });
  const confirmPasswordValue = useWatch({
    control,
    name: "confirmPassword",
    defaultValue: "",
  });

  if (!confirmPasswordValue) return null;

  const passwordsMatch = newPasswordValue === confirmPasswordValue;

  return (
    <div className="mt-2 flex items-center gap-2">
      {passwordsMatch ? (
        <>
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-600 dark:text-green-400">
            Passwords match
          </p>
        </>
      ) : (
        <>
          <X className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">Passwords do not match</p>
        </>
      )}
    </div>
  );
}

export default function SettingsAccountPage() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const {
    user,
    roles,
    isLoading,
    updateProfile,
    changePassword,
    isUpdatingProfile,
    isChangingPassword,
  } = useAuth();

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: getProfileFormValues(),
    mode: "onChange",
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const resetProfileForm = useCallback(
    (nextUser?: UserPayload | null) => {
      profileForm.reset(getProfileFormValues(nextUser));
    },
    [profileForm]
  );

  const clearObjectPreview = useCallback(() => {
    if (!previewObjectUrlRef.current) return;

    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
  }, []);

  useEffect(() => {
    if (!user) return;

    resetProfileForm(user);
    clearObjectPreview();
    setPreviewUrl(user.profilePicture || "");
    if (profilePictureInputRef.current) {
      profilePictureInputRef.current.value = "";
    }
  }, [user, resetProfileForm, clearObjectPreview]);

  useEffect(() => {
    return () => {
      clearObjectPreview();
    };
  }, [clearObjectPreview]);

  const handleProfilePictureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    profileForm.setValue("profilePicture", file, {
      shouldDirty: true,
      shouldValidate: true,
    });

    clearObjectPreview();
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  };

  const handleCancelProfileEdit = () => {
    setIsEditingProfile(false);
    resetProfileForm(user);
    clearObjectPreview();
    setPreviewUrl(user?.profilePicture || "");
    if (profilePictureInputRef.current) {
      profilePictureInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            Loading account information...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">No User Found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Unable to load account information. Please try logging in
                  again.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold tracking-tight">Account</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings and password.
        </p>
      </div>
      <Separator />

      {/* Profile Picture & Basic Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            {!isEditingProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingProfile(true)}
              >
                Edit Profile
              </Button>
            )}
          </div>
          <CardDescription>
            Update your profile information and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture Section */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={previewUrl} alt={user.username} />
              <AvatarFallback className="text-2xl">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            {isEditingProfile && (
              <div>
                <label htmlFor="profilePicture">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => profilePictureInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Change Photo
                  </Button>
                </label>
                <input
                  ref={profilePictureInputRef}
                  id="profilePicture"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  JPG, PNG or WEBP. Max 5MB.
                </p>
              </div>
            )}
          </div>

          {isEditingProfile ? (
            <Form {...profileForm}>
              <form
                className="space-y-4"
                onSubmit={profileForm.handleSubmit(async (values) => {
                  if (!user) return;
                  try {
                    const result = await updateProfile(values);
                    clearObjectPreview();
                    setIsEditingProfile(false);
                    resetProfileForm(user);
                    const maybeUrl =
                      (result as any)?.profilePicture ||
                      (result as any)?.data?.profilePicture;
                    setPreviewUrl(maybeUrl || user.profilePicture || "");
                    if (profilePictureInputRef.current) {
                      profilePictureInputRef.current.value = "";
                    }
                  } catch {
                    // useAuth already toasts errors
                  }
                })}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="Phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={profileForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about yourself"
                          className="min-h-[90px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* show file validation errors */}
                {profileForm.formState.errors.profilePicture && (
                  <p className="text-sm text-destructive">
                    {String(profileForm.formState.errors.profilePicture.message)}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelProfileEdit}
                    disabled={isUpdatingProfile}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  Username
                </div>
                <p className="text-base font-medium">{user.username}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <p className="text-base font-medium">{user.email}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <p className="text-base font-medium">{user.phone || "Not provided"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Full Name
                </label>
                <p className="text-base font-medium">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.lastName || "Not provided"}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Role
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {roles && roles.length > 0 ? (
                    roles.map((r) => (
                      <Badge
                        key={r.roleCode || r.roleName}
                        variant="secondary"
                        className={getRoleColor(r.roleCode)}
                      >
                        {r.roleName || r.roleCode}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No roles assigned
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Bio
                </label>
                <p className="text-base">{user.bio || "No bio added yet."}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Account Status
                </label>
                <div>
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
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  User ID
                </label>
                <p className="text-base font-mono text-sm">#{user.id}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...passwordForm}>
            <form
              className="space-y-4"
              onSubmit={passwordForm.handleSubmit(async (values) => {
                if (!user) return;
                try {
                  await changePassword({
                    userId: user.id,
                    passwordData: {
                      currentPassword: values.currentPassword,
                      newPassword: values.newPassword,
                      confirmPassword: values.confirmPassword,
                    },
                  });
                  passwordForm.reset();
                } catch {
                  // useAuth already toasts errors
                }
              })}
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Enter current password"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <PasswordRequirements control={passwordForm.control} />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <PasswordMatchStatus control={passwordForm.control} />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    passwordForm.reset();
                    // toast.info("Password fields cleared");
                  }}
                  disabled={isChangingPassword}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  disabled={isChangingPassword || !passwordForm.formState.isValid}
                  className="flex-1 md:flex-none"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
