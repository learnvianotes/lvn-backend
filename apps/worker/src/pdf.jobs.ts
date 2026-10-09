import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { NOTES_PDF_QUEUE, PdfConversionService } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'

type Messages = Parameters<PdfConversionService['triaged']>[0] & Parameters<PdfConversionService['map']>[0] & Parameters<PdfConversionService['failed']>[0]

/**
 * The PDF engine's answers (ADR-0028): workers/pdf-engine counts a PDF's pages (`triaged`) and reads it (`map`, or
 * `parse-failed`); the notes context decides and makes the cards. Hourly, conversions the engine never answered fail.
 */
@Injectable()
export class PdfJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Pdf')

  constructor(
    private readonly queues: Queues,
    private readonly conversions: PdfConversionService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(
      NOTES_PDF_QUEUE,
      {
        triaged: async (data) => this.conversions.triaged(data as Messages),
        map: async (data) => this.conversions.map(data as Messages),
        'parse-failed': async (data) => this.conversions.failed(data as Messages),
        'expire-stuck': async () => {
          const expired = await this.conversions.expireStuck()
          if (expired) this.log.warn(`${expired} PDF conversion(s) the engine never answered failed`)
          return { expired }
        },
      },
      2,
    )
    await this.queues.repeat(NOTES_PDF_QUEUE, 'expire-stuck', '20 * * * *')
  }
}
