import { render, screen, fireEvent } from '@testing-library/react'
import { FlashCard } from '../FlashCard'
import { MOCK_FLASH } from '@/lib/mock-data'

const availableFlash = MOCK_FLASH.find((f) => !f.sold)!
const soldFlash = MOCK_FLASH.find((f) => f.sold)!

describe('FlashCard', () => {
  it('renders the flash title', () => {
    render(<FlashCard flash={availableFlash} onSelect={jest.fn()} />)
    expect(screen.getByText(availableFlash.title)).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn()
    render(<FlashCard flash={availableFlash} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(availableFlash)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('shows Claimed badge for sold designs', () => {
    render(<FlashCard flash={soldFlash} onSelect={jest.fn()} />)
    expect(screen.getByText('Claimed')).toBeInTheDocument()
  })

  it('does not show Claimed badge for available designs', () => {
    render(<FlashCard flash={availableFlash} onSelect={jest.fn()} />)
    expect(screen.queryByText('Claimed')).not.toBeInTheDocument()
  })

  it('displays price with strikethrough for sold items', () => {
    render(<FlashCard flash={soldFlash} onSelect={jest.fn()} />)
    const price = screen.getByText(/\$/)
    expect(price).toHaveClass('line-through')
  })

  it('displays price normally for available items', () => {
    render(<FlashCard flash={availableFlash} onSelect={jest.fn()} />)
    const price = screen.getByText(/\$/)
    expect(price).not.toHaveClass('line-through')
  })

  it('shows size and style info', () => {
    render(<FlashCard flash={availableFlash} onSelect={jest.fn()} />)
    expect(screen.getByText(new RegExp(`${availableFlash.size_inches}"`))).toBeInTheDocument()
  })
})
