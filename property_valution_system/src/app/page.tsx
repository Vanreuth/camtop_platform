import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware will handle locale, just redirect to login
  redirect("/login");
}
