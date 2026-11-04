import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Walkthrough } from '@/app/dashboard/Walkthrough'

// The first-visit card as Lacey sees it: three steps, the phone's own
// gesture, and a "Got it" that writes to her row through the route and
// nowhere else.

const fetchMock = jest.fn()

function setUa(ua: string, touch = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touch, configurable: true })
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  global.fetch = fetchMock as unknown as typeof fetch
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
})

describe('Walkthrough', () => {
  it('shows the three steps and the five taps', () => {
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1')
    render(<Walkthrough initialState="full" leadCount={0} />)
    expect(screen.getByText('Put it on your home screen')).toBeInTheDocument()
    expect(screen.getByText('One card, five taps')).toBeInTheDocument()
    expect(screen.getByText('Nothing slips')).toBeInTheDocument()
    for (const tap of ['Quote', 'Ask', 'Reply', 'Pass', 'Deposit received']) expect(screen.getAllByText(tap).length).toBeGreaterThan(0)
    for (const at of ['36 h', '72 h', '14 d']) expect(screen.getAllByText(at).length).toBeGreaterThan(0)
    expect(screen.getByText(/Quiet hours 8 pm to 9 am/)).toBeInTheDocument()
  })

  it('shows the Safari gesture on an iPhone and the Chrome menu on Android', () => {
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1')
    const { unmount } = render(<Walkthrough initialState="full" leadCount={0} />)
    expect(screen.getByText(/Tap Share \(the square with the arrow\)/)).toBeInTheDocument()
    unmount()
    setUa('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124.0 Mobile Safari/537.36')
    render(<Walkthrough initialState="full" leadCount={0} />)
    expect(screen.getByText(/three-dot menu/)).toBeInTheDocument()
  })

  it('"Got it" records the dismissal and folds to one line when there are no leads', async () => {
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1')
    render(<Walkthrough initialState="full" leadCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dashboard/walkthrough')
    expect(JSON.parse(init.body)).toEqual({ dismissed: true })
    expect(screen.getByText(/Show again/)).toBeInTheDocument()
    expect(screen.queryByText('One card, five taps')).not.toBeInTheDocument()
  })

  it('"Got it" removes the card entirely once a lead exists', async () => {
    render(<Walkthrough initialState="full" leadCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/Show again/)).not.toBeInTheDocument()
    expect(screen.queryByText('One card, five taps')).not.toBeInTheDocument()
  })

  it('"Show again" clears the dismissal and opens the card', async () => {
    render(<Walkthrough initialState="collapsed" leadCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /Show again/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ dismissed: false })
    expect(screen.getByText('One card, five taps')).toBeInTheDocument()
  })

  it('comes back with the error when the save fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'column does not exist' }) })
    render(<Walkthrough initialState="full" leadCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('column does not exist')
    expect(screen.getByText('One card, five taps')).toBeInTheDocument()
  })

  it('renders nothing when hidden', () => {
    const { container } = render(<Walkthrough initialState="hidden" leadCount={3} />)
    expect(container).toBeEmptyDOMElement()
  })
})
