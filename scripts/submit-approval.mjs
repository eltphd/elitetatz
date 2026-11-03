#!/usr/bin/env node
// Put something in Lacey's approvals queue (/dashboard/approvals).
//
//   node scripts/submit-approval.mjs --kind email_campaign --key rsa-reconnect-1 \
//     --title "Reconnect: it's Lacey. I made something." --subject "it's Lacey. I made something." \
//     --html out.html --text out.txt --audience "the list you reviewed Oct 16" --count 197 \
//     --summary "One email to the people you kept..."
//
//   node scripts/submit-approval.mjs --kind blog_post --key blog/2026-11-diary --title "..." --text post.md
//
//   node scripts/submit-approval.mjs --status rsa-reconnect-1      read her decision back
//
// Env: ELITETATZ_URL (default https://elitetatz.app), OPERATOR_API_KEY (same value as on Vercel).
// Submitting notifies Lacey that something is waiting. It sends nothing to anyone else.

import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
}
const argv = process.argv.slice(2)
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
const base = (process.env.ELITETATZ_URL ?? 'https://elitetatz.app').replace(/\/$/, '')
const key = process.env.OPERATOR_API_KEY
if (!key) { console.error('missing env OPERATOR_API_KEY'); process.exit(2) }

const status = opt('status')
if (status) {
  const res = await fetch(`${base}/api/approvals?key=${encodeURIComponent(status)}`, { headers: { 'x-operator-key': key } })
  console.log(res.status, await res.text())
  process.exit(res.ok ? 0 : 1)
}

const body = {
  kind: opt('kind'), key: opt('key'), title: opt('title'), subject: opt('subject'), summary: opt('summary'),
  audience: opt('audience'), audience_count: opt('count') ? Number(opt('count')) : undefined,
  body_html: opt('html') ? readFileSync(opt('html'), 'utf8') : undefined,
  body_text: opt('text') ? readFileSync(opt('text'), 'utf8') : undefined,
  submitted_by: process.env.USER ?? 'operator',
}
if (!body.kind || !body.key || !body.title) { console.error('need --kind, --key, --title and --html or --text'); process.exit(2) }
const res = await fetch(`${base}/api/approvals`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-operator-key': key }, body: JSON.stringify(body) })
console.log(res.status, await res.text())
process.exit(res.ok ? 0 : 1)
