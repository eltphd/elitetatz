/**
 * @jest-environment node
 */
// Nothing goes out on Lacey's number unless she sent it (Nov 20 2026). These
// pin the rule: automatic paths never text a client, even with Dialpad keys
// set; only her own inbox actions (sentByArtist) may.

const sendSms = jest.fn().mockResolvedValue(true)
jest.mock('@/lib/sms', () => ({
  sendSms: (...a: unknown[]) => sendSms(...a),
  toE164: (raw: string | null | undefined) => (raw ? '+16145550199' : null),
}))
jest.mock('@/lib/resend', () => ({ sendEmailDetailed: jest.fn().mockResolvedValue({ ok: true, id: 're_1' }) }))

import { execSync } from 'child_process'
import { notifyClient } from '@/lib/notify'

const base = { email: 'client@example.com', phone: '614-555-0199', subject: 's', text: 't', sms: 'hi' }

beforeEach(() => {
  sendSms.mockClear()
  process.env.DIALPAD_API_TOKEN = 'set'
  process.env.DIALPAD_FROM_NUMBER = '+16145550100'
})

test('an automatic send (no sentByArtist) never texts the client, even with Dialpad keys set', async () => {
  await notifyClient(base)
  expect(sendSms).not.toHaveBeenCalled()
})

test('a truthy-but-not-true flag does not count', async () => {
  await notifyClient({ ...base, sentByArtist: 'yes' as unknown as boolean })
  expect(sendSms).not.toHaveBeenCalled()
})

test('a send Lacey made from her inbox may text the client', async () => {
  await notifyClient({ ...base, sentByArtist: true })
  expect(sendSms).toHaveBeenCalledWith({ to: '+16145550199', text: 'hi' })
})

test('only the two signed-in inbox routes pass sentByArtist', () => {
  // A source scan, so a later edit that adds the flag to a timer, webhook or
  // public route fails here instead of texting someone.
  const files = execSync('grep -rl "sentByArtist: true" src || true', { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort()
  expect(files).toEqual(['src/app/api/dashboard/message/route.ts', 'src/app/api/dashboard/respond/route.ts'])
})
