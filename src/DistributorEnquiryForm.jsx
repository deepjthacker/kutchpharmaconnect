import React, { useState } from 'react'
import { CheckCircle2, LoaderCircle, X } from 'lucide-react'
import { submitDistributorEnquiry } from './lib/distributorTracking'
import './distributor-enquiry.css'

export default function DistributorEnquiryForm({ distributor, context = {}, onClose }) {
  const [customerName, setCustomerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(() => {
    if (context.product_name) return `I would like to enquire about ${context.product_name}. Please share availability and details.`
    if (context.company_name) return `I would like to enquire about ${context.company_name}. Please share the relevant details.`
    return 'I would like to enquire about your listed distributorships and products in Kutch.'
  })
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: submitError } = await submitDistributorEnquiry({
      distributor_id: distributor?.id || null,
      company_id: context.company_id || null,
      division_id: context.division_id || null,
      brand_id: context.brand_id || null,
      product_id: context.product_id || null,
      distributorship_id: context.distributorship_id || null,
      product_distributor_id: context.product_distributor_id || null,
      customer_name: customerName,
      mobile,
      email: email || null,
      message,
      consent
    })
    setBusy(false)
    if (submitError || !data?.ok) {
      setError(submitError?.message || data?.error || 'Your enquiry could not be submitted. Please try again.')
      return
    }
    setSuccess(true)
  }

  return (
    <div className="kpc-enquiry-backdrop" role="presentation">
      <section className="kpc-enquiry-modal" role="dialog" aria-modal="true" aria-labelledby="kpc-enquiry-title">
        <button type="button" className="kpc-enquiry-close" onClick={onClose} aria-label="Close enquiry form"><X size={18}/></button>
        {success ? (
          <div className="kpc-enquiry-success">
            <CheckCircle2 size={34}/>
            <h2 id="kpc-enquiry-title">Enquiry submitted</h2>
            <p>Your enquiry has been received by KutchPharmaConnect. The admin team can review it and coordinate with the selected distributor.</p>
            <button type="button" className="kpc-enquiry-submit" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <p className="section-kicker">CUSTOMER ENQUIRY</p>
            <h2 id="kpc-enquiry-title">Contact {distributor?.distributor_name || 'distributor'}</h2>
            <p className="kpc-enquiry-intro">Share your contact details and what you need. This enquiry will be recorded in KPC for admin follow-up.</p>
            <form className="kpc-enquiry-form" onSubmit={handleSubmit}>
              <label>Your name<input value={customerName} onChange={e=>setCustomerName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" /></label>
              <label>Mobile number<input value={mobile} onChange={e=>setMobile(e.target.value)} required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="+91" /></label>
              <label>Email <span>(optional)</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="email" /></label>
              <label>Enquiry details<textarea value={message} onChange={e=>setMessage(e.target.value)} required minLength={5} maxLength={1500} rows={4}/></label>
              <label className="kpc-enquiry-consent">
                <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required />
                <span>I agree that KutchPharmaConnect may use these details to process this enquiry and share relevant information with the selected distributor for a response.</span>
              </label>
              {error && <p className="kpc-enquiry-error" role="alert">{error}</p>}
              <button type="submit" className="kpc-enquiry-submit" disabled={busy || !consent}>
                {busy ? <><LoaderCircle size={16} className="spin"/> Submitting…</> : 'Submit Enquiry'}
              </button>
            </form>
            <p className="kpc-enquiry-privacy">Do not include prescriptions, diagnoses or other sensitive medical information in this form.</p>
          </>
        )}
      </section>
    </div>
  )
}
