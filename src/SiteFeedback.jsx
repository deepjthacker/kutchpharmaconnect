import React, { useState } from 'react'
import { MessageSquareWarning, Star, Send, X, LoaderCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from './lib/supabase'

const types = [
  ['general', 'Overall website experience'],
  ['bug', 'Something is not working'],
  ['performance', 'Slow loading or performance'],
  ['mobile', 'Mobile or layout problem'],
  ['data_accuracy', 'Incorrect or missing directory data'],
  ['suggestion', 'Suggestion for improvement'],
  ['other', 'Other']
]
const starText = n => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function SiteFeedback() {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [type, setType] = useState('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function close() { setOpen(false) }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (message.trim().length < 5) { setError('Please describe your experience in at least 5 characters.'); return }
    setBusy(true)
    const { error: submitError } = await supabase.from('website_feedback').insert({
      rating,
      feedback_type: type,
      feedback_text: message.trim(),
      page_path: window.location.pathname + window.location.search,
      contact_email: email.trim() || null,
      status: 'open'
    })
    if (submitError) setError('Feedback could not be submitted right now. Please try again later.')
    else {
      setSent(true)
      setMessage('')
      setEmail('')
    }
    setBusy(false)
  }

  return <>
    <button className="site-feedback-trigger" onClick={() => { setOpen(true); setSent(false); setError('') }}><MessageSquareWarning size={14}/> Rate this website / Report a problem</button>
    {open && <div className="report-overlay" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="report-modal site-feedback-modal" role="dialog" aria-modal="true" aria-labelledby="site-feedback-title">
        <button className="report-close" onClick={close} aria-label="Close"><X size={18}/></button>
        {!sent ? <>
          <p className="section-kicker">HELP IMPROVE KUTCHPHARMACONNECT</p>
          <h2 id="site-feedback-title">Rate our website</h2>
          <p className="report-help">Tell us whether the website is working well for you. Report errors, slow pages, mobile issues, or incorrect directory information. Your feedback is sent privately to the admin team.</p>
          <form onSubmit={submit}>
            <label>How would you rate your experience?</label>
            <div className="review-rating-picker" role="group" aria-label="Rate website from one to five stars">
              {[1,2,3,4,5].map(value => <button type="button" key={value} onClick={() => setRating(value)} aria-label={value + ' star' + (value === 1 ? '' : 's')} aria-pressed={rating === value} className={value <= rating ? 'selected' : ''}><Star size={24} fill={value <= rating ? 'currentColor' : 'none'}/></button>)}
              <span>{rating}/5</span>
            </div>
            <label>What is your feedback about?
              <select value={type} onChange={e => setType(e.target.value)}>{types.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label>Describe your experience <span className="required">*</span>
              <textarea required minLength={5} maxLength={1500} rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Example: The distributor page loads slowly on my phone, or the search results are working correctly."/>
            </label>
            <label>Email for follow-up <span className="optional-label">optional</span>
              <input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
            </label>
            <p className="profile-review-note">Your feedback is private and will not appear publicly. Do not include passwords or sensitive personal information.</p>
            {error && <div className="report-error" role="alert">{error}</div>}
            <button className="report-submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Sending…</> : <><Send size={15}/> Send Feedback</>}</button>
          </form>
        </> : <div className="report-success"><CheckCircle2 size={42}/><h2>Thank you for your feedback</h2><p>Your rating and report have been sent to the KutchPharmaConnect admin team for review.</p><button onClick={close}>Close</button></div>}
      </div>
    </div>}
  </>
}
