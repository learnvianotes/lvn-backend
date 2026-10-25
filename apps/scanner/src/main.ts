import { loadScannerConfig } from './config'
import { createScanServer } from './server'

const config = loadScannerConfig(process.env)
const { server } = createScanServer(config)
server.listen(config.port, config.bind, () => {
  console.log(JSON.stringify({ time: new Date().toISOString(), service: 'lvn-scanner', level: 'info', msg: 'listening', bind: config.bind, port: config.port }))
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5_000).unref()
  })
}
