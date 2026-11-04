import { connectionRows, connectionSummary } from '@/lib/connection-status'

const FULL = {
  ANTHROPIC_API_KEY: 'k', MATCH_TOKEN_SECRET: 's',
  RESEND_API_KEY: 'k', RESEND_WEBHOOK_SECRET: 'whsec', INBOUND_EMAIL_ADDRESS: 'leads@inbox.rawsunart.com',
  CHATWOOT_URL: 'https://app.chatwoot.com', CHATWOOT_ACCOUNT_ID: '1', CHATWOOT_API_TOKEN: 't', CHATWOOT_WEBHOOK_SECRET: 'w',
  DIALPAD_WEBHOOK_SECRET: 'd', DIALPAD_API_TOKEN: 't', DIALPAD_FROM_NUMBER: '+16145550100',
  GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'sec', GOOGLE_TOKEN_KEY: 'key',
  GOOGLE_REVIEW_URL: 'https://g.page/r/x/review',
}

describe('connectionRows', () => {
  it('lists the seven channels in order, the web form always on', () => {
    const rows = connectionRows({})
    expect(rows.map((r) => r.key)).toEqual(['web', 'concierge', 'email', 'social', 'sms', 'google', 'review'])
    expect(rows[0]).toMatchObject({ key: 'web', status: 'always', env: [], missing: [] })
  })

  it('is off with nothing set, naming every missing variable', () => {
    const rows = connectionRows({})
    for (const r of rows.slice(1)) {
      expect(r.status).toBe('off')
      expect(r.missing).toEqual(r.env)
    }
    expect(connectionSummary(rows)).toEqual({ connected: 1, total: 7 })
  })

  it('is on when every variable of a channel is set', () => {
    const rows = connectionRows(FULL)
    expect(rows.every((r) => r.status !== 'off')).toBe(true)
    expect(rows.every((r) => r.missing.length === 0)).toBe(true)
    expect(connectionSummary(rows)).toEqual({ connected: 7, total: 7 })
  })

  it('needs the whole set: one missing variable keeps the channel off, and says which', () => {
    const rows = connectionRows({ ...FULL, CHATWOOT_WEBHOOK_SECRET: '', DIALPAD_API_TOKEN: '   ' })
    const social = rows.find((r) => r.key === 'social')!
    const sms = rows.find((r) => r.key === 'sms')!
    expect(social.status).toBe('off')
    expect(social.missing).toEqual(['CHATWOOT_WEBHOOK_SECRET'])
    expect(sms.status).toBe('off')
    expect(sms.missing).toEqual(['DIALPAD_API_TOKEN'])
    expect(rows.find((r) => r.key === 'email')!.status).toBe('on')
  })

  it('matches the gates the routes enforce', () => {
    // The inbound routes answer 503 without their webhook secret; the concierge without its model key.
    const byKey = (env: Record<string, string>) => Object.fromEntries(connectionRows(env).map((r) => [r.key, r]))
    expect(byKey({ ...FULL, RESEND_WEBHOOK_SECRET: '' }).email.status).toBe('off')
    expect(byKey({ ...FULL, DIALPAD_WEBHOOK_SECRET: '' }).sms.status).toBe('off')
    expect(byKey({ ...FULL, CHATWOOT_WEBHOOK_SECRET: '' }).social.status).toBe('off')
    expect(byKey({ ...FULL, ANTHROPIC_API_KEY: '' }).concierge.status).toBe('off')
    expect(byKey({ ...FULL, GOOGLE_REVIEW_URL: '' }).review.status).toBe('off')
  })

  it('says who does each step, and that only Instagram and Google need her to log in', () => {
    const rows = connectionRows(FULL)
    expect(rows.filter((r) => r.artistLogsIn).map((r) => r.key)).toEqual(['social', 'google'])
    for (const r of rows) {
      expect(r.unlocks.length).toBeGreaterThan(20)
      expect(r.who.length).toBeGreaterThan(5)
    }
  })

  it('never carries a value, only names', () => {
    const rows = connectionRows(FULL)
    const text = JSON.stringify(rows)
    for (const v of ['whsec', 'leads@inbox.rawsunart.com', '+16145550100', 'https://g.page/r/x/review', 'app.chatwoot.com']) {
      expect(text).not.toContain(v)
    }
  })

  it('reads process.env by default', () => {
    const before = process.env.GOOGLE_REVIEW_URL
    process.env.GOOGLE_REVIEW_URL = 'https://example.test/review'
    try {
      expect(connectionRows().find((r) => r.key === 'review')!.status).toBe('on')
    } finally {
      if (before === undefined) delete process.env.GOOGLE_REVIEW_URL
      else process.env.GOOGLE_REVIEW_URL = before
    }
  })
})
