"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Shield,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  FileText,
  Users,
  Database,
  Share2,
  Lock,
  UserCheck,
  Clock,
  Baby,
  RefreshCw,
  Printer,
  ArrowUp,
  List,
  Eye,
  EyeOff,
  Copy,
  Check,
  Landmark,
  FileSignature,
  Gavel,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
}

const sections: Section[] = [
  { id: "introduction", title: "Introduction", icon: FileText },
  { id: "valuation-notice", title: "Camtop Property Valuation (Cambodia)", icon: Landmark },
  { id: "information-collect", title: "Information We Collect", icon: Database },
  { id: "how-we-use", title: "How We Use Information", icon: Eye },
  { id: "information-sharing", title: "Information Sharing", icon: Share2 },
  { id: "data-security", title: "Data Security", icon: Lock },
  { id: "your-rights", title: "Your Rights", icon: UserCheck },
  { id: "data-retention", title: "Data Retention", icon: Clock },
  { id: "children-privacy", title: "Children’s Privacy", icon: Baby },
  { id: "policy-changes", title: "Policy Changes", icon: RefreshCw },
  { id: "contact", title: "Contact Camtop Support", icon: Mail },
];

// ✅ Camtop Support (replace with your real values)
const CAMTOP_SUPPORT = {
  email: "support@camtopproperty.site",
  phone: "+855 (0)XX XXX XXX",
  address: "Phnom Penh, Cambodia",
};

