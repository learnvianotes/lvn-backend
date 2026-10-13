import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import type { Embeddings } from '@lvn-backend/facades'
import { AiGateway } from './ai-gateway'

/** The EMBEDDINGS facade (ADR-0060): the gateway's embeddings for `notes`' chunks and semantic search. */
@Injectable()
export class AiEmbeddings implements Embeddings {
  constructor(private readonly gateway: AiGateway) {}

  model(): Promise<string | null> {
    return this.gateway.embedModel()
  }

  async embed(texts: string[], who: { userId: string | null; private: boolean; task: string }): Promise<{ model: string; vectors: number[][] }> {
    const model = await this.gateway.embedModel()
    if (!model) throw Errors.unavailable('AI is not switched on here.')
    return { model, vectors: await this.gateway.embed(texts, who) }
  }
}
