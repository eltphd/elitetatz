import type { MetadataRoute } from 'next'

// "Add to Home Screen" opens straight into the inbox. The root layout already
// declares the manifest and the Apple web-app meta tags.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RawSunArt Inbox',
    short_name: 'Inbox',
    description: 'Every inquiry, in one place.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
