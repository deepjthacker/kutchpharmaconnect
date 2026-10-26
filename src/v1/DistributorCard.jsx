import { ArrowUpRight, BadgeCheck, Building2, Clock3, MapPin, Snowflake, Truck } from 'lucide-react'

export default function DistributorCard({ distributor, onOpen }) {
  return (
    <article className="group overflow-hidden rounded-[1.15rem] border border-[#e1e8e4] bg-white shadow-[0_2px_10px_rgba(20,45,54,.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#bfded5] hover:shadow-[0_14px_32px_rgba(20,45,54,.09)]">
      <div className="p-4 sm:p-[1.15rem]">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-kpc-100 bg-gradient-to-br from-kpc-50 to-[#e1f0eb] text-kpc-700"><Truck size={19} strokeWidth={1.8} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-kpc-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-kpc-700"><BadgeCheck size={11} /> Verified</span>
            </div>
          </div>
          <button type="button" onClick={() => onOpen(distributor)} aria-label={`View ${distributor.name} details`} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-kpc-50 hover:text-kpc-700"><ArrowUpRight size={17} /></button>
        </div>

        <h3 className="mt-3 text-[15px] font-bold leading-snug tracking-[-.02em] text-kpc-950 sm:text-base">{distributor.name}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500"><MapPin size={13} className="shrink-0 text-kpc-600" />{distributor.town}, Kutch</p>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {distributor.emergency24x7 && <span className="inline-flex items-center gap-1.5 rounded-md border border-[#f1e0c5] bg-[#fbf5ea] px-2 py-1 text-[11px] font-semibold text-[#795c31]"><Clock3 size={12} />24×7 emergency</span>}
          {distributor.coldChain && <span className="inline-flex items-center gap-1.5 rounded-md border border-[#d7e8ee] bg-[#f0f6f8] px-2 py-1 text-[11px] font-semibold text-[#426b7c]"><Snowflake size={12} />Cold-chain</span>}
          {!distributor.emergency24x7 && !distributor.coldChain && <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">Standard service</span>}
        </div>

        <div className="mt-4 border-t border-[#edf1ee] pt-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400"><Building2 size={12} /> Authorized companies</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {distributor.companies.slice(0, 3).map(company => <span key={company} className="rounded-md bg-[#f5f7f5] px-2 py-1 text-[11px] font-medium text-slate-600">{company}</span>)}
            {distributor.companies.length > 3 && <span className="rounded-md bg-[#f5f7f5] px-2 py-1 text-[11px] font-semibold text-slate-500">+{distributor.companies.length - 3} more</span>}
          </div>
        </div>
      </div>
      <button type="button" onClick={() => onOpen(distributor)} className="group/action flex min-h-11 w-full items-center justify-between border-t border-[#edf1ee] bg-[#fbfcfb] px-4 text-xs font-bold text-kpc-700 transition hover:bg-kpc-50 sm:px-[1.15rem]">
        View distributor profile <ArrowUpRight size={15} className="transition group-hover/action:translate-x-0.5 group-hover/action:-translate-y-0.5" />
      </button>
    </article>
  )
}
