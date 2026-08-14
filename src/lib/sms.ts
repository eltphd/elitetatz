// Thin Dialpad SMS wrapper — fetch-based, best-effort.
// Fires only when DIALPAD_API_TOKEN + DIALPAD_FROM_NUMBER are set; otherwise
// it's a no-op, so nothing breaks before the artist wires their number.
// A missing key or a Dialpad outage must never fail the request that triggers it.

interface SendSmsArgs {
  to: string        // E.164, e.g. +16148585574
  text: string
}

export async function sendSms({ to, text }: SendSmsArgs): Promise<boolean> {
  const token = process.env.DIALPAD_API_TOKEN
  const from = process.env.DIALPAD_FROM_NUMBER
  if (!token || !from || !to) return false

  try {
    const res = await fetch('https://dialpad.com/api/v2/sms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: from,
        to_numbers: [to],
        text: text.slice(0, 1000),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
