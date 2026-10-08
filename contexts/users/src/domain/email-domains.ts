/**
 * Institutional email rules (ADR-0017): personal and disposable mail domains are refused; recognised academic
 * suffixes verify the account and queue the organisation for creation; other domains go to platform-admin review.
 */

/** Personal mailbox providers — an address there says nothing about a college or organisation. */
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.in', 'msn.com',
  'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com', 'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me', 'aol.com', 'gmx.com', 'gmx.net', 'gmx.de', 'mail.com', 'zoho.com',
  'zohomail.com', 'zohomail.in', 'rediffmail.com', 'rediff.com', 'yandex.com', 'yandex.ru', 'tutanota.com', 'tuta.io',
  'fastmail.com', 'hey.com', 'qq.com', '163.com', '126.com', 'sina.com', 'naver.com', 'web.de', 't-online.de', 'mail.ru',
  'inbox.com', 'hushmail.com', 'lycos.com',
])

/** Throwaway inboxes. */
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', 'temp-mail.org', 'tempmail.com',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'mohmal.com', 'emailondeck.com',
])

/** Second-level suffixes used by universities and colleges. */
export const ACADEMIC_SUFFIXES = [
  '.edu', '.edu.in', '.ac.in', '.res.in', '.ernet.in', '.ac.uk', '.edu.au', '.ac.nz', '.edu.sg', '.ac.jp', '.edu.cn', '.ac.za',
  '.edu.pk', '.ac.bd', '.edu.bd', '.edu.np', '.ac.lk', '.edu.my', '.ac.id', '.edu.ph', '.ac.kr', '.edu.tw', '.ac.ae', '.edu.sa',
  '.ac.il', '.edu.eg', '.edu.ng', '.ac.ke', '.edu.br', '.edu.mx', '.edu.ar', '.edu.co', '.ac.at', '.ac.be',
]

export const domainOf = (email: string): string => email.slice(email.lastIndexOf('@') + 1).toLowerCase()

export const isPersonalOrDisposable = (domain: string): boolean => FREE_MAIL_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(domain)

export const isAcademic = (domain: string): boolean => ACADEMIC_SUFFIXES.some((s) => domain.endsWith(s) && domain.length > s.length)

/** The domain and every parent domain down to two labels: cse.iitb.ac.in → [cse.iitb.ac.in, iitb.ac.in, ac.in]. */
export function domainAndParents(domain: string): string[] {
  const labels = domain.split('.')
  const out: string[] = []
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join('.'))
  return out
}
