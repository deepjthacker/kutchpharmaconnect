import React, { useEffect, useState } from 'react'
import { Star, Send, LoaderCircle, MessageSquareText } from 'lucide-react'
import { supabase } from './lib/supabase'

const entityName = profile => profile?.type === 'company' ? profile?.entity?.company_name : profile?.entity?.distributor_name
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function ProfileReviews({ profile }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [name, setName] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const entityId = profile?.entity?.id
  const entityType = profile?.type
  const title = entityName(profile)

  async function loadReviews() {
    if (!entityId || !entityType) { setLoading(false); return }
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('profile_reviews')
      .select('id, reviewer_name, rating, review_text, created_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(30)
    if (loadError) setError('Reviews could not be loaded right now.')
    else setReviews(data || [])
    setLoading(false)
  }

  useEffect(() => { loadReviews() }, [entityId, entityType])

  async function submitReview(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (name.trim().length < 2) { setError('Please enter your name (at least 2 characters).'); return }
    if (reviewText.trim().length < 10) { setError('Please write at least 10 characters about your experience.'); return }
    setSending(true)
    const { error: submitError } = await supabase.from('profile_reviews').insert({
      entity_type: entityType,
      entity_id: entityId,
      reviewer_name: name.trim(),
      rating,
      review_text: reviewText.trim(),
      status: 'pending'
    })
    if (submitError) {
      setError('Your review could not be submitted. Please try again later.')
    } else {
      setNotice('Thank you. Your review has been submitted for admin approval.')
      setName('')
      setReviewText('')
      setRating(5)
      await loadReviews()
    }
    setSending(false)
  }

  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  return <section className="profile-reviews" aria-labelledby="profile-reviews-heading">
    <div className="profile-reviews-heading">
      <div>
        <p className="profile-kicker">COMMUNITY FEEDBACK</p>
        <h3 id="profile-reviews-heading">Reviews & Ratings</h3>
        <p>Share your experience with {title}. Reviews appear after admin approval.</p>
      </div>
      <MessageSquareText size={23} />
    </div>
    {reviews.length > 0 && <div className="profile-review-summary">
      <strong>{average.toFixed(1)}</strong><span className="review-stars" aria-label={average.toFixed(1) + ' out of 5 stars'}>{stars(Math.round(average))}</span><span>{reviews.length} approved {reviews.length === 1 ? 'review' : 'reviews'}</span>
    </div>}
    {loading ? <p className="profile-review-muted"><LoaderCircle className="spin" size={16}/> Loading reviews…</p> :
      reviews.length ? <div className="profile-review-list">
        {reviews.map(review => <article className="profile-review-item" key={review.id}>
          <div className="profile-review-top"><strong>{review.reviewer_name}</strong><span className="review-stars" aria-label={review.rating + ' out of 5 stars'}>{stars(review.rating)}</span></div>
          <p>{review.review_text}</p>
          <small>{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
        </article>)}
      </div> : <p className="profile-review-muted">No reviews yet. Be the first to share your experience.</p>}
    <form className="profile-review-form" onSubmit={submitReview}>
      <h4>Write a review</h4>
      <label>Your rating</label>
      <div className="review-rating-picker" role="group" aria-label="Choose a rating">
        {[1,2,3,4,5].map(value => <button type="button" key={value} onClick={() => setRating(value)} aria-label={value + ' star' + (value === 1 ? '' : 's')} aria-pressed={rating === value} className={value <= rating ? 'selected' : ''}><Star size={23} fill={value <= rating ? 'currentColor' : 'none'}/></button>)}
        <span>{rating}/5</span>
      </div>
      <label htmlFor="reviewer-name">Your name</label>
      <input id="reviewer-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required placeholder="Enter your name" />
      <label htmlFor="review-text">Your experience</label>
      <textarea id="review-text" value={reviewText} onChange={e => setReviewText(e.target.value)} minLength={10} maxLength={1200} required rows={4} placeholder="Write a fair and factual review (10–1,200 characters)." />
      <p className="profile-review-note">Please keep reviews factual and respectful. Do not include medical advice or private information.</p>
      {error && <p className="profile-review-error" role="alert">{error}</p>}
      {notice && <p className="profile-review-success" role="status">{notice}</p>}
      <button className="profile-review-submit" type="submit" disabled={sending}><Send size={15}/>{sending ? 'Submitting…' : 'Submit for Approval'}</button>
    </form>
  </section>
}
