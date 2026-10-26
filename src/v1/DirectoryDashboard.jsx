import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, BadgeCheck, Building2, Factory, MapPin, Pill, Search, ShieldCheck, Truck } from 'lucide-react'
import CompanyCard from './CompanyCard'
import DistributorCard from './DistributorCard'
import DistributorDetailDialog from './DistributorDetailDialog'
import DirectorySearchFilters from './DirectorySearchFilters'
import { previewCompanies, previewDistributors, previewTowns } from './demoDirectory'
import './v1.css'

const normalize = value => String(value || '').trim().toLocaleLowerCase('en-IN')

function Stat({ value, label, icon: Icon }) {
  return (
    <div className="kpc-stat flex items-center gap-3.5 py-3 sm:px-6 sm:py-2 sm:first:pl-0 sm:last:pr-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#c8e4d9] bg-[#e8f4ee] text-[#14765f]"><Icon size={18} strokeWidth={1.8} /></span>
      <span><strong className="block text-xl font-semibold tracking-tight text-[#18362f] sm:text-2xl">{value}</strong><span className="block text-xs font-medium text-[#75827c]">{label}</span></span>
    </div>
  )
}

function NetworkIllustration() {
  const locations = [
    { name: 'Bhuj', x: 172, y: 112, featured: true },
    { name: 'Anjar', x: 284, y: 76 },
    { name: 'Gandhidham', x: 298, y: 158 },
    { name: 'Mandvi', x: 66, y: 178 },
    { name: 'Mundra', x: 137, y: 242 },
    { name: 'Bhachau', x: 320, y: 244 },
  ]

  return (
    <div className="kpc-network relative mx-auto w-full max-w-[34rem] overflow-hidden rounded-[1.6rem] border border-[#e4ddcf] bg-[#f7f1e7] p-5 sm:p-7" aria-label="Illustration of distributor connections across Kutch">
      <div className="absolute -right-14 -top-24 size-72 rounded-full border border-[#e5dccc]" />
      <div className="absolute -right-2 -top-12 size-48 rounded-full border border-[#e5dccc]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#718179]">A closer connection</p>
          <h2 className="mt-1 font-serif text-xl font-medium tracking-tight text-[#18362f] sm:text-2xl">Across Kutch, together.</h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d4e5d8] bg-white/80 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.13em] text-[#32725e]"><span className="size-1.5 rounded-full bg-[#57a684]" /> Local network</span>
      </div>

      <svg className="relative mt-3 w-full" viewBox="0 0 390 292" role="img" aria-label="Schematic network linking Bhuj, Anjar, Gandhidham, Mandvi, Mundra and Bhachau">
        <defs>
          <pattern id="kpc-map-dots" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c9c1b0" opacity=".48" /></pattern>
          <linearGradient id="kpc-route" x1="0" x2="1"><stop offset="0" stopColor="#8ab6a0" stopOpacity=".24" /><stop offset=".5" stopColor="#559b7d" stopOpacity=".8" /><stop offset="1" stopColor="#8ab6a0" stopOpacity=".24" /></linearGradient>
        </defs>
        <rect x="3" y="2" width="384" height="286" rx="20" fill="url(#kpc-map-dots)" />
        <path d="M172 112 284 76 298 158 320 244 172 112 137 242 66 178 172 112" fill="none" stroke="url(#kpc-route)" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M77 93c24-28 61-46 105-45 42 1 79 23 96 51M94 221c23 23 55 36 91 38 42 2 75-11 103-37" fill="none" stroke="#d6cdbd" strokeWidth="1.2" />
        {locations.map(location => (
          <g key={location.name} transform={`translate(${location.x} ${location.y})`}>
            {location.featured && <circle r="25" fill="#85b99d" opacity=".17" />}
            <circle r={location.featured ? 9 : 6.5} fill={location.featured ? '#16775f' : '#fdfbf7'} stroke={location.featured ? '#16775f' : '#77a38c'} strokeWidth="2.5" />
            <circle r="2" fill={location.featured ? '#fff' : '#77a38c'} />
            <text x={location.name === 'Gandhidham' ? -9 : 12} y={location.name === 'Mandvi' ? 19 : -11} textAnchor={location.name === 'Gandhidham' ? 'end' : 'start'} fill="#41574d" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">{location.name}</text>
          </g>
        ))}
      </svg>

      <div className="relative flex items-center justify-between gap-3 border-t border-[#dfd7c8] pt-3 text-[10px] text-[#78857d]">
        <span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-[#47856c]" /> Kutch, Gujarat</span>
        <span className="font-semibold tracking-wide">SCHEMATIC · NOT TO SCALE</span>
      </div>
    </div>
  )
}

