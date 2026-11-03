// One line to #followups-needed. Best-effort and optional: with no webhook set
// the function returns false and nothing else happens. The line carries no
// client name, address or words; it points the operator at the inbox.
export async function postFollowup(text: string): Promise<boolean> {
  const url = process.env.SLACK_FOLLOWUPS_WEBHOOK?.trim()
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8_000),
    })
    return res.ok
  } catch (err) {
    console.warn('slack followup not posted', err)
    return false
  }
}
