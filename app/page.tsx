/**
 * PUBLIC status page at the site root (/) — live health of every Elixpo
 * product, derived from Cloudflare edge analytics (per-host status codes).
 * No third-party uptime tool needed; this is Cloudflare-native.
 *
 * The SSR payload is built (and KV-cached) by buildStatus(); the client view
 * layers a 1h localStorage cache + manual refresh on top to minimise calls.
 */

import { buildStatus } from "@/lib/status-data";
import type { Metadata } from "next";
import StatusView from "./status-view";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const STATUS_TITLE = "Elixpo Status — Live service health & uptime";
const STATUS_DESC =
    "Real-time operational status, uptime history, and request health (2xx/3xx/4xx/5xx) for every Elixpo service — blogs, sketch, accounts, payouts, mail and more.";
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

export default async function StatusPage() {
    const initial = await buildStatus();
    return <StatusView initial={initial} />;
}
