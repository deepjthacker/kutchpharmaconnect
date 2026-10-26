import { ArrowUpRight, BadgeCheck, Building2, MapPin, Truck } from 'lucide-react'

export default function CompanyCard({ company, onOpenDistributor }) {
  return (
    <article className="overflow-hidden rounded-[1.15rem] border border-[#e1e8e4] bg-white shadow-[0_2px_10px_rgba(20,45,54,.035)] transition duration-200 hover:border-[#bfded5] hover:shadow-[0_12px_28px_rgba(20,45,54,.075)]">
      <div className="flex items-start gap-3 p-4 sm:p-[1.15rem]">
        <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-kpc-100 bg-gradient-to-br from-kpc-50 to-[#e1f0eb] text-kpc-700"><Building2 size={19} strokeWidth={1.8} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-kpc-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-kpc-700"><BadgeCheck size={11} /> Directory company</span>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 sm:px-[1.15rem]">
        <h3 className="text-[15px] font-bold tracking-[-.02em] text-kpc-950 sm:text-base">{company.name}</h3>
        <p className="mt-1 text-[13px] text-slate-500">{company.distributors.length} verified local {company.distributors.length === 1 ? 'stockist' : 'stockists'}</p>
      </div>
      <div className="divide-y divide-[#edf1ee] border-t border-[#edf1ee]">
        {company.distributors.map(distributor => (
          <button key={distributor.id} type="button" onClick={() => onOpenDistributor(distributor)} className="group flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f6faf8] sm:px-[1.15rem]">
            <Truck className="shrink-0 text-kpc-600" size={17} />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[13px] font-semibold text-slate-800">{distributor.name}</strong>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={12} />{distributor.town}, Kutch</span>
            </span>
            <ArrowUpRight className="shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-kpc-600" size={15} />
          </button>
        ))}
      </div>
    </article>
  )
}
