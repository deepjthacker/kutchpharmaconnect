import { Search, SlidersHorizontal, X } from 'lucide-react'

export default function DirectorySearchFilters({
  mode,
  query,
  onQueryChange,
  town,
  onTownChange,
  towns,
  emergencyOnly,
  onEmergencyChange,
  coldChainOnly,
  onColdChainChange,
  onClear,
}) {
  const hasFilters = query || town || emergencyOnly || coldChainOnly

  return (
    <section aria-label="Search and filter directory" className="rounded-[1.15rem] border border-[#dfe7e3] bg-white p-3 shadow-[0_10px_30px_rgba(20,45,54,.06)] sm:p-4">
      <div className="flex items-center gap-3 rounded-xl border border-[#e4eae7] bg-[#f7f9f8] px-3 py-3 transition focus-within:border-kpc-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-kpc-100/70 sm:px-4">
        <Search className="shrink-0 text-kpc-600" size={18} strokeWidth={2} aria-hidden="true" />
        <label htmlFor="v1-directory-search" className="sr-only">Search {mode === 'distributors' ? 'distributors or companies' : 'companies or distributors'}</label>
        <input
          id="v1-directory-search"
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={mode === 'distributors' ? 'Search distributor, company, town or DL number' : 'Search company, stockist or town'}
          className="min-h-6 min-w-0 flex-1 bg-transparent text-sm font-medium text-kpc-950 outline-none placeholder:font-normal placeholder:text-slate-400 sm:text-[15px]"
        />
        <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400 md:flex"><SlidersHorizontal size={13} /> Search</span>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-[#edf1ee] pt-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="hidden items-center pr-1 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400 lg:inline-flex">Filter by</span>
        <label className="sr-only" htmlFor="v1-town-filter">Filter by town</label>
        <select
          id="v1-town-filter"
          value={town}
          onChange={event => onTownChange(event.target.value)}
          className="min-h-11 rounded-lg border border-[#e0e7e3] bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:border-[#c6d5ce] focus:border-kpc-500 sm:min-h-10"
        >
          <option value="">All Kutch towns</option>
          {towns.map(item => <option value={item} key={item}>{item}</option>)}
        </select>

        <button
          type="button"
          aria-pressed={emergencyOnly}
          onClick={() => onEmergencyChange(!emergencyOnly)}
          className={`min-h-11 rounded-lg border px-3 text-[12px] font-semibold transition sm:min-h-10 ${emergencyOnly ? 'border-kpc-500 bg-kpc-50 text-kpc-700 shadow-sm' : 'border-[#e0e7e3] bg-white text-slate-600 hover:border-[#c6d5ce] hover:bg-[#fbfcfb]'}`}
        >
          24×7 emergency
        </button>
        <button
          type="button"
          aria-pressed={coldChainOnly}
          onClick={() => onColdChainChange(!coldChainOnly)}
          className={`min-h-11 rounded-lg border px-3 text-[12px] font-semibold transition sm:min-h-10 ${coldChainOnly ? 'border-kpc-500 bg-kpc-50 text-kpc-700 shadow-sm' : 'border-[#e0e7e3] bg-white text-slate-600 hover:border-[#c6d5ce] hover:bg-[#fbfcfb]'}`}
        >
          Cold-chain available
        </button>
        {hasFilters && (
          <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs font-bold text-kpc-700 hover:text-kpc-950 sm:ml-auto">
            <X size={15} /> Clear filters
          </button>
        )}
      </div>
    </section>
  )
}
