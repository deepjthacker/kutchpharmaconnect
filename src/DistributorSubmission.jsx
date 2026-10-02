import React,{useState} from 'react'
import {CheckCircle2,LoaderCircle,Send,Truck,X} from 'lucide-react'
import {supabase} from './lib/supabase'

const initial={distributor_name:'',legal_name:'',contact_person:'',mobile:'',whatsapp:'',email:'',address:'',city:'',district:'Kutch',state:'Gujarat',maps_url:'',website:'',companies_handled:'',notes:''}

export default function DistributorSubmission(){
  const [open,setOpen]=useState(false),[form,setForm]=useState(initial),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('')
  function close(){setOpen(false);setSent(false);setError('');setBusy(false)}
  function update(key,value){setForm(x=>({...x,[key]:value}))}
  async function submit(e){
    e.preventDefault();setBusy(true);setError('')
    const payload={...form,distributor_name:form.distributor_name.trim(),mobile:form.mobile.trim(),companies_handled:form.companies_handled.trim(),email:form.email.trim()||null}
    const {error}=await supabase.from('distributor_submissions').insert(payload)
    if(error){setError(error.message);setBusy(false);return}
    setSent(true);setBusy(false)
  }
  return <>
    <button className="distributor-submit-cta" onClick={()=>{setOpen(true);setSent(false);setError('')}}><Truck size={17}/><span><strong>Are you a distributor?</strong><small>Add your company & distributorship details</small></span></button>
    {open&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}>
      <div className="report-modal distributor-submit-modal">
        <button className="report-close" onClick={close} aria-label="Close"><X size={18}/></button>
        {!sent?<><p className="section-kicker">DISTRIBUTOR SUBMISSION</p><h2>List Your Distributorship</h2><p className="report-help">Submit your distributor and company-handling details. We will review the information before adding it to the live KutchPharmaConnect directory.</p>
          <form onSubmit={submit}>
            <div className="submission-form-grid">
              <label>Distributor name <span className="required">*</span><input required value={form.distributor_name} onChange={e=>update('distributor_name',e.target.value)} placeholder="Business / distributor name"/></label>
              <label>Legal name<input value={form.legal_name} onChange={e=>update('legal_name',e.target.value)} placeholder="Legal entity name"/></label>
              <label>Contact person<input value={form.contact_person} onChange={e=>update('contact_person',e.target.value)} placeholder="Name"/></label>
              <label>Mobile <span className="required">*</span><input required value={form.mobile} onChange={e=>update('mobile',e.target.value)} placeholder="+91..."/></label>
              <label>WhatsApp<input value={form.whatsapp} onChange={e=>update('whatsapp',e.target.value)} placeholder="+91..."/></label>
              <label>Email<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="business@example.com"/></label>
              <label>City<input value={form.city} onChange={e=>update('city',e.target.value)} placeholder="Bhuj, Gandhidham, Mundra..."/></label>
              <label>Google Maps link<input value={form.maps_url} onChange={e=>update('maps_url',e.target.value)} placeholder="https://maps.google.com/..."/></label>
              <label className="submission-wide">Address<textarea rows="2" value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Business address"/></label>
              <label className="submission-wide">Companies / divisions handled <span className="required">*</span><textarea required rows="6" value={form.companies_handled} onChange={e=>update('companies_handled',e.target.value)} placeholder={'Example:\nSun Pharmaceutical Industries — All Divisions\nZydus Healthcare — General Division\nPfizer — All Divisions'}/></label>
              <label className="submission-wide">Website<input value={form.website} onChange={e=>update('website',e.target.value)} placeholder="https://..."/></label>
              <label className="submission-wide">Additional notes<textarea rows="3" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Territory, special divisions, or anything else we should know"/></label>
            </div>
            {error&&<div className="report-error">{error}</div>}
            <button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Submitting…</>:<><Send size={16}/> Submit Distributor Details</>}</button>
          </form>
        </>:<div className="report-success"><CheckCircle2 size={42}/><h2>Submission received</h2><p>Thank you. Your details have been sent to the KutchPharmaConnect admin for review. They will be checked before publication.</p><button onClick={close}>Close</button></div>}
      </div>
    </div>}
  </>
}
