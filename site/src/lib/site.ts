export const SITE = {
  origin: "https://lookme.anme.cc",
  name: "Lumi Eye Companion",
  productName: "Lumi",
  description:
    "Lumi detects complete blinks on your device and reminds you after a long gap. It also supports distance and stand-up breaks on macOS, Windows, and Linux.",
  repository: "https://github.com/build-my-work/look-me",
  releases: "https://github.com/build-my-work/look-me/releases/latest",
  image: "/assets/preview-workspace.webp",
} as const;

export type Locale = "en" | "zh-CN";

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.productName,
  alternateName: "Lumi Eye Companion",
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
    "On-device complete blink detection",
    "Reminders after a prolonged gap between detected blinks",
    "20-20-20 eye break reminders",
    "Sedentary reminders",
    "On-device camera processing",
    "Thirty-day local activity history",
  ],
};

export const chineseSoftwareApplicationSchema = {
  ...softwareApplicationSchema,
  alternateName: "Lumi 眨眼提醒",
  inLanguage: "zh-CN",
  description:
    "Lumi 在本机检测完整眨眼，长时间没有检测到眨眼时会发出提醒。还支持 20-20-20 远眺和久坐提醒。",
  featureList: [
    "本机完整眨眼检测",
    "长时间未检测到眨眼时提醒",
    "20-20-20 远眺提醒",
    "久坐提醒",
    "摄像头画面仅在本机内存处理",
    "最近 30 天的本地行为记录",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  alternateName: [SITE.productName, "Lumi Eye Companion", "Lumi 护眼伙伴"],
  url: SITE.origin,
};

export const chineseWebsiteSchema = {
  ...websiteSchema,
  name: "Lumi 眨眼提醒",
  inLanguage: "zh-CN",
};

export function languageAlternates(englishPath: string, chinesePath: string) {
  return [
    { hreflang: "en", path: englishPath },
    { hreflang: "zh-Hans", path: chinesePath },
    { hreflang: "x-default", path: englishPath },
  ];
}

export function articleSchema({
  title,
  description,
  path,
  dateModified = "2026-08-25",
  citations = [],
  locale = "en",
}: {
  title: string;
  description: string;
  path: string;
  dateModified?: string;
  citations?: string[];
  locale?: Locale;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: locale === "zh-CN" ? "zh-CN" : "en",
    mainEntityOfPage: `${SITE.origin}${path}`,
    image: `${SITE.origin}${SITE.image}`,
    datePublished: "2026-08-25",
    dateModified,
    author: {
      "@type": "Organization",
      name: locale === "zh-CN" ? "Lumi 项目" : "Lumi project",
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
