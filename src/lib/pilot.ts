// Pilot containment. When SINGLE_ARTIST_MODE is set (any non-empty value
// other than an explicit off switch) the app runs as one artist's funnel.
export function singleArtistMode(): boolean {
  const v = (process.env.SINGLE_ARTIST_MODE ?? '').trim()
  return v !== '' && !/^(0|false|off|no)$/i.test(v)
}
