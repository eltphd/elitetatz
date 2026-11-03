import type { MetadataRoute } from 'next'
import { appUrl } from '@/lib/tokens'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${appUrl()}/artists`, changeFrequency: 'monthly', priority: 0.8 }]
}
