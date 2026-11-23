import { describe, expect, it } from 'vitest'

import { setup } from '../../test/render'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('is skipped by screen readers', () => {
    const { container } = setup(<Skeleton />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes the size it is given, so the content can replace it without a jump', () => {
    const { container } = setup(<Skeleton className="aspect-square w-16" />)
    expect(container.firstElementChild).toHaveClass('aspect-square', 'w-16')
  })

  it('shimmers, but only when the operating system allows motion', () => {
    const { container } = setup(<Skeleton shape="text" />)
    const animations = (container.firstElementChild?.className ?? '').split(' ').filter((name) => name.includes('animate-'))
    expect(animations).toEqual(['motion-safe:animate-shimmer'])
  })
})
