/*
 * "Report issue" at the bottom of an icon's properties: a compact outlined
 * button with a flag, kept away from the settings above it.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { Flag } from 'lucide-react'

export function ReportIconButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-auto flex px-3 pt-4 pb-3">
      <Button size="sm" variant="secondary" aria-label="Report issue with this icon" title="Report an issue with this icon" onClick={onClick}>
        <Flag strokeWidth={2} aria-hidden="true" />
        Report issue
      </Button>
    </div>
  )
}