export default function DirectoryDashboard() {
  const [mode, setMode] = useState('distributors')
  const [query, setQuery] = useState('')
  const [town, setTown] = useState('')
  const [emergencyOnly, setEmergencyOnly] = useState(false)
  const [coldChainOnly, setColdChainOnly] = useState(false)
  const [selectedDistributor, setSelectedDistributor] = useState(null)
  const normalizedQuery = normalize(query)

  const filteredDistributors = useMemo(() => previewDistributors.filter(distributor => {
    const matchQuery = !normalizedQuery || [
      distributor.name, distributor.town, distributor.address, distributor.license20B, distributor.license21B, ...distributor.companies,
    ].some(value => normalize(value).includes(normalizedQuery))
    return matchQuery && (!town || distributor.town === town) && (!emergencyOnly || distributor.emergency24x7) && (!coldChainOnly || distributor.coldChain)
  }), [normalizedQuery, town, emergencyOnly, coldChainOnly])

  const filteredCompanies = useMemo(() => previewCompanies.map(company => ({
    ...company,
    distributors: company.distributors.filter(distributor =>
      (!town || distributor.town === town) && (!emergencyOnly || distributor.emergency24x7) && (!coldChainOnly || distributor.coldChain)
    ),
  })).filter(company => {
    const matches = !normalizedQuery || normalize(company.name).includes(normalizedQuery)
      || company.distributors.some(distributor => [distributor.name, distributor.town].some(value => normalize(value).includes(normalizedQuery)))
    return matches && company.distributors.length > 0
  }), [normalizedQuery, town, emergencyOnly, coldChainOnly])

  const clearFilters = () => { setQuery(''); setTown(''); setEmergencyOnly(false); setColdChainOnly(false) }
  const visibleCount = mode === 'distributors' ? filteredDistributors.length : filteredCompanies.length
  const showSearch = value => { setMode(value); document.getElementById('v1-directory-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

  return (
    <div className="kpc-v1-preview min-h-screen bg-[#fbfaf6] text-[#18362f]">
      <header className="kpc-header sticky top-0 z-30 border-b border-[#e9e5dc] bg-[#fbfaf6]/95 text-[#18362f] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href={import.meta.env.BASE_URL} className="flex min-w-0 items-center gap-2.5 rounded-lg" aria-label="Kutch Pharma Connect home">
            <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#18362f] text-[#d9ede2]"><Pill size={19} strokeWidth={1.8} /></span>
            <span className="min-w-0"><strong className="block truncate text-[14px] font-bold tracking-[-.025em] sm:text-[15px]">Kutch Pharma Connect</strong><span className="block text-[9px] font-semibold uppercase tracking-[.16em] text-[#77847c]">The local pharma directory</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-[#65736b] md:flex" aria-label="Main navigation">
            <a className="transition hover:text-[#14765f]" href="#directory">Directory</a>
            <a className="transition hover:text-[#14765f]" href="#how-it-works">How it works</a>
          </nav>
          <a href="#directory" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#14765f] px-4 text-xs font-bold text-white shadow-[0_5px_15px_rgba(20,118,95,.16)] transition hover:bg-[#105b4b] sm:px-5 sm:text-[13px]">Explore directory <ArrowRight size={14} /></a>
        </div>
      </header>

      <main>
        <section className="kpc-hero-surface relative overflow-hidden border-b border-[#eee9df]">
          <div className="mx-auto grid max-w-7xl items-center gap-9 px-4 pb-9 pt-10 sm:px-6 sm:pb-11 sm:pt-12 lg:grid-cols-[1.03fr_.97fr] lg:gap-14 lg:px-8 lg:pb-14 lg:pt-14">
            <div className="relative z-10 max-w-2xl">
              <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#547568]"><span className="size-1.5 rounded-full bg-[#4c9a78]" /> Kutch · Gujarat · India</p>
              <h1 className="mt-5 max-w-[13ch] font-serif text-[2.8rem] font-medium leading-[.98] tracking-[-.052em] text-[#193a32] sm:text-6xl lg:text-[4.35rem]">Know who supplies <em className="font-normal text-[#328468]">what</em> across Kutch.</h1>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#67766e] sm:text-base">A clear, local directory connecting healthcare businesses with the distributors and pharmaceutical companies they represent.</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <button type="button" onClick={() => showSearch('distributors')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#193a32] px-5 text-sm font-semibold text-white transition hover:bg-[#245548]">Find a distributor <ArrowRight size={15} /></button>
                <button type="button" onClick={() => showSearch('companies')} className="inline-flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-[#47715f] transition hover:text-[#163b31]">Find a company <ArrowDownRight size={15} /></button>
              </div>
              <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-medium text-[#818c84]"><ShieldCheck size={14} className="text-[#47856c]" /> Verified directory information · Confirm current availability directly</p>
            </div>
            <NetworkIllustration />
          </div>

          <div className="border-t border-[#eae5da] bg-[#f7f4ed]">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-0 sm:px-6 sm:py-4 lg:px-8">
              <Stat value={previewDistributors.length} label="Distributors in this preview" icon={Truck} />
              <Stat value={previewCompanies.length} label="Company relationships" icon={Building2} />
              <Stat value={previewTowns.length} label="Kutch towns represented" icon={MapPin} />
            </div>
          </div>
        </section>

        <section id="directory" className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#48836a]">Start with a name or a place</p>
              <h2 className="mt-2 font-serif text-3xl font-medium tracking-[-.035em] text-[#193a32] sm:text-4xl">Find your connection.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#77827b] sm:text-right">Search by distributor, company, town, or drug licence to find the right local listing.</p>
          </div>

          <DirectorySearchFilters
            mode={mode} query={query} onQueryChange={setQuery} town={town} onTownChange={setTown} towns={previewTowns}
            emergencyOnly={emergencyOnly} onEmergencyChange={setEmergencyOnly} coldChainOnly={coldChainOnly}
            onColdChainChange={setColdChainOnly} onClear={clearFilters}
          />

          <div className="mt-10 flex flex-col justify-between gap-4 border-b border-[#e7e3da] pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8a948e]">Browse the network</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-.03em] text-[#193a32] sm:text-2xl">{mode === 'distributors' ? 'Local distributors' : 'Companies & stockists'}</h2>
            </div>
            <div className="flex w-full rounded-full border border-[#e4e0d7] bg-[#f3f1eb] p-1 sm:w-auto" role="group" aria-label="Choose directory view">
              <button type="button" aria-pressed={mode === 'distributors'} onClick={() => setMode('distributors')} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition sm:flex-none ${mode === 'distributors' ? 'bg-[#193a32] text-white shadow-sm' : 'text-[#67766e] hover:text-[#193a32]'}`}><Truck size={15} />Distributors</button>
              <button type="button" aria-pressed={mode === 'companies'} onClick={() => setMode('companies')} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition sm:flex-none ${mode === 'companies' ? 'bg-[#193a32] text-white shadow-sm' : 'text-[#67766e] hover:text-[#193a32]'}`}><Building2 size={15} />Companies</button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 py-4" aria-live="polite">
            <p className="text-sm text-[#77827b]"><strong className="font-semibold text-[#193a32]">{visibleCount}</strong> {mode === 'distributors' ? 'distributors' : 'companies'} shown</p>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#929b94]"><BadgeCheck size={13} className="text-[#48836a]" /> Preview data</p>
          </div>

          {mode === 'distributors' ? (
            filteredDistributors.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredDistributors.map(distributor => <DistributorCard key={distributor.id} distributor={distributor} onOpen={setSelectedDistributor} />)}</div> : <EmptyState onClear={clearFilters} />
          ) : (
            filteredCompanies.length ? <div className="grid items-start gap-4 xl:grid-cols-2">{filteredCompanies.map(company => <CompanyCard key={company.id} company={company} onOpenDistributor={setSelectedDistributor} />)}</div> : <EmptyState onClear={clearFilters} />
          )}
        </section>

        <section id="how-it-works" className="border-y border-[#e9e4d9] bg-[#f5f2eb]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:px-8 lg:py-14">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#48836a]">Built for the local network</p>
              <h2 className="mt-2 max-w-sm font-serif text-3xl font-medium leading-tight tracking-[-.035em] text-[#193a32] sm:text-4xl">A simpler way to know who handles what.</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#48836a]"><Factory size={16} /></span><div><h3 className="text-sm font-semibold text-[#27463a]">Search from either side</h3><p className="mt-1 text-[13px] leading-6 text-[#748078]">Start with a company to find its local stockists, or start with a distributor to see its company links.</p></div></div>
              <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#48836a]"><MapPin size={16} /></span><div><h3 className="text-sm font-semibold text-[#27463a]">Keep it close to home</h3><p className="mt-1 text-[13px] leading-6 text-[#748078]">Browse local coverage across Bhuj, Gandhidham, Anjar, Mandvi, and other Kutch towns.</p></div></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#193a32] text-[#dce9e1]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 font-semibold"><Pill size={16} className="text-[#a7d2b6]" /> Kutch Pharma Connect</span>
          <span className="max-w-xl leading-5 text-[#b2c5b9]">Directory information is provided as a starting point. Confirm current company authorization, stock, and contact details directly with the distributor.</span>
        </div>
      </footer>

      <DistributorDetailDialog distributor={selectedDistributor} onClose={() => setSelectedDistributor(null)} />
    </div>
  )
}

function EmptyState({ onClear }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8d9ce] bg-white px-5 py-14 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#edf4ed] text-[#619378]"><Search size={20} /></span>
      <h3 className="mt-4 font-serif text-xl font-medium text-[#193a32]">No matches found</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#77827b]">Try another search term or remove a filter to see more Kutch directory listings.</p>
      <button type="button" onClick={onClear} className="mt-4 rounded-full bg-[#193a32] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245548]">Clear search and filters</button>
    </div>
  )
}
