/**
 * @jest-environment node
 */
import { normalizeEmail, emailRejectReason } from '@/lib/email-hygiene'

describe('sign-up address hygiene', () => {
  it('normalises case and whitespace', () => {
    expect(normalizeEmail('  Sam@Example.COM ')).toBe('sam@example.com')
    expect(normalizeEmail('not an email')).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })
  it('turns away role mailboxes', () => {
    expect(emailRejectReason('noreply@shop.com')).toBe('role')
    expect(emailRejectReason('info@shop.com')).toBe('role')
    expect(emailRejectReason('admin+tag@shop.com')).toBe('role')
    expect(emailRejectReason('test@shop.com')).toBe('role')
  })
  it('turns away disposable domains, including subdomains', () => {
    expect(emailRejectReason('sam@mailinator.com')).toBe('disposable')
    expect(emailRejectReason('sam@x.mailinator.com')).toBe('disposable')
  })
  it('keeps a personal address', () => {
    expect(emailRejectReason('sam.rivera@gmail.com')).toBeNull()
  })
})
