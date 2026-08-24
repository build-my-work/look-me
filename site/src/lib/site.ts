export const SITE = {
  origin: "https://lookme.anme.cc",
  name: "Look Me Eye Companion",
  productName: "Look Me",
  description:
    "A private, context-aware blink, eye-break, and posture reminder for macOS, Windows, and Linux.",
  repository: "https://github.com/build-my-work/look-me",
  releases: "https://github.com/build-my-work/look-me/releases/latest",
  image: "/assets/preview-workspace.webp",
} as const;

export type Locale = "en" | "zh-CN";

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.productName,
  alternateName: "Look Me Eye Companion",
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Screen break and blink reminder",
  operatingSystem: "macOS 12+, Windows 10+, Linux",
  description: SITE.description,
  url: SITE.origin,
  downloadUrl: SITE.releases,
  image: `${SITE.origin}${SITE.image}`,
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "Context-aware blink reminders",
    "20-20-20 eye break reminders",
    "Sedentary reminders",
    "On-device camera processing",
    "Thirty-day local activity history",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  alternateName: [SITE.productName, "Look Me 看看我"],
  url: SITE.origin,
};

export function articleSchema({
  title,
  description,
  path,
  dateModified = "2026-08-25",
  citations = [],
}: {
  title: string;
  description: string;
  path: string;
  dateModified?: string;
  citations?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: `${SITE.origin}${path}`,
    image: `${SITE.origin}${SITE.image}`,
    datePublished: "2026-08-25",
    dateModified,
    author: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.origin,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE.origin}/assets/icon-512.png`,
      },
    },
    citation: citations,
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE.origin}${item.path}`,
    })),
  };
}
