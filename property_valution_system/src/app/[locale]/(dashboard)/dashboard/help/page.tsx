"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Headphones,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
  category:
    | "account"
    | "user"
    | "property"
    | "propertyValuation"
    | "googleMap"
    | "workflow"
    | "support";
  keywords: string[];
};

type SupportChannel = {
  title: string;
  description: string;
  icon: LucideIcon;
  status: "available" | "busy";
  responseTime: string;
  contact: string;
  actionLabel: string;
  tone: string;
  href: string;
  external?: boolean;
};

const SUPPORT_EMAIL = "hengvanreuth.17@gmail.com";
const TELEGRAM_HANDLE = "@vanreuth";
const TELEGRAM_URL = "https://t.me/vanreuth";
const SUPPORT_MAIL_URL =
  "https://mail.google.com/mail/u/0/#inbox?compose=CllgCHrhThRTLbtbqltjDNjhbWHvLxmWDQBNBSJMVMwnmcfGvQDPLrSSXlxkkqnqxFHWqHdZjXq";

export default function HelpPage() {
  const t = useTranslations("helpPage");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const faqs = useMemo<FaqItem[]>(
    () => [
      {
        question: t("faqs.resetPassword.question"),
        answer: t("faqs.resetPassword.answer"),
        category: "account",
        keywords: t("faqs.resetPassword.keywords").split("|"),
      },
      {
        question: t("faqs.editProfile.question"),
        answer: t("faqs.editProfile.answer"),
        category: "account",
        keywords: t("faqs.editProfile.keywords").split("|"),
      },
      {
        question: t("faqs.changeProfilePicture.question"),
        answer: t("faqs.changeProfilePicture.answer"),
        category: "account",
        keywords: t("faqs.changeProfilePicture.keywords").split("|"),
      },
      {
        question: t("faqs.manageUsers.question"),
        answer: t("faqs.manageUsers.answer"),
        category: "user",
        keywords: t("faqs.manageUsers.keywords").split("|"),
      },
      {
        question: t("faqs.createProperty.question"),
        answer: t("faqs.createProperty.answer"),
        category: "property",
        keywords: t("faqs.createProperty.keywords").split("|"),
      },
      {
        question: t("faqs.createValuation.question"),
        answer: t("faqs.createValuation.answer"),
        category: "propertyValuation",
        keywords: t("faqs.createValuation.keywords").split("|"),
      },
      {
        question: t("faqs.googleMap.question"),
        answer: t("faqs.googleMap.answer"),
        category: "googleMap",
        keywords: t("faqs.googleMap.keywords").split("|"),
      },
      {
        question: t("faqs.workflow.question"),
        answer: t("faqs.workflow.answer"),
        category: "workflow",
        keywords: t("faqs.workflow.keywords").split("|"),
      },
      {
        question: t("faqs.contactSupport.question"),
        answer: t("faqs.contactSupport.answer", {
          email: SUPPORT_EMAIL,
          telegram: TELEGRAM_HANDLE,
        }),
        category: "support",
        keywords: t("faqs.contactSupport.keywords").split("|"),
      },
    ],
    [t]
  );

  const supportChannels = useMemo<SupportChannel[]>(
    () => [
      {
        title: t("supportChannels.email.title"),
        description: t("supportChannels.email.description"),
        icon: Mail,
        status: "available",
        responseTime: t("supportChannels.email.responseTime"),
        contact: SUPPORT_EMAIL,
        actionLabel: t("supportChannels.email.actionLabel"),
        tone: "bg-emerald-500/10 text-emerald-600",
        href: SUPPORT_MAIL_URL,
        external: true,
      },
      {
        title: t("supportChannels.telegram.title"),
        description: t("supportChannels.telegram.description"),
        icon: MessageCircle,
        status: "available",
        responseTime: t("supportChannels.telegram.responseTime"),
        contact: TELEGRAM_HANDLE,
        actionLabel: t("supportChannels.telegram.actionLabel"),
        tone: "bg-sky-500/10 text-sky-600",
        href: TELEGRAM_URL,
        external: true,
      },
    ],
    [t]
  );

  const categories = useMemo(
    () => [
      "all",
      ...Array.from(new Set(faqs.map((faq) => faq.category))).sort((a, b) =>
        a.localeCompare(b)
      ),
    ],
    [faqs]
  );

  const categoryLabel = (category: string) => t(`categories.${category}`);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scoped = faqs.filter(
      (faq) => activeCategory === "all" || faq.category === activeCategory
    );

    if (!query) return scoped;

    return scoped
      .map((faq) => {
        let score = 0;
        const localizedCategory = categoryLabel(faq.category).toLowerCase();
        if (faq.question.toLowerCase().includes(query)) score += 4;
        if (localizedCategory.includes(query)) score += 3;
        if (faq.answer.toLowerCase().includes(query)) score += 2;
        if (faq.keywords.some((keyword) => keyword.toLowerCase().includes(query))) {
          score += 3;
        }
        return { faq, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.faq);
  }, [activeCategory, faqs, searchQuery, t]);

  const hasSearchOrFilter = searchQuery.trim().length > 0 || activeCategory !== "all";

  return (
    <PermissionGuard hierarchyLevel={4} redirectTo="/dashboard">
      <div className="space-y-6 mb-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-background to-emerald-500/10 p-5 shadow-sm md:p-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground/90">{t("heroTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("heroDescription")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("directContact", { email: SUPPORT_EMAIL, telegram: TELEGRAM_HANDLE })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5 rounded-full px-3">
                  <Headphones className="h-3.5 w-3.5" />
                  {t("badges.assistance")}
                </Badge>
                <Badge variant="secondary" className="gap-1.5 rounded-full px-3">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t("badges.avgReply")}
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/60 px-3">
                  {t("badges.faqCount", { count: filteredFaqs.length, total: faqs.length })}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-3xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  className="h-11 border-border/60 bg-background/80 pl-10"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              {hasSearchOrFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                    setExpandedFaq(null);
                  }}
                >
                  {t("clear")}
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <Card className="border-border/60 bg-background/60 shadow-sm xl:col-span-7">
            <CardHeader className="space-y-3">
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                {t("faqTitle")}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={activeCategory === category ? "default" : "outline"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setActiveCategory(category)}
                  >
                    {categoryLabel(category)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, index) => (
                    <div
                      key={faq.question}
                      className={`rounded-xl border transition-colors ${
                        expandedFaq === faq.question
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-background/70 hover:bg-muted/40"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 p-4 text-left"
                        onClick={() =>
                          setExpandedFaq(expandedFaq === faq.question ? null : faq.question)
                        }
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full border-border/60 text-xs">
                              {categoryLabel(faq.category)}
                            </Badge>
                            {searchQuery.trim().length > 0 && index === 0 ? (
                              <Badge className="rounded-full px-2 text-[10px]">{t("topMatch")}</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium">{faq.question}</p>
                        </div>
                        {expandedFaq === faq.question ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {expandedFaq === faq.question ? (
                        <div className="px-4 pb-4">
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-10 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-background">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">{t("noMatchingFaqsTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("noMatchingFaqsDescription")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/60 shadow-sm xl:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5" />
                {t("getSupport")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {supportChannels.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <div
                      key={channel.title}
                      className="rounded-xl border border-border/60 bg-background/70 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className={`w-fit rounded-lg p-2.5 ${channel.tone}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{channel.title}</h4>
                            <Badge variant="secondary" className="rounded-full px-2 text-[10px]">
                              {t(`supportStatuses.${channel.status}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{channel.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("responseTimeLabel", { value: channel.responseTime })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("contactLabel", { value: channel.contact })}
                          </p>
                        </div>
                        {channel.external ? (
                          <Button asChild type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
                            <a href={channel.href} target="_blank" rel="noreferrer">
                              {channel.actionLabel}
                            </a>
                          </Button>
                        ) : (
                          <Button asChild type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
                            <Link href={channel.href}>{channel.actionLabel}</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
