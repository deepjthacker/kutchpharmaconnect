import { useEffect } from 'react'
import { BadgeCheck, Building2, Clock3, MapPin, Phone, ShieldCheck, Snowflake, Truck, X } from 'lucide-react'

export default function DistributorDetailDialog({ distributor, onClose }) {
  useEffect(() => {
    if (!distributor) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [distributor, onClose])

  if (!distributor) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-kpc-950/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="v1-detail-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white shadow-[0_28px_90px_rgba(4,22,34,.3)] sm:max-w-xl sm:rounded-[1.5rem]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#edf1ee] bg-white/95 px-5 py-3.5 backdrop-blur sm:px-7">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-kpc-600"><span className="size-1.5 rounded-full bg-kpc-500" /> Distributor profile</span>
          <button type="button" autoFocus onClick={onClose} aria-label="Close distributor details" className="grid size-9 place-items-center rounded-full bg-[#f2f5f3] text-slate-600 transition hover:bg-[#e7eeea]"><X size={17} /></button>
        </div>
        <div className="px-5 pb-7 pt-5 sm:px-7">
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-[18px] border border-kpc-100 bg-gradient-to-br from-kpc-50 to-[#dfeee8] text-kpc-700"><Truck size={23} strokeWidth={1.8} /></div>
            <div className="min-w-0">
              <h2 id="v1-detail-title" className="text-xl font-bold leading-tight tracking-[-.025em] text-kpc-950 sm:text-2xl">{distributor.name}</h2>
              <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-5 text-slate-500"><MapPin size={14} className="mt-0.5 shrink-0 text-kpc-600" />{distributor.address}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-kpc-100 bg-kpc-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-kpc-700"><BadgeCheck size={12} /> Verified distributor</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e8eeea] bg-[#f8faf8] p-3.5"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Contact person</span><p className="mt-1.5 text-[13px] font-semibold text-slate-800">{distributor.contactPerson}</p></div>
            <div className="rounded-xl border border-[#e8eeea] bg-[#f8faf8] p-3.5"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Phone / WhatsApp</span><p className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-slate-800"><Phone size={13} className="text-kpc-600" />{distributor.phone}</p></div>
            <div className="rounded-xl border border-[#e8eeea] bg-[#f8faf8] p-3.5"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Drug license · Form 20B</span><p className="mt-1.5 text-[13px] font-semibold text-slate-800">{distributor.license20B}</p></div>
            <div className="rounded-xl border border-[#e8eeea] bg-[#f8faf8] p-3.5"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Drug license · Form 21B</span><p className="mt-1.5 text-[13px] font-semibold text-slate-800">{distributor.license21B}</p></div>
          </div>

          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-kpc-950"><ShieldCheck size={15} className="text-kpc-600" />Service capabilities</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {distributor.emergency24x7 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><Clock3 size={13} />24×7 emergency</span>}
              {distributor.coldChain && <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"><Snowflake size={13} />Cold-chain available</span>}
              {!distributor.emergency24x7 && !distributor.coldChain && <span className="text-sm text-slate-500">Standard distribution service</span>}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-kpc-950"><Building2 size={15} className="text-kpc-600" />Verified company authorizations</h3>
            <ul className="mt-2 divide-y divide-[#edf1ee] rounded-xl border border-[#e4eae6]">
              {distributor.companies.map(company => <li key={company} className="px-3.5 py-3 text-sm font-medium text-slate-700">{company}</li>)}
            </ul>
          </div>

          <div className="mt-5 rounded-lg border border-[#eadbc5] bg-[#fbf6ed] px-3 py-2.5 text-[11px] leading-relaxed text-[#745b3b]"><strong>Sample profile:</strong> Contact and license details are fictional placeholders for this preview.</div>
        </div>
      </section>
    </div>
  )
}
