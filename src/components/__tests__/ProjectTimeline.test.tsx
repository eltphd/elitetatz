import { render, screen } from '@testing-library/react'
import { ProjectTimeline } from '../ProjectTimeline'
import { PROJECT_STAGES, ProjectStage } from '@/lib/types'

const ACTIVE_STAGES = PROJECT_STAGES.filter((s) => s.key !== 'rejected')

describe('ProjectTimeline', () => {
  it('renders all active stage dots', () => {
    render(<ProjectTimeline stage="pending" />)
    ACTIVE_STAGES.forEach((s) => {
      expect(screen.getByTestId(`stage-dot-${s.key}`)).toBeInTheDocument()
    })
  })

  it('shows "Now" indicator on active stage', () => {
    render(<ProjectTimeline stage="sketching" />)
    expect(screen.getByText('Now')).toBeInTheDocument()
  })

  it('renders rejected state as a distinct message', () => {
    render(<ProjectTimeline stage="rejected" />)
    expect(screen.getByText(/artist declined/i)).toBeInTheDocument()
    expect(screen.queryByTestId('project-timeline')).not.toBeInTheDocument()
  })

  it('renders timeline container for non-rejected stages', () => {
    render(<ProjectTimeline stage="accepted" />)
    expect(screen.getByTestId('project-timeline')).toBeInTheDocument()
  })

  it('shows stage label for completed stage', () => {
    render(<ProjectTimeline stage="completed" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  const stages: ProjectStage[] = [
    'pending', 'accepted', 'deposit_paid', 'sketching', 'approval', 'booked', 'completed',
  ]

  stages.forEach((stage) => {
    it(`renders without crashing for stage: ${stage}`, () => {
      expect(() => render(<ProjectTimeline stage={stage} />)).not.toThrow()
    })
  })
})
