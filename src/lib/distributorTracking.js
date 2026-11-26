import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase'

const SESSION_KEY = 'kpc-distributor-activity-session'
let currentProfile = null

function getSessionId() {
  if (typeof window === 'undefined') return null
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = window.crypto?.randomUUID?.() || null
      if (id) window.sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function requestContext() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    source_page: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    session_id: getSessionId()
  }
}

export function setCurrentProfile(type, id) {
  currentProfile = type && id ? { profile_type: type, profile_id: id } : null
}

export function trackKpcAnalyticsEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params)
  }
}

function sendActivity(body) {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const endpoint = `${SUPABASE_URL}/functions/v1/record-distributor-activity`
  return fetch(endpoint, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    },
    body: JSON.stringify(body)
  }).then(response => {
    if (!response.ok) throw new Error(`Tracking endpoint returned ${response.status}`)
    return true
  }).catch(error => {
    console.warn('KPC activity tracking failed:', error?.message || error)
    return false
  })
}

export function trackProfileView(type, id, context = {}) {
  if (!type || !id) return Promise.resolve(false)
  setCurrentProfile(type, id)
  const details = {
    event_type: 'profile_view',
    profile_type: type,
    profile_id: id,
    ...context
  }
  trackKpcAnalyticsEvent(`${type}_view`, {
    profile_type: type,
    profile_id: id,
    company_id: context.company_id || undefined,
    source_page: typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined
  })
  return sendActivity({ action: 'event', ...requestContext(), ...details })
}

export function trackDistributorActivity(details = {}) {
  if (!details.event_type) return Promise.resolve(false)
  const profile = currentProfile || (
    details.distributor_id ? { profile_type: 'distributor', profile_id: details.distributor_id } : null
  )
  const payload = {
    ...requestContext(),
    ...profile,
    ...details,
    action: 'event'
  }
  trackKpcAnalyticsEvent(`distributor_${details.event_type}`, {
    distributor_id: details.distributor_id || undefined,
    profile_type: payload.profile_type || undefined,
    profile_id: payload.profile_id || undefined,
    company_id: details.company_id || undefined,
    source_page: payload.source_page
  })
  return sendActivity(payload)
}

export async function submitDistributorEnquiry(details = {}) {
  return supabase.functions.invoke('record-distributor-activity', {
    body: { action: 'enquiry', ...requestContext(), ...details }
  })
}
