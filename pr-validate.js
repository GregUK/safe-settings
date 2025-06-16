const appFn = require('./')
const { FULL_SYNC_NOP } = require('./lib/env')
const { createProbot } = require('probot')

async function validatePR (appFn, nop = true) {
  const probot = createProbot()
  probot.log.info(`Starting PR validation with NOP=${nop}`)

  try {
    const app = appFn(probot, {})
    probot.log.trace('Fetching installations')
    const github = await probot.auth()

    const installations = await github.paginate(
      github.apps.listInstallations.endpoint.merge({ per_page: 100 })
    )

    if (installations.length > 0) {
      const installation = installations[0]
      const github = await probot.auth(installation.id)

      // Get PR details from GitHub context
      const pr = await github.pulls.get({
        owner: installation.account.login,
        repo: env.ADMIN_REPO,
        pull_number: process.env.GITHUB_EVENT_NUMBER
      })

      const context = {
        payload: {
          installation,
          pull_request: pr.data,
          repository: {
            name: env.ADMIN_REPO,
            owner: {
              login: installation.account.login
            }
          }
        },
        octokit: github,
        log: robot.log,
        repo: () => { return { repo: env.ADMIN_REPO, owner: installation.account.login } }
      }

      // Create check run like the webhook would
      const checkRun = await app.createCheckRun(context, pr.data, process.env.GITHUB_SHA, pr.data.head.ref)

      // Then follow the same flow as check_run.created
      return app.syncAllSettings(nop, context, context.repo(), pr.data.head.ref)
    }
    return null
  } catch (error) {
    process.stdout.write(`Unexpected error during PR validation: ${error}\n`)
    process.exit(1)
  }
}

validatePR(appFn, FULL_SYNC_NOP).catch((error) => {
  console.error('Fatal error during PR validation:', error)
  process.exit(1)
})
