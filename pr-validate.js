const appFn = require('./')
const { FULL_SYNC_NOP } = require('./lib/env')
const { createProbot } = require('probot')

async function validatePR (appFn, nop) {
  const probot = createProbot()
  probot.log.info(`Starting PR validation with NOP=${nop}`)

  try {
    const app = appFn(probot, {})
    // Use github.ref and github.sha from the action context
    const settings = await app.validatePR(nop)

    if (settings.errors && settings.errors.length > 0) {
      probot.log.error('Errors occurred during PR validation.')
      process.exit(1)
    }

    probot.log.info('PR validation completed successfully.')
  } catch (error) {
    process.stdout.write(`Unexpected error during PR validation: ${error}\n`)
    process.exit(1)
  }
}

validatePR(appFn, FULL_SYNC_NOP).catch((error) => {
  console.error('Fatal error during PR validation:', error)
  process.exit(1)
})
