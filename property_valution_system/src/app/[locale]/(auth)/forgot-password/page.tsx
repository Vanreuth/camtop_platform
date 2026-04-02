"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import Image from "next/image";
import { ArrowLeft, Mail } from "lucide-react";

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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Link } from "@/lib/navigation";

const formSchema = z.object({
	email: z.string().email({
		message: "Please enter a valid email address.",
	}),
});

export default function ForgotPasswordPage() {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
		},
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
		console.log(values);
		toast.success("Password reset email sent!", {
			description:
				"If an account exists with that email, you will receive a password reset link.",
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

			<Card className="my-2 w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl border-white/25 bg-white/95 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
				<CardHeader className="space-y-2 text-center">
					<div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
						<Mail className="h-5 w-5 text-primary" />
					</div>
					<CardTitle className="text-2xl">Forgot Password</CardTitle>
					<CardDescription>
						Enter your email and we will send you a link to reset your password.
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input
												type="email"
												placeholder="m@example.com"
												autoCapitalize="none"
												autoCorrect="off"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="w-full">
								Send reset link
							</Button>
						</form>
					</Form>

					<div className="text-center text-sm">
						Remember your password?{" "}
						<Link href="/login" className="font-semibold text-primary hover:underline">
							Sign in
						</Link>
					</div>

					<div className="text-center">
						<Link href="/login" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
							<ArrowLeft className="h-3.5 w-3.5" />
							Back to login
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
