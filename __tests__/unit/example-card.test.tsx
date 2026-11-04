import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// The example card at zero leads: clearly marked, and every tap stays on the
// page. The proof that it writes nothing and sends nothing is that no request
// of any kind leaves the browser when its buttons are used.

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

import { ExampleCard } from '@/app/dashboard/ExampleCard'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  window.confirm = jest.fn(() => true)
})

describe('ExampleCard', () => {
  it('is marked as an example and shows the five taps', () => {
    render(<ExampleCard />)
    expect(screen.getByText(/Maya is not real/)).toBeInTheDocument()
    expect(screen.getByText('Maya R.', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /More info/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pass$/ })).toBeInTheDocument()
  })

  it('a Pass on the example makes no request at all', async () => {
    render(<ExampleCard />)
    fireEvent.click(screen.getByRole('button', { name: /^Pass$/ }))
    fireEvent.click(screen.getByRole('button', { name: /Pass on this one/ }))
    await waitFor(() => expect(screen.getByText(/Passed/)).toBeInTheDocument(), { timeout: 2000 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
