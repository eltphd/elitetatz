// Thin Dialpad SMS wrapper — fetch-based, best-effort.
// Fires only when DIALPAD_API_TOKEN + DIALPAD_FROM_NUMBER are set; otherwise
// a no-op. A missing key or a Dialpad outage must never fail the request.
interface SendSmsArgs { to: string; text: string }

export async function sendSms({ to, text }: SendSmsArgs): Promise<boolean> {
  const token = process.env.DIALPAD_API_TOKEN
  const from = process.env.DIALPAD_FROM_NUMBER
  if (!token || !from || !to) return false
  try {
    const res = await fetch('https://dialpad.com/api/v2/sms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_number: from, to_numbers: [to], text: text.slice(0, 1000) }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  if (d.length > 11) return `+${d}`
  return null
}
