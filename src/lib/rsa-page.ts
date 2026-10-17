// Shared by /keep and /goodbye (served under rawsunart.com by a Vercel rewrite).
// One line, Lacey's voice, no navigation, no error detail for an unknown token.

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/

export function rsaPage(line: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>RawSunArt</title></head>
<body style="margin:0;background:#ffffff;color:#1b1b1b;font-family:Georgia,'Times New Roman',serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;">
<p style="font-size:20px;line-height:1.5;max-width:480px;margin:0;">${line}</p>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )
}

export const UNKNOWN = "That link didn't work. Write to lacey@rawsunart.com and she'll sort it. — Lacey"
