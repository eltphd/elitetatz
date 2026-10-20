'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Voice in, text out, in the browser. Some people can say a tattoo idea far
// better than they can type it. The Web Speech API does the transcription on
// the device (Chrome, Safari, Edge); where it is missing the mic button is
// simply not rendered and typing works as before. Nothing is recorded or
// uploaded: only the transcript reaches the chat, like any typed message.

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const subscribeNever = () => () => {}

export function useSpeechInput(onText: (text: string, final: boolean) => void) {
  // False on the server and on the first client render, so the markup matches.
  const supported = useSyncExternalStore(subscribeNever, () => recognitionCtor() !== null, () => false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText })
  useEffect(() => () => { recRef.current?.stop() }, [])

  const stop = useCallback(() => { recRef.current?.stop() }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor || recRef.current) return
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += `${r[0].transcript} `
        else interim += r[0].transcript
      }
      onTextRef.current(`${finalText}${interim}`.replace(/\s+/g, ' ').trim(), false)
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
      onTextRef.current(finalText.replace(/\s+/g, ' ').trim(), true)
    }
    rec.onerror = () => { recRef.current = null; setListening(false) }
    recRef.current = rec
    setListening(true)
    try { rec.start() } catch { recRef.current = null; setListening(false) }
  }, [])

  const toggle = useCallback(() => { if (listening) stop(); else start() }, [listening, start, stop])

  return { supported, listening, start, stop, toggle }
}
