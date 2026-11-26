import type { Meta, StoryObj } from '@storybook/react-vite'

import { SyncBanner } from './SyncBanner'
import { SyncStatus, type SyncState } from './SyncStatus'

const meta = {
  title: 'Components/Sync status',
  component: SyncStatus,
  args: { state: 'synced' },
  decorators: [(Story) => <div className="bg-panel p-4">{Story()}</div>],
} satisfies Meta<typeof SyncStatus>

export default meta
type Story = StoryObj<typeof meta>

const STATES: SyncState[] = ['local', 'synced', 'syncing', 'waiting', 'failed', 'blocked']

/** Every state, as the editor's top bar shows it. Hover one for its details. */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      {STATES.map((state) => (
        <div key={state} className="flex items-center gap-4">
          <span className="w-16 text-xs text-muted-foreground">{state}</span>
          <SyncStatus state={state} onRetry={() => undefined} />
        </div>
      ))}
    </div>
  ),
}

/** Phones: the icon only. */
export const Compact: Story = { args: { state: 'waiting', compact: true } }

/** The start screen's banner while this device's figures go into the account. */
export const Banner: Story = {
  decorators: [(Story) => <div className="w-[720px]">{Story()}</div>],
  render: () => <SyncBanner done={2} total={5} onCancel={() => undefined} />,
}
