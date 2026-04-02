export interface BreadcrumbSegment {
  label: string;
  href: string;
  isCurrentPage?: boolean;
}

/**
 * Converts a pathname into breadcrumb segments
 * Example: /dashboard/settings/profile -> [Dashboard, Settings, Profile]
 */
export function generateBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  // Remove leading/trailing slashes and split
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Home", href: "/", isCurrentPage: true }];
  }

  const breadcrumbs: BreadcrumbSegment[] = [];
  let currentPath = "";

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    breadcrumbs.push({
      label: formatSegmentLabel(segment),
      href: currentPath,
      isCurrentPage: isLast,
    });
  });

  return breadcrumbs;
}

/**
 * Formats a URL segment into a readable label
 * Example: "user-settings" -> "User Settings"
 */
function formatSegmentLabel(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
