import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

/* What each colour token is for, in the order they appear in theme.css. */
const colourTokens: [name: string, use: string][] = [
  ['background', 'App background behind everything'],
  ['foreground', 'Main text'],
  ['panel', 'Side panels and top bar'],
  ['canvas', 'Area around the figure page'],
  ['page', 'The figure page (always white)'],
  ['popover', 'Menus and popovers'],
  ['tooltip', 'Tooltips'],
  ['muted', 'Quiet fills: tiles, tracks'],
  ['muted-foreground', 'Secondary text, placeholders'],
  ['accent', 'Hover and selected rows'],
  ['primary', 'Main action (Export), active tool'],
  ['primary-hover', 'Main action on hover'],
  ['primary-subtle', 'Selected tool, chosen option'],
  ['primary-subtle-hover', 'The same, on hover'],
  ['primary-subtle-foreground', 'Text on primary-subtle'],
  ['border', 'Thin lines between things'],
  ['border-strong', 'Lines that must be seen: swatches, slider thumb'],
  ['input', 'Text field background'],
  ['input-border', 'Text field outline'],
  ['ring', 'Keyboard focus outline'],
  ['selection', 'Selection box on the canvas'],
  ['destructive', 'Delete, errors'],
  ['destructive-text', 'Red text: error messages'],
  ['success', 'Done, saved'],
  ['warning', 'Needs attention'],
  ['skeleton', 'Loading placeholders'],
]

const typeScale: [cls: string, px: number, use: string][] = [
  ['text-2xs', 11, 'Badges, section labels'],
  ['text-xs', 12, 'Secondary text, field labels'],
  ['text-sm', 13, 'Default interface text'],
  ['text-base', 14, 'Dialogs, longer text'],
  ['text-lg', 16, 'Dialog titles'],
  ['text-xl', 20, 'Start screen headings'],
  ['text-2xl', 24, 'Page titles'],
]

const durations: [name: string, use: string][] = [
  ['--duration-instant', 'Hover, press'],
  ['--duration-fast', 'Tooltips, toggles'],
  ['--duration-base', 'Popovers, panels opening'],
  ['--duration-slow', 'Large moves'],
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ name, theme }: { name: string; theme: 'light' | 'dark' }) {
  return (
    <div data-theme={theme} className="h-8 w-full rounded-md ring-1 ring-black/10 ring-inset" style={{ backgroundColor: `var(--${name})` }} />
  )
}

function TokenOverview() {
  return (
    <div className="min-h-screen bg-background p-8 text-sm text-foreground">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Tokens</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          The named values everything is built from. Components only use these names, so changing one value here restyles everything
          that uses it. Colours live in <code className="font-mono text-xs">src/styles/theme.css</code>, the scales in{' '}
          <code className="font-mono text-xs">src/styles/tokens.css</code>.
        </p>
      </header>

      <Section title="Colours">
        <div className="grid max-w-3xl grid-cols-[14rem_1fr_6rem_6rem] items-center gap-x-4 gap-y-1.5">
          <span className="text-xs text-muted-foreground">Token</span>
          <span className="text-xs text-muted-foreground">Used for</span>
          <span className="text-xs text-muted-foreground">Light</span>
          <span className="text-xs text-muted-foreground">Dark</span>
          {colourTokens.map(([name, use]) => (
            <div key={name} className="contents">
              <code className="font-mono text-xs">{name}</code>
              <span className="text-muted-foreground">{use}</span>
              <Swatch name={name} theme="light" />
              <Swatch name={name} theme="dark" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type sizes">
        <div className="flex max-w-3xl flex-col gap-3">
          {typeScale.map(([cls, px, use]) => (
            <div key={cls} className="grid grid-cols-[6rem_3rem_1fr] items-baseline gap-4">
              <code className="font-mono text-xs">{cls}</code>
              <span className="text-xs text-muted-foreground tabular-nums">{px} px</span>
              <span className={cls}>
                Phagocytosis sequence <span className="text-muted-foreground">· {use}</span>
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Default interface text: <span className="text-foreground">text-sm</span> (13 px). Font: Inter.
          </p>
        </div>
      </Section>

      <Section title="Spacing">
        <p className="mb-3 text-muted-foreground">One step is 4 px. Class names count steps: p-2 is 8 px, gap-3 is 12 px.</p>
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3, 4, 6, 8, 12, 16].map((step) => (
            <div key={step} className="flex items-center gap-4">
              <code className="w-10 font-mono text-xs">{step}</code>
              <span className="w-12 text-xs text-muted-foreground tabular-nums">{step * 4} px</span>
              <div className="h-3 rounded-sm bg-primary" style={{ width: step * 4 }} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Corners and shadows">
        <div className="flex flex-wrap gap-6">
          {[
            ['rounded-sm', 'shadow-sm'],
            ['rounded-md', 'shadow-sm'],
            ['rounded-lg', 'shadow-md'],
            ['rounded-xl', 'shadow-lg'],
          ].map(([radius, shadow]) => (
            <div key={radius} className={`flex size-32 flex-col justify-end bg-panel p-3 ring-1 ring-border ${radius} ${shadow}`}>
              <code className="font-mono text-xs">{radius}</code>
              <code className="font-mono text-xs text-muted-foreground">{shadow}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Animation timing">
        <p className="mb-3 text-muted-foreground">Hover a row to see how fast it moves. With "reduce motion" switched on in your system, these are all 0.</p>
        <div className="flex max-w-xl flex-col gap-1">
          {durations.map(([name, use]) => (
            <div key={name} className="group grid grid-cols-[10rem_10rem_1fr] items-center gap-4 rounded-md px-2 py-1.5 hover:bg-accent">
              <code className="font-mono text-xs">{name}</code>
              <span className="text-muted-foreground">{use}</span>
              <div className="relative h-3">
                <div
                  className="absolute top-0 left-0 size-3 rounded-full bg-primary transition-transform ease-standard group-hover:translate-x-32"
                  style={{ transitionDuration: `var(${name})` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

const meta = {
  title: 'Tokens',
  component: TokenOverview,
} satisfies Meta<typeof TokenOverview>

export default meta

export const Overview: StoryObj<typeof meta> = {}
