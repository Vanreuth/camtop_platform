"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

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
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";

const formSchema = z.object({
	code: z.string().min(6, {
		message: "Your one-time password must be 6 characters.",
	}),
});

export default function TwoFactorAuthPage() {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			code: "",
		},
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
		console.log(values);
		toast.success("Two-Factor Authentication enabled!", {
			description: "Your account is now protected with 2FA.",
		});
	}

	return (
		<div className="relative isolate flex min-h-dvh w-full items-start justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:items-center">
			<div className="absolute inset-0 -z-10">
				<Image
					src="/Property-Valuation.webp"
					alt="Background"
					fill
					className="object-cover"
					priority
				/>
				<div className="absolute inset-0 bg-slate-950/55" />
			</div>

			<Card className="my-2 w-full max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl border-white/25 bg-white/95 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
				<CardHeader className="text-center">
					<div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
						<ShieldCheck className="h-5 w-5 text-primary" />
					</div>
					<CardTitle className="mt-3 text-2xl">
						Two-Factor Authentication
					</CardTitle>
					<CardDescription>
						Enhance your security by enabling 2FA.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center space-y-4">
						<p className="text-center text-sm text-muted-foreground">
							1. Scan the QR code with your authenticator app.
						</p>
						<div className="rounded-lg border-2 border-dashed p-4">
							{/* QR Code Placeholder */}
							<div className="flex h-32 w-32 animate-pulse items-center justify-center bg-gray-200">
								<p className="text-xs text-muted-foreground">QR Code</p>
							</div>
						</div>
						<p className="text-center text-sm text-muted-foreground">
							2. Enter the 6-digit code from your app.
						</p>
					</div>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="mt-6 space-y-6"
						>
							<FormField
								control={form.control}
								name="code"
								render={({ field }) => (
									<FormItem>
										<FormLabel>One-Time Password</FormLabel>
										<FormControl>
											<InputOTP maxLength={6} {...field} className="mx-auto">
												<InputOTPGroup>
													<InputOTPSlot index={0} />
													<InputOTPSlot index={1} />
													<InputOTPSlot index={2} />
													<InputOTPSlot index={3} />
													<InputOTPSlot index={4} />
													<InputOTPSlot index={5} />
												</InputOTPGroup>
											</InputOTP>
										</FormControl>
										<FormDescription className="text-center">
											Please enter the one-time password from your authenticator
											app.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="w-full">
								Verify & Enable
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
