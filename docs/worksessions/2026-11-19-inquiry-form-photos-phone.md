# Worksession, Nov 19 2026: the inquiry form takes photos and a phone number, and says what happens next

Source: `2026-11-19_RSA_dev-fixes_mallybuild.md`, P1: F4, F6, F7. Two repos: this one (the endpoints, her email, the card) and `rawsunart-web` (the form).

## F4. Reference photos

Custom work runs on references, and the form had only a text box.

Two rules pull against each other: Lacey gets **one** email per inquiry and the photos have to be in it, and her email goes out **before** anything is written to the database. So the photos travel first:

1. The form sends each photo to `POST /api/community/inquiry/photo`. The bytes are checked (JPEG, PNG or HEIC, whatever the file is called), an iPhone HEIC is turned into a JPEG, and the file goes to the private bucket under `inquiry-uploads/<day>/`. No database row. The form gets back a signed ticket.
2. The form sends the inquiry with its tickets. The route checks each ticket, mints links that last 30 days and open without a sign-in, and her one email shows the photos as thumbnails.
3. Once the lead exists, each photo gets its `lead_attachments` row and shows on the card.

A photo that fails never holds the inquiry back. The form sends without it and tells the client to text it to 614-858-5574; her email says how many did not come through and that the client was told.

- Up to 5 photos, 10 MB each as picked. The form shrinks a large one in the browser to a JPEG no wider than 2000 px, because a request to this host cannot carry much over 4 MB. That step also converts HEIC wherever the browser can read it (iPhone, Mac Safari). `heic-convert` on the server is the backstop for a HEIC picked in Chrome on a laptop.
- A ticket only ever names a file in `inquiry-uploads/`, so an inquiry cannot ask for a link to a file on someone else's lead.
- The upload endpoint is public: rate limited, gated by the signed page-load stamp, and it keeps only real image bytes.
- Photos picked and never sent with an inquiry are removed after three days by the hourly cron (`sweepPendingPhotos`). A file with a `lead_attachments` row is never touched.

Code: `src/lib/inquiry-photos.ts`, `src/app/api/community/inquiry/photo/route.ts`, `imagesHtml` in `src/lib/notify.ts`.

## F7. Optional phone, and a box that starts unticked

"OK to text me about this inquiry." Both go to her email, so she can text from her own phone.

- Ticked: `Phone: 614-555-0100 (ticked "OK to text me about this inquiry")`. Not ticked: `(did not tick "OK to text": call or email, do not text)`.
- The card shows the number with "OK to text, from your phone" or "Call only, no texts".
- The number is stored in the brief as `contact_phone`, **not** in `matches.client_phone`. That column is what the portal texts from, and nothing automatic may text a client. A test fails if it ever lands there.
- The consent is stored in the brief with the time and the exact words (`text_ok`, `text_ok_at`, `text_ok_wording`). `client_consents` was not used: its scopes are fixed by a database constraint, and adding one is a migration. Worth doing if texting ever becomes a portal feature.

## F6. One confirmation, with a copy of what they sent

The form on rawsunart.com is replaced by a panel: "Got it, [first name]. I'll read this myself and reply within two days (I'm in studio Wed–Sat)," then whether the photos came through and the number to text one to.

The client gets one email: what happens next, a copy of what they sent, and their inquiry page when there is one.

- It is now sent whenever the inquiry reached Lacey by either route. Before, a client whose inquiry was emailed but not saved got nothing.
- A second form from the same person the same day gets its own confirmation, saying it was added to the first.
- Their own words go back with links taken out, and only when the bot check passed. Otherwise the form could be used to send a stranger a message with a link in it under her name.

## Found on the way

- The form's "Where do you want to be tattooed?" field shared its id with the studio section, so that section's padding made the field four times too tall on the live site. Fixed in `rawsunart-web`.
- The production build stops at the end with a notice that the installed Next.js (16.4.2) has a known security vulnerability and should be upgraded. Not acted on here.

## Checks

359 tests passing on this branch (46 new); `tsc` and eslint clean. A real 18 MB HEIC converted to JPEG in about four seconds. The form was driven in a browser, desktop and phone width, with the network stubbed so nothing reached production: photos shrink and upload, the inquiry carries the tickets, the panel replaces the form, and a failed upload still sends the inquiry and tells the client to text.

Not verified: a real upload to the storage bucket and a real email with thumbnails. The keys live on Vercel. After both deploys, send one test inquiry with two photos from rawsunart.com.

## Deploy order

This repo first, then `rawsunart-web`. The other way round is safe but photos fail (the form says to text them) until the endpoint exists.
