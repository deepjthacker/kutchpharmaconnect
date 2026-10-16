import React, { useState } from 'react'
import { Share2, Download, Link2, Check, Image as ImageIcon } from 'lucide-react'

const colors = {
  navy: '#102b46',
  blue: '#175d83',
  teal: '#18a6a6',
  ink: '#172b3a',
  muted: '#5c6b78',
  line: '#dce5eb',
  paper: '#f5f8fa',
  green: '#16794b',
  paleGreen: '#e5f6ee',
  paleBlue: '#e9f3f8',
}

const absoluteSiteUrl = () => {
  const base = import.meta.env.BASE_URL || '/'
  return window.location.origin + base
}
const getName = (profile) => profile?.type === 'company'
  ? profile?.entity?.company_name
  : profile?.entity?.distributor_name
const getRelationshipName = (profile, rel) => profile?.type === 'company'
  ? rel?.distributor?.distributor_name
  : rel?.company?.company_name
const getRelationshipLocation = (rel) => {
  const loc = rel?.location
  return loc ? [loc.city, loc.district, loc.state].filter(Boolean).join(', ') : (rel?.territory || 'Kutch, Gujarat')
}
const slug = (value) => String(value || 'business')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'business'
const getShareUrl = (profile, siteUrl) => {
  const base = String(siteUrl || absoluteSiteUrl()).replace(/\/$/, '')
  const entity = profile?.entity || {}
  const kind = profile?.type === 'company' ? 'companies' : 'distributors'
  return entity.id ? `${base}/${kind}/${slug(getName(profile))}-${String(entity.id).slice(0, 8)}/` : (typeof window !== 'undefined' ? window.location.href : base)
}
const safeFileName = (value) => String(value || 'directory-profile')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'directory-profile'

function roundedRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke() }
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  words.forEach(word => {
    const candidate = line ? line + ' ' + word : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else line = candidate
  })
  if (line) lines.push(line)
  return lines
}

