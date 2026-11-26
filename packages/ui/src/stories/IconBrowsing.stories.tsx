import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { IconTile } from '../components/icon-tile/IconTile'
import { sampleCategories, type SampleIcon } from '../sample/sample-shapes'

const meta = { title: 'Design drafts/Icon browsing', parameters: { layout: 'fullscreen', controls: { disable: true } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function Icons({ icons }: { icons: SampleIcon[] }) {
  return <div className="grid grid-cols-3 gap-2">{icons.map(({ name, Icon }) => <IconTile key={name} name={name} picture={<Icon />} />)}</div>
}

function Draft({ layout }: { layout: 'tiles' | 'rows' }) {
  const [selected, setSelected] = useState('Cells')
  const [query, setQuery] = useState('')
  const categories = sampleCategories.map(c => ({ ...c, icons: c.icons.filter(i => i.name.toLowerCase().includes(query.toLowerCase())) })).filter(c => c.icons.length)
  const active = categories.find(c => c.name === selected) ?? categories[0]
  return <div className="flex h-[640px] w-[282px] flex-col overflow-hidden rounded-lg border border-border bg-panel text-foreground shadow-sm">
    <div className="border-b border-border px-3 py-3"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">Icons</strong><span className="text-muted-foreground">×</span></div><div className="flex gap-2"><label className="flex h-8 flex-1 items-center gap-2 rounded-md border border-border px-2"><Search size={14} className="text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search icons" className="w-full bg-transparent text-xs outline-none" /></label><button className="grid w-8 place-items-center rounded-md border border-border" aria-label="Filters"><SlidersHorizontal size={14}/></button></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <p className="mb-2 text-xs text-muted-foreground">Browse categories</p>
      <div className={layout === 'tiles' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>{categories.map(c => {
        const Icon = c.icons[0].Icon
        const selectedStyle = active?.name === c.name ? 'border-blue-400 bg-blue-50' : 'border-border'
        return layout === 'tiles'
          ? <button key={c.name} onClick={() => setSelected(c.name)} className={`rounded-md border p-2 text-left ${selectedStyle}`}><div className="flex h-14 items-center justify-center"><Icon className="size-12" /></div><div className="mt-1 text-xs font-medium">{c.name}</div></button>
          : <button key={c.name} onClick={() => setSelected(c.name)} className={`flex h-14 items-center gap-3 rounded-md border px-2 text-left ${selectedStyle}`}><Icon className="size-10 shrink-0" /><span className="text-xs font-medium">{c.name}</span></button>
      })}</div>
      {active && <section className="mt-5"><h3 className="mb-3 text-xs font-semibold">{active.name}</h3><Icons icons={active.icons}/></section>}
      {!categories.length && <p className="py-6 text-center text-xs text-muted-foreground">No matching sample icons.</p>}
    </div><div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">Visual draft · sample icons and categories</div>
  </div>
}
export const Compare: Story = { render: () => <div className="min-h-screen bg-[#eef0f3] p-8 font-sans"><div className="mx-auto max-w-[720px]"><h1 className="text-xl font-semibold">Visual collections</h1><p className="mb-7 mt-2 text-sm text-slate-600">Try the categories and search. These are visual drafts with sample icons.</p><div className="flex flex-wrap items-start gap-8">{([{id:'tiles', title:'A1 · Tiles', desc:'Two collection cards per row.'},{id:'rows', title:'A2 · Rows', desc:'One collection per row.'}] as const).map(d => <div key={d.id}><div className="mb-3 h-14"><h2 className="text-sm font-semibold">{d.title}</h2><p className="mt-1 text-xs text-slate-600">{d.desc}</p></div><Draft layout={d.id}/></div>)}</div></div></div> }
