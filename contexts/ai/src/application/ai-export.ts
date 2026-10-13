import { Injectable } from '@nestjs/common'
import type { DataExportPart, ExportFile } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2))

/**
 * The `ai` part of a person's data export (ADR-0018, ADR-0059): what AI tasks made for them, and their AI usage as
 * counts (no content was ever kept of a call).
 */
@Injectable()
export class AiExport implements DataExportPart {
  constructor(private readonly db: PrismaService) {}

  async exportFor(userId: string): Promise<{ files: ExportFile[]; counts: Record<string, number>; omitted: string[] }> {
    const [artifacts, usage] = await Promise.all([
      this.db.noteArtifact.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' }, select: { id: true, noteId: true, task: true, status: true, options: true, payload: true, error: true, keptAt: true, createdAt: true } }),
      this.db.aiUsage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { task: true, model: true, promptTokens: true, completionTokens: true, ok: true, createdAt: true } }),
    ])
    return {
      files: [
        { path: 'data/ai/artifacts.json', bytes: json(artifacts) },
        { path: 'data/ai/usage.json', bytes: json(usage) },
      ],
      counts: { aiResults: artifacts.length, aiCalls: usage.length },
      omitted: [],
    }
  }
}
