"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  Shield,
  Printer,
  List,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  AlertCircle,
  Gavel,
  Scale,
  UserCheck,
  Lock,
  Landmark,
  CreditCard,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Copy,
  Check,
  Server,
  Ban,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
}

const SECTIONS: Section[] = [
  { id: "introduction", title: "Introduction", icon: FileText },
  { id: "eligibility", title: "Eligibility & Account Registration", icon: UserCheck },
  { id: "service-scope", title: "Service Scope (Camtop Valuation Platform)", icon: Landmark },
  { id: "acceptable-use", title: "Acceptable Use", icon: Shield },
  { id: "data-privacy", title: "Privacy & Data", icon: Lock },
  { id: "payments", title: "Plans, Billing & Payments", icon: CreditCard },
  { id: "intellectual-property", title: "Intellectual Property", icon: Scale },
  { id: "disclaimers", title: "Disclaimers", icon: AlertCircle },
  { id: "limitation", title: "Limitation of Liability", icon: Ban },
  { id: "termination", title: "Termination", icon: RefreshCw },
  { id: "governing-law", title: "Governing Law (Cambodia)", icon: Gavel },
  { id: "contact", title: "Contact Camtop Support", icon: Mail },
];

const CAMTOP_SUPPORT = {
  email: "support@camtopproperty.site",
  phone: "+855 (0)XX XXX XXX",
  address: "Phnom Penh, Cambodia",
};

const LAST_UPDATED = "January 20, 2026";
const VERSION = "1.0";

