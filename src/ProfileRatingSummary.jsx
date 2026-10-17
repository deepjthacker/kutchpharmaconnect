import React, { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function ProfileRatingSummary({ distributorId }) {
  const [summary, setSummary] = useState({ average: 0, count: 0, loaded: false })

  useEffect(() => {
    let active = true
    async function load() {
      if (!distributorId) return
      const { data, error } = await supabase
        .from('profile_reviews')
        .select('rating')
        .eq('entity_type', 'distributor')
        .eq('entity_id', distributorId)
        .eq('status', 'approved')
      if (!active) return
      if (error) {
        setSummary({ average: 0, count: 0, loaded: true })
        return
      }
      const ratings = data || []
      setSummary({
        average: ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : 0,
        count: ratings.length,
        loaded: true
      })
    }
    load()
    return () => { active = false }
  }, [distributorId])

  const filled = Math.round(summary.average)
  return (
    <div className="profile-rating-summary" aria-label={summary.count ? `Average rating ${summary.average.toFixed(1)} out of 5 from ${summary.count} ratings` : 'No approved ratings yet'}>
      <span className="profile-rating-stars" aria-hidden="true">
        {[1,2,3,4,5].map(value => <Star key={value} size={15} fill={value <= filled ? 'currentColor' : 'none'} />)}
      </span>
      {summary.count > 0
        ? <span className="profile-rating-label">{summary.average.toFixed(1)} · {summary.count} {summary.count === 1 ? 'rating' : 'ratings'}</span>
        : <span className="profile-rating-label">{summary.loaded ? 'No ratings yet' : 'Loading rating…'}</span>}
    </div>
  )
}