function drawShareCard(profile, siteUrl, profileUrl) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not create the share image.')

  ctx.fillStyle = colors.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = colors.navy
  ctx.fillRect(0, 0, canvas.width, 270)
  ctx.fillStyle = colors.teal
  ctx.fillRect(0, 260, canvas.width, 10)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 40px Arial, sans-serif'
  ctx.fillText('KutchPharmaConnect', 66, 82)
  ctx.fillStyle = '#d6e8f1'
  ctx.font = '24px Arial, sans-serif'
  ctx.fillText('Kutch Pharmaceutical & Healthcare Directory', 66, 126)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 22px Arial, sans-serif'
  ctx.fillText('FIND WHO HANDLES WHAT IN KUTCH', 66, 204)

  const isCompany = profile?.type === 'company'
  const entity = profile?.entity || {}
  const title = getName(profile) || 'Directory profile'
  const rels = profile?.relationships || []
  const verifiedCount = rels.filter(rel => rel.verification_status === 'verified').length

  ctx.fillStyle = colors.blue
  ctx.font = '700 20px Arial, sans-serif'
  ctx.fillText(isCompany ? 'COMPANY PROFILE' : 'DISTRIBUTOR PROFILE', 66, 330)

  ctx.fillStyle = colors.ink
  ctx.font = '700 42px Arial, sans-serif'
  let titleLines = wrapText(ctx, title, 945)
  if (titleLines.length > 2) titleLines = [titleLines[0], titleLines.slice(1).join(' ').slice(0, 52) + '…']
  let titleY = 390
  titleLines.forEach(line => { ctx.fillText(line, 66, titleY); titleY += 52 })

  const summaryY = titleY + 8
  ctx.fillStyle = colors.muted
  ctx.font = '24px Arial, sans-serif'
  ctx.fillText(`${rels.length} active Kutch ${rels.length === 1 ? 'relationship' : 'relationships'}`, 66, summaryY)
  if (verifiedCount > 0) {
    const verifiedLabel = `${verifiedCount} verified`
    ctx.font = '700 20px Arial, sans-serif'
    const badgeWidth = ctx.measureText(verifiedLabel).width + 36
    roundedRect(ctx, 66, summaryY + 22, badgeWidth, 42, 18, colors.paleGreen)
    ctx.fillStyle = colors.green
    ctx.fillText(verifiedLabel, 84, summaryY + 50)
  }

  let y = summaryY + (verifiedCount > 0 ? 98 : 62)
  ctx.fillStyle = colors.ink
  ctx.font = '700 25px Arial, sans-serif'
  ctx.fillText(isCompany ? 'CURRENTLY HANDLED BY' : 'CURRENTLY HANDLES', 66, y)
  y += 26

  const maxRows = 5
  const shown = rels.slice(0, maxRows)
  shown.forEach((rel, index) => {
    const name = getRelationshipName(profile, rel) || 'Name not available'
    const location = getRelationshipLocation(rel)
    const cardY = y + index * 105
    roundedRect(ctx, 66, cardY, 948, 88, 14, '#ffffff', colors.line)
    ctx.fillStyle = colors.teal
    ctx.beginPath()
    ctx.arc(96, cardY + 30, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = colors.ink
    ctx.font = '700 24px Arial, sans-serif'
    const nameLines = wrapText(ctx, name, 850)
    ctx.fillText(nameLines[0].slice(0, 76), 120, cardY + 36)
    ctx.fillStyle = colors.muted
    ctx.font = '20px Arial, sans-serif'
    ctx.fillText(location.slice(0, 95), 120, cardY + 66)
    if (rel.verification_status === 'verified') {
      ctx.fillStyle = colors.green
      ctx.font = '700 16px Arial, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('VERIFIED', 985, cardY + 34)
      ctx.textAlign = 'left'
    }
  })

  const footerY = y + maxRows * 105 + 10
  if (rels.length > maxRows) {
    ctx.fillStyle = colors.blue
    ctx.font = '700 21px Arial, sans-serif'
    ctx.fillText(`+ ${rels.length - maxRows} more relationship${rels.length - maxRows === 1 ? '' : 's'} on the website`, 66, footerY)
  }

  const footerTop = 1130
  ctx.fillStyle = colors.navy
  ctx.fillRect(0, footerTop, canvas.width, 220)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 25px Arial, sans-serif'
  ctx.fillText('KutchPharmaConnect — Find Who Handles What in Kutch', 66, footerTop + 38)
  ctx.fillStyle = '#d6e8f1'
  ctx.font = '18px Arial, sans-serif'
  ctx.fillText('Pharma company and distributor directory for Kutch, Gujarat.', 66, footerTop + 82)
  ctx.font = '16px Arial, sans-serif'
  ctx.fillText('Directory details may change. Contact the distributor to confirm current information.', 66, footerTop + 136)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 21px Arial, sans-serif'
  ctx.fillText(String(profileUrl || siteUrl || absoluteSiteUrl()).replace(/^https?:\/\//, ''), 66, footerTop + 184)

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the share image.')), 'image/png'))
}

export default function ProfileShareActions({ profile, siteUrl }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const title = getName(profile) || 'KutchPharmaConnect directory profile'
  const profileUrl = getShareUrl(profile, siteUrl)
  const shareText = `${title} | KutchPharmaConnect — Find pharma companies and distributors across Kutch, Gujarat.`

  async function makeImage() {
    return new File(
      [await drawShareCard(profile, siteUrl || absoluteSiteUrl(), profileUrl)],
      `kutchpharmaconnect-${safeFileName(title)}.png`,
      { type: 'image/png' }
    )
  }

  async function downloadImage() {
    setBusy(true)
    setMessage('')
    try {
      const file = await makeImage()
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage('Share image downloaded. You can attach it to WhatsApp, email, or social media.')
    } catch (error) {
      setMessage(error?.message || 'Could not create the share image.')
    } finally {
      setBusy(false)
    }
  }

  async function shareProfile() {
    setBusy(true)
    setMessage('')
    try {
      const file = await makeImage()
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text: shareText, url: profileUrl, files: [file] })
        setMessage('Share sheet opened.')
      } else if (navigator.share) {
        await navigator.share({ title, text: shareText, url: profileUrl })
        setMessage('Share link opened. Download the image separately if you want to share the profile card.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileUrl)
        setMessage('Profile link copied. Download the share image to send both together.')
      } else {
        setMessage('Use Copy Link or Download Screenshot below to share this profile.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage(error?.message || 'Sharing was not available. Use Download Screenshot or Copy Link.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileUrl)
        setMessage('Profile link copied to clipboard.')
      } else {
        window.prompt('Copy this profile link:', profileUrl)
      }
    } catch {
      window.prompt('Copy this profile link:', profileUrl)
    }
  }

  return (
    <div className="profile-share-wrap">
      <div className="profile-share-actions">
        <button type="button" className="profile-share-primary" onClick={shareProfile} disabled={busy}>
          <Share2 size={16} /> {busy ? 'Preparing…' : 'Share Profile'}
        </button>
        <button type="button" className="profile-share-secondary" onClick={downloadImage} disabled={busy}>
          <ImageIcon size={16} /> Download Screenshot
        </button>
        <button type="button" className="profile-share-secondary" onClick={copyLink}>
          <Link2 size={16} /> Copy Link
        </button>
      </div>
      <p className="profile-share-caption">Share a branded profile image with the KutchPharmaConnect link and directory description.</p>
      {message && <p className="profile-share-status" role="status"><Check size={14} /> {message}</p>}
    </div>
  )
}