const LAST_UPDATED = "January 20, 2026";
const VERSION = "2.0";

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showTableOfContents, setShowTableOfContents] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );

  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  /** ---------------------------------
   *  Active section via IntersectionObserver
   *  --------------------------------- */
  useEffect(() => {
    const ids = sections.map((s) => s.id);
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
      {
        root: null,
        rootMargin: "-120px 0px -70% 0px",
        threshold: [0, 0.1, 0.25],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /** ---------------------------------
   *  Scroll Top + Reading Progress
   *  --------------------------------- */
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
    setExpandedSections(new Set(sections.map((s) => s.id)));
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
            <Shield className="w-10 h-10 md:w-12 md:h-12" />
            <h1 className="text-3xl md:text-5xl font-bold">Privacy Policy</h1>
          </div>

          <p className="text-center text-violet-100 text-base md:text-lg">
            Camtop Property Valuation Platform — Cambodia
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Badge
              variant="secondary"
              className="text-sm bg-white/20 text-white border-white/30"
            >
              Last Updated: {LAST_UPDATED}
            </Badge>
            <Badge
              variant="secondary"
              className="text-sm bg-white/20 text-white border-white/30"
            >
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
                    Tip: Use the table of contents to jump between sections.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <ScrollArea className="h-auto max-h-[60vh]">
                    <nav className="space-y-1">
                      {sections.map((section) => {
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
            {/* Valuation Notice */}
            <Alert className="mb-8 border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 print:hidden">
              <FileSignature className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <AlertTitle className="text-violet-900 dark:text-violet-200">
                Camtop Property Valuation & Data Notice (Cambodia)
              </AlertTitle>
              <AlertDescription className="text-violet-800 dark:text-violet-300">
                Camtop may process valuation inputs and outputs such as property location, land/building attributes,
                comparable references, documents, and generated reports. Access is restricted using roles and permissions,
                with audit trails for critical actions.
              </AlertDescription>
            </Alert>

            {/* Introduction */}
            <CollapsibleSection
              id="introduction"
              title="Introduction"
              icon={FileText}
              isExpanded={expandedSections.has("introduction")}
              onToggle={() => toggleSection("introduction")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  This Privacy Policy explains how Camtop Property Valuation Platform (“Camtop”, “we”, “us”) collects,
                  uses, shares, and protects information when you use our website and services in Cambodia.
                </p>
                <p>
                  By accessing or using the platform, you agree to the practices described in this policy. If you do not
                  agree, please do not use the platform.
                </p>
              </div>
            </CollapsibleSection>

            {/* Valuation Notice Section */}
            <CollapsibleSection
              id="valuation-notice"
              title="Camtop Property Valuation in Cambodia"
              description="How valuation information is handled inside the platform"
              icon={Landmark}
              isExpanded={expandedSections.has("valuation-notice")}
              onToggle={() => toggleSection("valuation-notice")}
            >
              <div className="space-y-5 text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  Camtop supports valuation workflows for Cambodia (e.g., residential, commercial, and land). Valuation
                  data may include property details, comparables, adjustments, verification notes, and report outputs.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ValuationInfoCard
                    title="What we store"
                    icon={Database}
                    items={[
                      "Property details: address/coordinates, land size, building size, features and condition",
                      "Comparable references: sale/rent evidence, adjustments, verification status",
                      "Documents: title/deed evidence and valuation attachments uploaded by authorized users",
                      "Reports: exports (PDF), audit metadata (who/when), workflow status and approvals",
                    ]}
                  />
                  <ValuationInfoCard
                    title="Who can access"
                    icon={UserCheck}
                    items={[
                      "Role-based access control (RBAC) limits access by job function",
                      "Only authorized staff can create/verify comparables or approve valuation outputs",
                      "Administrators may audit activities to support compliance and governance",
                      "Critical actions may be logged (view, edit, export, approve) for accountability",
                    ]}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <MiniInfo
                    icon={Fingerprint}
                    title="Audit Trails"
                    text="We record certain actions to help detect unauthorized access and support investigations."
                  />
                  <MiniInfo
                    icon={ShieldCheck}
                    title="Access Controls"
                    text="Permissions determine who can view, edit, export, approve, or delete valuation records."
                  />
                  <MiniInfo
                    icon={Gavel}
                    title="Professional Responsibility"
                    text="Valuation outputs depend on evidence and inputs. Final responsibility remains with authorized professionals."
                  />
                </div>

                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    Camtop is a workflow platform. Final valuation conclusions should be reviewed and approved by
                    authorized professionals according to applicable standards and organizational policies.
                  </AlertDescription>
                </Alert>
              </div>
            </CollapsibleSection>

            {/* Information We Collect */}
            <CollapsibleSection
              id="information-collect"
              title="Information We Collect"
              description="What we collect to run and improve the platform"
              icon={Database}
              isExpanded={expandedSections.has("information-collect")}
              onToggle={() => toggleSection("information-collect")}
            >
              <div className="space-y-6">
                <InfoSubsection
                  title="Account & identity information"
                  description="Information you provide when creating and managing an account."
                  items={[
                    "Name, email address, phone number (if provided)",
                    "Login credentials (stored securely using hashing)",
                    "Role assignment and access configuration (RBAC)",
                  ]}
                />

                <Separator className="dark:bg-slate-700" />

                <InfoSubsection
                  title="Property and valuation information"
                  description="Information used to perform valuation workflows and produce reports."
                  items={[
                    "Property location, address, geolocation (if provided), and neighborhood context",
                    "Land/building specifications, photos, and supporting documents",
                    "Comparable data and evidence notes provided by authorized users",
                    "Generated valuation reports, export files, workflow approvals and audit logs",
                  ]}
                />

                <Separator className="dark:bg-slate-700" />

                <InfoSubsection
                  title="Usage and technical information"
                  description="Information collected automatically to secure and improve the platform."
                  items={[
                    "Device and browser information, IP address (subject to system logging policies)",
                    "Log data (e.g., pages visited, actions performed) for security monitoring",
                    "Cookies or similar technologies for authentication and session management",
                  ]}
                />
              </div>
            </CollapsibleSection>

            {/* How We Use */}
            <CollapsibleSection
              id="how-we-use"
              title="How We Use Information"
              icon={Eye}
              isExpanded={expandedSections.has("how-we-use")}
              onToggle={() => toggleSection("how-we-use")}
            >
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We use information to operate the service, deliver valuation workflows, and protect the platform.
              </p>
              <ul className="space-y-3">
                {[
                  "Provide authentication, user management, and role-based access",
                  "Create, manage, and export valuation workflows and reports",
                  "Maintain audit logs for security and governance",
                  "Detect abuse, fraud, or unauthorized access",
                  "Improve performance, reliability, and user experience",
                  "Comply with legal obligations and respond to lawful requests",
                ].map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>

            {/* Sharing */}
            <CollapsibleSection
              id="information-sharing"
              title="Information Sharing"
              icon={Share2}
              isExpanded={expandedSections.has("information-sharing")}
              onToggle={() => toggleSection("information-sharing")}
            >
              <p className="text-slate-700 dark:text-slate-300 mb-6">
                We do not sell your personal information. We may share information in the limited cases below:
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <SharingCard
                  title="With your organization"
                  description="Authorized users within your organization may access data based on role and permissions."
                  icon={Users}
                />
                <SharingCard
                  title="Service providers"
                  description="We may use hosting, storage, or email providers to operate the platform under contractual safeguards."
                  icon={Database}
                />
                <SharingCard
                  title="Legal requirements"
                  description="We may disclose information when required by law or valid legal process."
                  icon={Gavel}
                />
                <SharingCard
                  title="Business operations"
                  description="We may share information for security, fraud prevention, audits, and system integrity."
                  icon={Shield}
                />
              </div>
            </CollapsibleSection>

            {/* Security */}
            <CollapsibleSection
              id="data-security"
              title="Data Security"
              icon={Lock}
              isExpanded={expandedSections.has("data-security")}
              onToggle={() => toggleSection("data-security")}
            >
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We use administrative, technical, and physical safeguards to protect data.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                {[
                  { icon: Lock, text: "Encryption in transit where supported (TLS) and secure storage practices" },
                  { icon: Shield, text: "Access control using roles and permissions (RBAC)" },
                  { icon: UserCheck, text: "Least-privilege access for staff and operational accounts" },
                  { icon: Fingerprint, text: "Audit logs for critical events and administrative actions" },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                  >
                    <item.icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  No system can be guaranteed 100% secure. If you suspect unauthorized access, contact Camtop Support immediately.
                </AlertDescription>
              </Alert>
            </CollapsibleSection>

            {/* Rights */}
            <CollapsibleSection
              id="your-rights"
              title="Your Rights"
              icon={UserCheck}
              isExpanded={expandedSections.has("your-rights")}
              onToggle={() => toggleSection("your-rights")}
            >
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Depending on your relationship with the platform and applicable requirements, you may request:
              </p>

              <div className="space-y-3">
                {[
                  { label: "Access", desc: "Request a copy of certain personal information we hold about you." },
                  { label: "Correction", desc: "Request corrections to inaccurate or incomplete information." },
                  { label: "Deletion", desc: "Request deletion in certain situations, subject to retention obligations." },
                  { label: "Restriction", desc: "Request limitation of processing where appropriate." },
                  { label: "Objection", desc: "Object to certain processing where applicable." },
                  { label: "Portability", desc: "Request export of information in a usable format when available." },
                ].map((right) => (
                  <div
                    key={right.label}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Badge
                      variant="secondary"
                      className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 flex-shrink-0"
                    >
                      {right.label}
                    </Badge>
                    <span className="text-slate-700 dark:text-slate-300 text-sm">
                      {right.desc}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-slate-600 dark:text-slate-400 text-sm mt-4 italic">
                For requests, contact Camtop Support using the details below.
              </p>
            </CollapsibleSection>

            {/* Retention */}
            <CollapsibleSection
              id="data-retention"
              title="Data Retention"
              icon={Clock}
              isExpanded={expandedSections.has("data-retention")}
              onToggle={() => toggleSection("data-retention")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300">
                <p>
                  We retain information for as long as needed to provide the service, maintain security, meet legal obligations,
                  resolve disputes, and enforce agreements.
                </p>
                <p>
                  Retention can vary by record type (e.g., valuation reports, audit logs, user accounts) and organizational policies.
                </p>
              </div>
            </CollapsibleSection>

            {/* Children */}
            <CollapsibleSection
              id="children-privacy"
              title="Children’s Privacy"
              icon={Baby}
              isExpanded={expandedSections.has("children-privacy")}
              onToggle={() => toggleSection("children-privacy")}
            >
              <p className="text-slate-700 dark:text-slate-300">
                Camtop is not intended for use by children. We do not knowingly collect personal information from children.
              </p>
            </CollapsibleSection>

            {/* Changes */}
            <CollapsibleSection
              id="policy-changes"
              title="Policy Changes"
              icon={RefreshCw}
              isExpanded={expandedSections.has("policy-changes")}
              onToggle={() => toggleSection("policy-changes")}
            >
              <div className="space-y-4 text-slate-700 dark:text-slate-300">
                <p>
                  We may update this policy from time to time to reflect product updates, compliance requirements, or operational changes.
                </p>
                <p>
                  When we update this policy, we will revise the “Last Updated” date above. Continued use of the platform indicates acceptance.
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
                  For privacy questions, data requests, or valuation workflow support.
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
                    <a
                      href={`mailto:${CAMTOP_SUPPORT.email}?subject=Privacy%20Request%20-%20Camtop`}
                    >
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
              <p className="mt-2">Version: 2.0.0</p>
            </div>
          </main>
        </div>
      </div>

      {/* Scroll to Top */}
      <Button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-6 right-6 rounded-full w-12 h-12 shadow-lg print:hidden transition-all duration-300 bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600",
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
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

function InfoSubsection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-400 mb-3">{description}</p>
      <ul className="space-y-2 ml-4">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-slate-700 dark:text-slate-300"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SharingCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

function MiniInfo({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50">
          <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}

function ValuationInfoCard({
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
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
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

function ContactCard({
  icon: Icon,
  title,
  value,
  href,
  rightAction,
}: ContactCardProps) {
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
      <a
        href={href}
        className="block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded-xl"
      >
        {content}
      </a>
    );
  }

  return content;
}
