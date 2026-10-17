import { redirect } from 'next/navigation'

// The marketplace home is retired; the pilot starts on Lacey's page.
export default function Home() {
  redirect('/rawsunart')
}
