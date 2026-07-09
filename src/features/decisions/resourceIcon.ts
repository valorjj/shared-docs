import type { ComponentType } from 'react'
import { CirclePlay, FileSignature, FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, Receipt } from 'lucide-react'
import type { PlanResource } from './types'

export type ResourceIconSpec = {
  Icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  tintVar: string
  colorVar: string
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Pure classifier: kind + URL domain + content-type + filename → icon and
 * tint tokens. Resource kind (LINK/FILE) always branches first. Priority
 * within FILE: filename hints (영수증/계약) beat content-type, since a
 * scanned receipt is still a PDF/JPEG at the content-type level.
 */
export function resourceIconSpec(resource: PlanResource): ResourceIconSpec {
  if (resource.kind === 'LINK') {
    const host = resource.url ? hostOf(resource.url) : null
    if (host && YOUTUBE_HOSTS.has(host)) {
      return { Icon: CirclePlay, tintVar: 'var(--c-accent-soft)', colorVar: 'var(--c-accent)' }
    }
    return { Icon: LinkIcon, tintVar: 'var(--c-primary-soft)', colorVar: 'var(--c-primary)' }
  }

  const name = (resource.originalFilename ?? '').toLowerCase()
  const contentType = resource.contentType ?? ''
  if (name.includes('영수증') || name.includes('receipt')) {
    return { Icon: Receipt, tintVar: 'var(--c-primary-soft)', colorVar: 'var(--c-primary)' }
  }
  if (name.includes('계약') || name.includes('contract')) {
    return { Icon: FileSignature, tintVar: 'var(--c-primary-soft-strong)', colorVar: 'var(--c-primary)' }
  }
  if (contentType.startsWith('image/')) {
    return { Icon: ImageIcon, tintVar: 'var(--c-surface-tint)', colorVar: 'var(--c-text-muted)' }
  }
  if (contentType.startsWith('text/') || contentType.includes('pdf')) {
    return { Icon: FileText, tintVar: 'var(--c-surface-tint)', colorVar: 'var(--c-text-muted)' }
  }
  return { Icon: Paperclip, tintVar: 'var(--c-surface-tint)', colorVar: 'var(--c-text-muted)' }
}
