import type { SupabaseClient } from '@supabase/supabase-js'

// A stand-in for the service-role Supabase client in route tests. Every query
// is recorded (table, operation, payload, filters) and answered by `respond`,
// so a test states what the database returns and then checks what was written.

export interface Call {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  payload?: unknown
  filters: [string, unknown][]
  returning: boolean
}

export type Responder = (call: Call) => { data?: unknown; error?: unknown } | undefined

export function fakeDb(respond: Responder = () => undefined) {
  const calls: Call[] = []

  function from(table: string) {
    const call: Call = { table, op: 'select', filters: [], returning: false }
    let started = false
    const answer = () => {
      calls.push(call)
      const r = respond(call) ?? {}
      return { data: r.data ?? null, error: r.error ?? null }
    }
    const builder = {
      select() {
        if (started) call.returning = true
        else { call.op = 'select'; started = true }
        return builder
      },
      insert(payload: unknown) { call.op = 'insert'; call.payload = payload; started = true; return builder },
      update(payload: unknown) { call.op = 'update'; call.payload = payload; started = true; return builder },
      upsert(payload: unknown) { call.op = 'upsert'; call.payload = payload; started = true; return builder },
      delete() { call.op = 'delete'; started = true; return builder },
      eq(col: string, val: unknown) { call.filters.push([col, val]); return builder },
      or(expr: string) { call.filters.push(['or', expr]); return builder },
      limit() { return builder },
      order() { return builder },
      single: () => Promise.resolve(answer()),
      maybeSingle: () => Promise.resolve(answer()),
      then<T>(resolve: (v: { data: unknown; error: unknown }) => T, reject?: (e: unknown) => T) {
        return Promise.resolve(answer()).then(resolve, reject)
      },
    }
    return builder
  }

  return { db: { from } as unknown as SupabaseClient, calls }
}

export const writes = (calls: Call[], table: string, op: Call['op']) =>
  calls.filter((c) => c.table === table && c.op === op)
