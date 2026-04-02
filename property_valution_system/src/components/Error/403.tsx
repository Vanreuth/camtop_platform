import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export const Forbidden403: React.FC<{ message?: string }> = ({ message }) => {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <TriangleAlertIcon className="mx-auto h-12 w-12 text-destructive" />

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          403 Forbidden
        </h1>

        <p className="mt-4 text-muted-foreground">
          {message ||
            "You do not have permission to access this page. Please check your access rights and try again."}
        </p>

        <div className="mt-8 flex gap-4 justify-center">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="px-6"
          >
            Go Back
          </Button>
          <Button onClick={() => router.push("/dashboard")} className="px-6">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

function TriangleAlertIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
