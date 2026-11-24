import { supabase } from './supabase'

const SESSION_KEY = 'kpc-distributor-activity-session'

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
    source_page: window.location.pathname,
    referrer: document.referrer || null,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    session_id: getSessionId()
  }
}

export function trackKpcAnalyticsEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params)
  }
}

export async function trackDistributorActivity(details = {}) {
  if (!details.distributor_id) return
  trackKpcAnalyticsEvent(`distributor_${details.event_type}`, {
    distributor_id: details.distributor_id,
    company_id: details.company_id || undefined,
    source_page: typeof window !== 'undefined' ? window.location.pathname : undefined
  })
  try {
    const { error } = await supabase.functions.invoke('record-distributor-activity', {
      body: { action: 'event', ...requestContext(), ...details }
    })
    if (error) console.warn('KPC activity tracking failed:', error.message)
  } catch (error) {
    console.warn('KPC activity tracking failed:', error?.message || error)
  }
}

export async function submitDistributorEnquiry(details = {}) {
  return supabase.functions.invoke('record-distributor-activity', {
    body: { action: 'enquiry', ...requestContext(), ...details }
  })
}
