"""`python -m pdf_engine`: runs the worker until SIGTERM (the container's stop) or SIGINT."""

from __future__ import annotations

import asyncio
import logging
import signal

from bullmq import Queue, Worker

from .config import load
from .storage import S3Storage
from .worker import handle_job


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    config = load()
    storage = S3Storage(config)
    answer = Queue(config.result_queue, {"connection": config.redis_url})

    async def process(job, _token):
        return await handle_job(job.name, job.data, config=config, storage=storage, answer=answer)

    # Parsing is CPU-bound and long: a lock outlives a page or two of work.
    worker = Worker(
        config.parse_queue,
        process,
        {"connection": config.redis_url, "concurrency": config.concurrency, "lockDuration": 120_000},
    )
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    logging.getLogger("pdf_engine").info("waiting for jobs on %s", config.parse_queue)
    await stop.wait()
    await worker.close()
    await answer.close()


if __name__ == "__main__":
    asyncio.run(main())
