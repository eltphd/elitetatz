import { render, screen } from '@testing-library/react'
import { BottomNav } from '../BottomNav'

// Next.js Link needs a router context in tests
jest.mock('next/link', () => {
  const Link = ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  )
  Link.displayName = 'Link'
  return Link
})

describe('BottomNav', () => {
  it('renders all nav items', () => {
    render(<BottomNav active="home" />)
    expect(screen.getByTestId('nav-home')).toBeInTheDocument()
    expect(screen.getByTestId('nav-explore')).toBeInTheDocument()
    expect(screen.getByTestId('nav-agent')).toBeInTheDocument()
    expect(screen.getByTestId('nav-flash')).toBeInTheDocument()
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument()
  })

  it('highlights the active nav item', () => {
    render(<BottomNav active="explore" />)
    const exploreLink = screen.getByTestId('nav-explore')
    expect(exploreLink).toHaveClass('text-[#c9a84c]')
  })

  it('renders TatzAI as a styled CTA', () => {
    render(<BottomNav active="home" />)
    const aiLink = screen.getByTestId('nav-agent')
    expect(aiLink).toHaveClass('bg-[#c9a84c]')
  })

  it('links to correct hrefs', () => {
    render(<BottomNav active="home" />)
    expect(screen.getByTestId('nav-flash').closest('a')).toHaveAttribute('href', '/flash')
    expect(screen.getByTestId('nav-agent').closest('a')).toHaveAttribute('href', '/agent')
  })
})
