import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setup } from '../../test/render'
import { Callout } from './Callout'

describe('Callout', () => {
  it('is a note screen readers can find, with its message as text', () => {
    setup(<Callout>The brackets don’t fit.</Callout>)
    expect(screen.getByRole('note')).toHaveTextContent('The brackets don’t fit.')
  })

  it('keeps its warning sign out of what screen readers read', () => {
    setup(<Callout>Check this.</Callout>)
    expect(screen.getByRole('note').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
