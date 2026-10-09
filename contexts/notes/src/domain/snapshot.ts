import type { CardType } from '@lvn/contracts/domain'

/** A card as stored in a version snapshot (§4.3). */
export interface SnapshotCard {
  id: string
  type: CardType
  position: string
  content: unknown
  revision: number
}
