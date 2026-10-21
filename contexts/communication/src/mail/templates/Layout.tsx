import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

/** Brand palette (lvn-backend docs/design/ui-reference.md, ADR-0094): the brand blue #2563EB on a quiet background. */
export const brand = { primary: '#2563EB', text: '#111827', muted: '#5B6475', background: '#F6F8FB', card: '#FFFFFF', border: '#E3E8EF' }

/** The frame every LearnViaNotes email shares: wordmark, one card, a quiet footer. */
export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: brand.background, fontFamily: 'Inter, -apple-system, Segoe UI, Roboto, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
          <Text style={{ fontSize: 20, fontWeight: 800, color: brand.text, margin: '0 0 16px' }}>
            LearnVia<span style={{ color: brand.primary }}>Notes</span>
          </Text>
          <Section style={{ backgroundColor: brand.card, border: `1px solid ${brand.border}`, borderRadius: 16, padding: 24 }}>{children}</Section>
          <Hr style={{ borderColor: brand.border, margin: '24px 0 12px' }} />
          <Text style={{ fontSize: 12, color: brand.muted, margin: 0 }}>
            You received this email because of activity on your LearnViaNotes account. If it was not you, you can ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const paragraph = { fontSize: 15, lineHeight: '24px', color: brand.text, margin: '0 0 16px' }
export const muted = { fontSize: 13, lineHeight: '20px', color: brand.muted, margin: '16px 0 0' }
export const button = {
  backgroundColor: brand.primary,
  color: '#FFFFFF',
  borderRadius: 12,
  padding: '12px 20px',
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
