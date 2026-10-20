# Intake clarity: the concierge reads the reference, flags what is still open, and takes voice · 2026-10-20

## What was observed

Erica sat with Lacey through a return-client intake. The client sent a reference of large flowers on a thin arm and
meant "this style, tiny, as a sleeve." Lacey already had the body photo, the placement and the size. What she did not
have was the client's reading of their own reference: which part of the picture was the point. The result was a call
to reassure the client, then a sketch drawn around the ambiguity, with the usual risk that the design file goes out
and the client does not come back.

The companion spec for the standalone, pre-design brief lives in woopsi-ink (`docs/DESIGN-BRIEF.md`). This change
brings the same reading into the concierge that already runs on rawsunart.com, so the pilot benefits now.

## What changed

**The concierge** (`src/lib/artists/lacey-rawson.ts`)
- When a client has a reference it asks what the picture is there for: subject, style, density, size, color, or flow.
- It restates how the reference lands at the client's size and placement in plain words and has the client confirm.
  The client is the keeper and the verifier of their own idea before Lacey spends an hour on it.
- If something is still unclear after two tries it stops asking, writes one line into `open_questions`, and tells the
  client Lacey will settle it on the call. Easy beats complete: an open question costs readiness points but never
  blocks the brief.
- It sets the expectation once: for most pieces the design is shown at the appointment, and the brief is what Lacey
  quotes from.
- The brief now carries `reference_keepers`, `scale_check`, `scale_confirmed` and `open_questions`.

**Reading the brief** (`src/lib/brief.ts`, tested in `__tests__/unit/brief.test.ts`)
- One module turns the model's JSON into follow-ups in the order Lacey should read them: what the client could not
  answer, whether the scale was confirmed, then tattoo-ability notes.
- `suggestedQuestion` drafts her "Need more info" message in her own register from those points.

**Lacey's side**
- The inquiry email shows what each reference is for, the scale read and whether the client confirmed it, and a
  "still to settle before you quote" list.
- The inbox card shows the same, apart from the amber feasibility notes.
- The **More info** button is pre-filled with the drafted question. She edits or sends as is. One tap, not a re-read.

**The client's side**
- The inquiry page shows the scale read, what Lacey will likely ask about, and the line about design at the appointment,
  so a question from her is expected rather than a surprise.

**Voice** (`src/components/useSpeechInput.ts`, `MicButton.tsx`)
- A mic button in the concierge and in Lacey's More-info box. Transcription runs in the browser (Web Speech API, in
  Chrome, Safari and Edge); nothing is recorded or uploaded, only the transcript reaches the chat. Where the browser
  cannot do it the button is not rendered. Spoken turns are marked `input: 'voice'` on the saved conversation.
- The prompt knows a spoken message may ramble and confirms the concept, size and placement back in one line instead
  of asking again.

**Measurement**
- `inquiry_sent` now carries counts only: `open_questions`, `scale_confirmed`, `voice`. Nothing about who.

## What to watch over the next ten inquiries

Against the ten before this change: how many sketches went unpaid, how many messages before a quote, how many calls
before a quote, and how often the More-info button went out with the pre-filled question unchanged.

## Not in this change

No design previews, no overlay of the reference on the client's photo (that is the woopsi.ink brief's step 4), no
server-side transcription, no change to deposits or scheduling.
