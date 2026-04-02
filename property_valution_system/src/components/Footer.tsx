import { FileText, HelpCircle, Shield } from "lucide-react";
import Link from "next/link";


 export const Footer = () => {

  return (
    <footer className="border-t bg-background/50 backdrop-blur-sm mt-auto">
      <div className="px-4 md:px-6 py-3 md:py-2.5">
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © Camtop Property. All rights reserved.
          </p>

          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <Shield className="h-3.5 w-3.5" />
              Privacy Policy
            </Link>

            <Link
              href="/dashboard/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Terms of Service
            </Link>

            <Link
              href="/dashboard/help"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Help Center
            </Link>
          </nav>
        </div>

        {/* Tablet */}
        <div className="hidden sm:flex md:hidden items-center justify-between text-xs">
          <p className="text-muted-foreground">© Camtop Property</p>

          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/dashboard/terms"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/dashboard/help"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Help
            </Link>
          </nav>
        </div>

        {/* Mobile (icons only) */}
        <div className="sm:hidden flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted/50 rounded-md"
              title="Privacy Policy"
            >
              <Shield className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard/terms"
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted/50 rounded-md"
              title="Terms of Service"
            >
              <FileText className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard/help"
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted/50 rounded-md"
              title="Help Center"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            © Camtop Property
          </p>
        </div>
      </div>
    </footer>
  );
};
