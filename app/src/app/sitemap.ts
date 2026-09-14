import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:12000"


export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/signin`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/forgot-password`, changeFrequency: "yearly", priority: 0.1 },
  ]
}
