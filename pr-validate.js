const appFn = require('./')
const { FULL_SYNC_NOP, ADMIN_REPO } = require('./lib/env')
const { createProbot } = require('probot')

async function validatePR (appFn, nop = true) {
  const probot = createProbot()
  probot.log.info(`Starting PR validation with NOP=${nop}`)

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
      repo: ADMIN_REPO,
      pull_number: process.env.GITHUB_EVENT_NUMBER
    })

    const context = {
      payload: {
        installation,
        pull_request: pr.data,
        repository: {
          name: ADMIN_REPO,
          owner: {
            login: installation.account.login
          }
        }
      },
      octokit: github,
      log: probot.log,
      repo: () => { return { repo: ADMIN_REPO, owner: installation.account.login } }
    }

    // Create check run like the webhook would
    await app.createCheckRun(context, pr.data, process.env.GITHUB_SHA, pr.data.head.ref)

    // Get the check run we just created
    const checkRuns = await github.checks.listForRef({
      owner: installation.account.login,
      repo: ADMIN_REPO,
      ref: process.env.GITHUB_SHA,
      per_page: 1
    })

    const checkRun = checkRuns.data.check_runs[0]
    probot.log.debug(`Check run response: ${JSON.stringify(checkRun)}`)
    probot.log.debug(`PR Data: ${JSON.stringify(pr.data)}`)

    // Update context with check run data
    context.payload.check_run = checkRun
    context.payload.check_suite = {
      id: checkRun.check_suite.id,
      pull_requests: [pr.data]
    }

    // Then follow the same flow as check_run.created
    return app.syncAllSettings(nop, context, context.repo(), pr.data.head.ref)
  }
  return null
}

validatePR(appFn, FULL_SYNC_NOP).catch((error) => {
  console.error('Fatal error during PR validation:', error)
  process.exit(1)
})
