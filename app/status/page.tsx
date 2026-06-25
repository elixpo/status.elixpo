/**
 * PUBLIC status page (non-gated) — live health of every Elixpo product, derived
 * from Cloudflare edge analytics (per-host status codes). No third-party uptime
 * tool needed; this is Cloudflare-native.
 */

import { fetchChangelogs } from "@/lib/changelog";
import { discoverAccount } from "@/lib/discovery";
import { knownDomains, metaFor } from "@/lib/enrich";
import { lastHours, zoneBreakdown, zoneDailyUptime } from "@/lib/metrics";
import type { Metadata } from "next";
import StatusView, { type Health, type ProductStatus } from "./status-view";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const STATUS_TITLE = "Elixpo Status — Live service health & uptime";
const STATUS_DESC =
    "Real-time operational status, 90-day uptime history, and request health (2xx/3xx/4xx/5xx) for every Elixpo service — blogs, sketch, accounts, payouts, mail and more.";
const STATUS_URL = "https://status.elixpo.com";

export const metadata: Metadata = {
    title: STATUS_TITLE,
    description: STATUS_DESC,
    metadataBase: new URL("https://status.elixpo.com"),
    applicationName: "Elixpo Status",
    keywords: [
        "Elixpo",
        "status",
        "uptime",
        "service status",
        "incident",
        "operational status",
        "Elixpo status page",
    ],
    alternates: { canonical: STATUS_URL },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/icon.png", sizes: "32x32", type: "image/png" },
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
        apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    },
    openGraph: {
        type: "website",
        siteName: "Elixpo Status",
        title: STATUS_TITLE,
        description: STATUS_DESC,
        url: STATUS_URL,
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "Elixpo Status — live health of every Elixpo service",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: STATUS_TITLE,
        description: STATUS_DESC,
        images: ["/og-image.png"],
    },
};

function classify(status: { label: string; count: number }[]): {
    total: number;
    fivexx: number;
} {
    let total = 0;
    let fivexx = 0;
    for (const s of status) {
        const n = Number(s.label);
        total += s.count;
        if (n >= 500) fivexx += s.count;
    }
    return { total, fivexx };
}

function health(total: number, fivexx: number): Health {
    if (total === 0) return "idle";
    const ratio = fivexx / total;
    if (ratio < 0.02) return "operational";
    if (ratio < 0.1) return "degraded";
    return "outage";
}

export default async function StatusPage() {
    const inv = await discoverAccount();
    const w = lastHours(24);
    const zone = inv.zones.find((z) => z.name === "elixpo.com") || inv.zones[0];

    const [uptime, changelogs] = await Promise.all([
        zone
            ? zoneDailyUptime(zone.id, 90)
            : Promise.resolve({ available: false, days: [], uptimePct: 100 }),
        fetchChangelogs(6),
    ]);

    // Build the set of hosts to monitor: every custom domain from discovered
    // Pages projects, unioned with the known product domains in the registry.
    // The latter covers services served by Workers/routes (accounts, payouts,
    // mail, …) that never surface as Pages projects. Zone analytics is queried
    // per-host, so it works regardless of what serves the domain.
    const byDomain = new Map<string, { label: string; repo?: string }>();
    if (zone) {
        for (const p of inv.pages) {
            const domain = p.domains?.find((d) => !d.endsWith(".pages.dev"));
            if (!domain) continue;
            const meta = metaFor(p.name);
            byDomain.set(domain, { label: meta.label, repo: meta.repo });
        }
        for (const m of knownDomains()) {
            const inZone =
                m.domain === zone.name || m.domain.endsWith(`.${zone.name}`);
            if (inZone && !byDomain.has(m.domain)) {
                byDomain.set(m.domain, { label: m.label, repo: m.repo });
            }
        }
    }

    const products: ProductStatus[] = zone
        ? await Promise.all(
              [...byDomain.entries()].map(async ([domain, meta]) => {
                  const b = await zoneBreakdown(zone.id, w, domain);
                  const { total, fivexx } = classify(b.status);
                  return {
                      label: meta.label,
                      domain,
                      repo: meta.repo,
                      total,
                      fivexx,
                      availability:
                          total > 0 ? ((total - fivexx) / total) * 100 : 100,
                      health: health(total, fivexx),
                      status: b.status,
                  } as ProductStatus & { fivexx: number };
              }),
          )
        : [];

    // Show the busiest first.
    products.sort((a, b) => b.total - a.total);

    return (
        <StatusView
            products={products}
            uptime={uptime}
            changelogs={changelogs}
            fetchedAt={inv.fetchedAt}
        />
    );
}
