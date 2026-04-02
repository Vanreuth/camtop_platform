"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Upload,
  UserPlus,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Link, useRouter } from "@/lib/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  registerSchema,
  type RegisterInput,
} from "@/hooks/auth/auth.schemas";
import { getApiErrorMessage } from "@/utils/helpers";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GoogleButton } from "@/components/GoogleButton";

// Tighter input height and font size to save vertical space
const inputClassName =
  "h-9 rounded-lg border-slate-200 bg-white/85 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus-visible:ring-primary/50";

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isRegistering } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      confirmPassword: "",
      profilePicture: undefined,
    },
    mode: "onSubmit",
  });

  const profilePictureFile = form.watch("profilePicture");

  useEffect(() => {
    if (profilePictureFile instanceof File) {
      const objectUrl = URL.createObjectURL(profilePictureFile);
      setProfilePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    setProfilePreview(null);
  }, [profilePictureFile]);

  const onSubmit = async (values: RegisterInput) => {
    setSubmitError(null);
    setSubmitInfo(null);

    try {
      const result = await registerUser(values);
      const email = result?.user?.email ?? values.email;
      if (email) sessionStorage.setItem("pending_verify_email", email);

      const verificationEmailSent = result?.verificationEmailSent !== false;
      const successMessage = verificationEmailSent
        ? "Registration successful. Check your inbox for your verification link."
        : "Registration successful, but verification email could not be sent. Please resend from verify-email page.";

      setSubmitInfo(successMessage);
      if (verificationEmailSent) {
        toast.success(successMessage);
      } else {
        toast.warning(successMessage);
      }

      router.push("/verify-email");
    } catch (err) {
      const message = getApiErrorMessage(err, "Registration failed");
      setSubmitError(message);
      toast.error(message);
    }
  };

  const onInvalid = () => {
    const firstError =
      form.formState.errors.firstName?.message ||
      form.formState.errors.lastName?.message ||
      form.formState.errors.username?.message ||
      form.formState.errors.email?.message ||
      form.formState.errors.password?.message ||
      form.formState.errors.confirmPassword?.message ||
      form.formState.errors.phone?.message ||
      form.formState.errors.profilePicture?.message ||
      "Please check your input and try again.";

    const message = String(firstError);
    setSubmitError(message);
    toast.error(message);
  };

  return (
    <div className="relative isolate flex min-h-dvh w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-slate-950 p-2 sm:p-3 md:items-center md:p-4">
      <div className="absolute inset-0 z-0">
        <Image
          src="/Property-Valuation.webp"
          alt="Background"
          fill
          className="object-cover"
          priority
          style={{ objectFit: "cover" }}
        />
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_20%_15%,rgba(14,165,233,.22),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(37,99,235,.20),transparent_32%)]" />

      {/* Keep card usable on short viewports by enabling internal scroll */}
      <Card className="relative z-20 my-1 w-full max-w-[760px] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[24px] border-white/30 bg-white/95 shadow-2xl backdrop-blur-xl md:max-h-[calc(100dvh-2rem)]">
        <CardContent className="p-4 sm:p-5 md:p-6">
          
          {/* Centered Header */}
          <div className="mb-4 space-y-1.5 text-center">
            <div className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 shadow-sm">
              <Image src="/camtop_logo.svg" alt="Camtop Logo" width={24} height={24} priority />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Create account
              </h1>
              <p className="text-xs text-slate-600">
                Set up your profile and start valuing
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[680px]">
            {submitInfo && (
              <Alert className="mb-3 border-green-200 bg-green-50 py-2 text-green-900">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-sm">Success</AlertTitle>
                <AlertDescription className="text-xs">{submitInfo}</AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive" className="mb-3 py-2" role="alert" aria-live="assertive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Failed</AlertTitle>
                <AlertDescription className="text-xs">{submitError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              {/* Tighter spacing between rows */}
              <form
                onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                className="space-y-3"
                noValidate
              >
              
              {/* Compact Profile Picture Upload */}
              <FormField
                control={form.control}
                name="profilePicture"
                render={({ field }) => (
                  <FormItem className="flex flex-col items-start gap-2 space-y-0 rounded-xl border border-slate-100 bg-slate-50/50 p-2 sm:flex-row sm:items-center sm:gap-3">
                    <FormLabel className="group relative flex cursor-pointer items-center justify-center rounded-full shrink-0">
                      <Avatar className="h-12 w-12 border-2 border-slate-200 bg-white shadow-sm transition-opacity group-hover:opacity-80">
                        <AvatarImage src={profilePreview || ""} className="object-cover" />
                        <AvatarFallback className="bg-transparent">
                          <UserPlus className="h-5 w-5 text-slate-400" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Upload className="h-4 w-4 text-white" />
                      </div>

                      <FormControl>
                        <Input
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => field.onChange(e.target.files?.[0])}
                          disabled={isRegistering}
                        />
                      </FormControl>
                    </FormLabel>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700 sm:text-sm">Profile Photo</p>
                      <p className="text-xs text-slate-500">Optional (max 5MB)</p>
                    </div>
                    <FormMessage className="text-xs sm:ml-auto" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-slate-700">First Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input placeholder="John" {...field} disabled={isRegistering} className={`${inputClassName} pl-9`} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-slate-700">Last Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input placeholder="Doe" {...field} disabled={isRegistering} className={`${inputClassName} pl-9`} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-slate-700">Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input placeholder="johndoe_01" {...field} disabled={isRegistering} className={`${inputClassName} pl-9`} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-slate-700">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                            autoCapitalize="none"
                            autoCorrect="off"
                            disabled={isRegistering}
                            className={`${inputClassName} pl-9`}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-slate-700">
                      Phone <span className="text-slate-400 font-normal">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="tel"
                          placeholder="+855 12 345 678"
                          {...field}
                          disabled={isRegistering}
                          className={`${inputClassName} pl-9`}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-slate-700">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 8 chars"
                            {...field}
                            disabled={isRegistering}
                            autoComplete="new-password"
                            className={`${inputClassName} pl-9 pr-9`}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 focus:outline-none"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-slate-700">Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repeat password"
                            {...field}
                            disabled={isRegistering}
                            autoComplete="new-password"
                            className={`${inputClassName} pl-9 pr-9`}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 focus:outline-none"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  className="h-9 w-full rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </div>
              </form>
            </Form>

            {/* Compact Footer */}
            <div className="mt-4 flex flex-col space-y-2.5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-white/95 px-3 text-slate-400 font-medium">Or continue with Google</span>
                </div>
              </div>
              <p className="text-center text-xs text-slate-600">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </p>

              <GoogleButton />
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
