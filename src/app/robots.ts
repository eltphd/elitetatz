import type { MetadataRoute } from 'next'
import { appUrl } from '@/lib/tokens'

// EliteTatz is Lacey's engine, not a second marketing site. rawsunart.com is
// the indexable surface; here only the artists page is meant to be found.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/artists'], disallow: ['/'] },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  }
}