export default function TermsOfServicePage() {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0]?.id ?? "");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showTableOfContents, setShowTableOfContents] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTIONS.map((s) => s.id))
  );
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  // Active section tracking
  useEffect(() => {
    const ids = SECTIONS.map((s) => s.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) =>
            a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1
          );
        if (visible[0]?.target?.id) setActiveSection(visible[0].target.id);
      },
      { root: null, rootMargin: "-120px 0px -70% 0px", threshold: [0, 0.1, 0.25] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Scroll progress + scroll-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      const doc = document.documentElement;
      const scrollTop = doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const p =
        scrollHeight > 0
          ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100))
          : 0;
      setProgress(p);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const offset = 96;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const handlePrint = useCallback(() => window.print(), []);

  const copyToClipboard = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  }, []);

  const handleTocClick = useCallback(
    (id: string) => {
      scrollToSection(id);
      setShowTableOfContents(false);
    },
    [scrollToSection]
  );

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 print:bg-white">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 print:hidden">
        <div
          className="h-full bg-violet-600 dark:bg-violet-500 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-700 dark:to-purple-700 text-white py-12 md:py-16 px-4 print:py-8 print:bg-violet-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scale className="w-10 h-10 md:w-12 md:h-12" />
            <h1 className="text-3xl md:text-5xl font-bold">Terms of Service</h1>
          </div>

          <p className="text-center text-violet-100 text-base md:text-lg">
            Camtop Property Valuation Platform — Cambodia
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Badge variant="secondary" className="text-sm bg-white/20 text-white border-white/30">
              Last Updated: {LAST_UPDATED}
            </Badge>
            <Badge variant="secondary" className="text-sm bg-white/20 text-white border-white/30">
              Version: {VERSION}
            </Badge>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex justify-center gap-2 mt-6 print:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={expandAll}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Eye className="w-4 h-4 mr-2" />
              Expand All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={collapseAll}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Collapse All
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky actions */}
      <div className="md:hidden sticky top-1 z-40 px-4 pt-3 print:hidden">
        <div className="flex gap-2 rounded-xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur p-2 shadow-sm">
          <Button variant="outline" size="sm" className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowTableOfContents((v) => !v)}
          >
            <List className="w-4 h-4 mr-2" />
            Contents
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Table of Contents */}
          <aside
            className={cn(
              "lg:w-72 lg:flex-shrink-0 print:hidden",
              showTableOfContents ? "block" : "hidden lg:block"
            )}
          >
            <div className="lg:sticky lg:top-4">
              <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-violet-200/50 dark:border-violet-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <List className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Table of Contents
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tip: Use the table of contents to jump to any section.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <ScrollArea className="h-auto max-h-[60vh]">
                    <nav className="space-y-1">
                      {SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const active = activeSection === section.id;
                        return (
                          <button
                            key={section.id}
                            onClick={() => handleTocClick(section.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 text-left",
                              active
                                ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 font-medium"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                            aria-current={active ? "page" : undefined}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{section.title}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </ScrollArea>

                  <Separator className="my-4" />

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={expandAll} className="flex-1 text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      Expand
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll} className="flex-1 text-xs">
                      <EyeOff className="w-3 h-3 mr-1" />
                      Collapse
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0">
            {/* Highlight Notice */}
            <Alert className="mb-8 border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 print:hidden">
              <Server className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <AlertTitle className="text-violet-900 dark:text-violet-200">
                Camtop Service Notice (Valuation Platform)
              </AlertTitle>
              <AlertDescription className="text-violet-800 dark:text-violet-300">
                Camtop provides workflow tools for property valuation (Cambodia). Your organization controls user roles,
                permissions, and approval rules. Valuation outputs depend on the evidence and inputs provided by authorized users.
              </AlertDescription>
            </Alert>

            <CollapsibleSection
              id="introduction"
              title="Introduction"
              icon={FileText}
              isExpanded={expandedSections.has("introduction")}
              onToggle={() => toggleSection("introduction")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  These Terms of Service (“Terms”) govern your access to and use of Camtop Property Valuation Platform (“Camtop”,
                  “we”, “us”, “our”). By using Camtop, you agree to these Terms.
                </p>
                <p>
                  If you are using Camtop on behalf of a company or organization, you represent that you have authority to bind that organization.
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="eligibility"
              title="Eligibility & Account Registration"
              description="Who can use Camtop and how accounts are managed"
              icon={UserCheck}
              isExpanded={expandedSections.has("eligibility")}
              onToggle={() => toggleSection("eligibility")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <ul className="space-y-2 ml-4">
                  {[
                    "You must be permitted by your organization to access Camtop.",
                    "You must provide accurate account information and keep it updated.",
                    "You are responsible for keeping your login credentials secure.",
                    "You may not share accounts or access accounts you are not authorized to use.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-800 dark:text-amber-300">
                    Your organization may suspend or revoke access at any time based on internal policies or security requirements.
                  </AlertDescription>
                </Alert>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="service-scope"
              title="Service Scope (Camtop Valuation Platform)"
              description="What Camtop does and does not do"
              icon={Landmark}
              isExpanded={expandedSections.has("service-scope")}
              onToggle={() => toggleSection("service-scope")}
            >
              <div className="space-y-5 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  Camtop provides tools to manage valuation workflows, including collecting property inputs, managing comparable references,
                  generating reports, and enforcing role-based approvals.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard
                    title="Included (examples)"
                    icon={Server}
                    items={[
                      "Create and manage property records and valuation cases",
                      "Attach documents, photos, and evidence notes",
                      "Comparable reference workflows and verification states",
                      "Generate valuation reports and export files (as configured)",
                      "Role/permission-based access and audit activity logs",
                    ]}
                  />
                  <InfoCard
                    title="Not included (examples)"
                    icon={Globe}
                    items={[
                      "Guaranteed market accuracy or automated final appraisal decisions",
                      "Legal advice, regulatory certification, or licensing",
                      "Third-party data ownership/availability guarantees",
                      "Verification of title authenticity unless done by your organization",
                      "Any promise that outputs are accepted by banks or authorities",
                    ]}
                  />
                </div>

                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    Valuation outputs depend on evidence and inputs from authorized users. Final responsibility remains with the approving professional(s).
                  </AlertDescription>
                </Alert>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="acceptable-use"
              title="Acceptable Use"
              description="Rules to protect users and the platform"
              icon={Shield}
              isExpanded={expandedSections.has("acceptable-use")}
              onToggle={() => toggleSection("acceptable-use")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>You agree not to misuse Camtop. Misuse includes, but is not limited to:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniRule
                    title="Unauthorized access"
                    text="Attempting to access records, features, or accounts you are not permitted to access."
                  />
                  <MiniRule
                    title="Security interference"
                    text="Probing, scanning, or testing vulnerabilities; bypassing access controls; or introducing malware."
                  />
                  <MiniRule
                    title="Data abuse"
                    text="Uploading illegal content, confidential data without authorization, or content you do not have rights to share."
                  />
                  <MiniRule
                    title="Service disruption"
                    text="Overloading systems, scraping without permission, or interfering with normal operations."
                  />
                </div>

                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
                  <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-300">
                    Violations may lead to suspension, termination, and/or legal action depending on severity and applicable law.
                  </AlertDescription>
                </Alert>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="data-privacy"
              title="Privacy & Data"
              description="How privacy policy relates to these Terms"
              icon={Lock}
              isExpanded={expandedSections.has("data-privacy")}
              onToggle={() => toggleSection("data-privacy")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  Our Privacy Policy explains how we collect, use, and protect information. By using Camtop you agree to both these Terms
                  and the Privacy Policy.
                </p>
                <p>
                  Your organization may determine what data is uploaded to the platform and who can access it. You must follow your organization’s
                  policies when handling property and valuation information.
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="payments"
              title="Plans, Billing & Payments"
              description="If your organization is on a paid plan"
              icon={CreditCard}
              isExpanded={expandedSections.has("payments")}
              onToggle={() => toggleSection("payments")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <ul className="space-y-2 ml-4">
                  {[
                    "Paid plans (if applicable) are billed to your organization based on your agreed subscription terms.",
                    "Taxes, withholding, or other charges may apply based on Cambodia requirements or billing address.",
                    "Failure to pay may result in service suspension after reasonable notice (as permitted by contract).",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="intellectual-property"
              title="Intellectual Property"
              description="Who owns what"
              icon={Scale}
              isExpanded={expandedSections.has("intellectual-property")}
              onToggle={() => toggleSection("intellectual-property")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <ul className="space-y-2 ml-4">
                  {[
                    "Camtop (and its licensors) owns the platform software, UI, and brand assets.",
                    "Your organization (or users) retains ownership of content uploaded to the platform, subject to any licenses needed to operate Camtop.",
                    "You grant Camtop a limited license to host, process, and display your content solely to provide the service.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="disclaimers"
              title="Disclaimers"
              description="Important legal disclaimers"
              icon={AlertCircle}
              isExpanded={expandedSections.has("disclaimers")}
              onToggle={() => toggleSection("disclaimers")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  Camtop is provided “as is” and “as available” without warranties of any kind, except to the extent such disclaimers are not permitted by law.
                </p>
                <ul className="space-y-2 ml-4">
                  {[
                    "We do not warrant that valuations are accurate or accepted by third parties.",
                    "We do not warrant uninterrupted or error-free operation.",
                    "Third-party services or integrations may be subject to downtime or changes outside our control.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="limitation"
              title="Limitation of Liability"
              description="Limits (subject to applicable law)"
              icon={Ban}
              isExpanded={expandedSections.has("limitation")}
              onToggle={() => toggleSection("limitation")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  To the maximum extent permitted by applicable law, Camtop will not be liable for indirect, incidental, special, consequential, or punitive damages,
                  or any loss of profits, revenue, data, or business opportunities.
                </p>
                <p>
                  If liability cannot be excluded, it will be limited to the amount paid to Camtop for the service during the relevant period (if applicable),
                  or the minimum allowed by law.
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="termination"
              title="Termination"
              description="How access can end"
              icon={RefreshCw}
              isExpanded={expandedSections.has("termination")}
              onToggle={() => toggleSection("termination")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <ul className="space-y-2 ml-4">
                  {[
                    "Your organization may terminate or suspend your access at any time.",
                    "Camtop may suspend or terminate access for security, legal compliance, or breach of these Terms.",
                    "Upon termination, access to the platform may stop, and data handling will follow contractual terms and retention obligations.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="governing-law"
              title="Governing Law (Cambodia)"
              description="Legal framework"
              icon={Gavel}
              isExpanded={expandedSections.has("governing-law")}
              onToggle={() => toggleSection("governing-law")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  These Terms are governed by the laws of Cambodia, without regard to conflict of law principles, unless otherwise required by applicable law or contract.
                </p>
                <p>
                  Disputes should first be attempted to be resolved informally by contacting Camtop Support.
                </p>
              </div>
            </CollapsibleSection>

            {/* Contact */}
            <Card
              id="contact"
              className="scroll-mt-28 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-violet-900 dark:text-violet-100">
                  <Mail className="w-5 h-5" />
                  Contact Camtop Support
                </CardTitle>
                <CardDescription>
                  For questions about these Terms, billing, or platform access.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <ContactCard
                    icon={Mail}
                    title="Email"
                    value={CAMTOP_SUPPORT.email}
                    href={`mailto:${CAMTOP_SUPPORT.email}`}
                    rightAction={
                      <CopyButton
                        copied={copied === "email"}
                        onCopy={() => copyToClipboard(CAMTOP_SUPPORT.email, "email")}
                      />
                    }
                  />
                  <ContactCard
                    icon={Phone}
                    title="Phone"
                    value={CAMTOP_SUPPORT.phone}
                    href={`tel:${CAMTOP_SUPPORT.phone.replace(/[^0-9+]/g, "")}`}
                    rightAction={
                      <CopyButton
                        copied={copied === "phone"}
                        onCopy={() => copyToClipboard(CAMTOP_SUPPORT.phone, "phone")}
                      />
                    }
                  />
                  <ContactCard
                    icon={MapPin}
                    title="Address"
                    value={CAMTOP_SUPPORT.address}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button className="sm:flex-1" asChild>
                    <a href={`mailto:${CAMTOP_SUPPORT.email}?subject=Terms%20Question%20-%20Camtop`}>
                      Email Camtop Support
                    </a>
                  </Button>
                  <Button variant="outline" className="sm:flex-1" asChild>
                    <Link href="/dashboard/help">View Help Center</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="mt-12 text-center text-slate-500 dark:text-slate-400 text-sm print:text-black">
              <p>© 2026 Camtop Property (Cambodia). All rights reserved.</p>
              <p className="mt-2">Version: {VERSION}.0</p>
            </div>
          </main>
        </div>
      </div>

      {/* Scroll to Top */}
      <Button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-6 right-6 rounded-full w-12 h-12 shadow-lg print:hidden transition-all duration-300 bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600",
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
        size="icon"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  );
}

/** -------------------------
 *  Components
 *  ------------------------- */
interface CollapsibleSectionProps {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  id,
  title,
  description,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card id={id} className="mb-6 scroll-mt-28 overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50">
                  <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">{title}</CardTitle>
                  {description ? (
                    <CardDescription className="mt-1 line-clamp-2">
                      {description}
                    </CardDescription>
                  ) : null}
                </div>
              </div>
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function InfoCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50">
          <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniRule({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCopy();
      }}
      className="h-8 w-8"
      aria-label="Copy"
      title="Copy"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

interface ContactCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  href?: string;
  rightAction?: React.ReactNode;
}

function ContactCard({ icon: Icon, title, value, href, rightAction }: ContactCardProps) {
  const content = (
    <div className="relative flex flex-col items-center p-4 rounded-xl bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 transition-colors text-center">
      {rightAction ? <div className="absolute top-2 right-2">{rightAction}</div> : null}
      <Icon className="w-6 h-6 text-violet-600 dark:text-violet-400 mb-2" />
      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{title}</p>
      <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 break-words">{value}</p>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded-xl">
        {content}
      </a>
    );
  }
  return content;
}
