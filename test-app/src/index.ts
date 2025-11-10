import { BaileysTestApp } from './app.js'

async function main() {
  const app = new BaileysTestApp()
  
  try {
    await app.start()
  } catch (error: unknown) {
    console.error('Failed to start application:', error)
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: unknown) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (error: unknown) => {
  console.error('Unhandled Rejection:', error)
  process.exit(1)
})

main()
