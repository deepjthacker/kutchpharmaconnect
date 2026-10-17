import React, { useState } from 'react'
import { Star, LoaderCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function ProfileReviews({ profile }) {
  const [rating, setRating] = useState(0)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const entityId = profile?.entity?.id

  async function submitRating() {
    if (!rating || !entityId) return
    setSending(true)
    setError('')
    setNotice('')
    const { error: submitError } = await supabase.from('profile_reviews').insert({
      entity_type: 'distributor',
      entity_id: entityId,
      reviewer_name: 'Rating-only submission',
      rating,
      review_text: 'No written review provided.',
      status: 'pending'
    })
    if (submitError) {
      setError('Your rating could not be submitted. Please try again later.')
    } else {
      setNotice('Thank you. Your rating has been submitted for approval.')
      setRating(0)
    }
    setSending(false)
  }

  return (
    <section className="profile-reviews profile-rating-only" aria-labelledby="profile-rating-heading">
      <div className="profile-reviews-heading">
        <div>
          <p className="profile-kicker">RATE THIS DISTRIBUTOR</p>
          <h3 id="profile-rating-heading">Rate their service</h3>
          <p>Select a star rating. No written review is required.</p>
        </div>
      </div>
      <div className="review-rating-picker" role="group" aria-label="Choose a rating from one to five stars">
        {[1,2,3,4,5].map(value => (
          <button type="button" key={value} onClick={() => setRating(value)} aria-label={value + ' star' + (value === 1 ? '' : 's')} aria-pressed={rating === value} className={value <= rating ? 'selected' : ''}>
            <Star size={27} fill={value <= rating ? 'currentColor' : 'none'}/>
          </button>
        ))}
        <span>{rating ? `${rating}/5` : 'Choose stars'}</span>
      </div>
      <button className="profile-review-submit" type="button" onClick={submitRating} disabled={sending || !rating || !entityId}>
        {sending ? <LoaderCircle className="spin" size={15}/> : <Star size={15}/>}
        {sending ? 'Submitting…' : 'Submit Rating'}
      </button>
      {error && <p className="profile-review-error" role="alert">{error}</p>}
      {notice && <p className="profile-review-success" role="status">{notice}</p>}
      <p className="profile-review-note">Ratings are checked before they affect the public score.</p>
    </section>
  )
}
