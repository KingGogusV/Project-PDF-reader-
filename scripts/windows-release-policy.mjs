const repository = 'KingGogusV/Project-PDF-reader-';

// Check the event payload, not an ambient publication flag. Calling the CLI
// directly must obey the same opt-in/source rules as the workflow job.
export function assertPublicationRequest(env, event) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true' ||
      env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('Publication requires an explicit workflow_dispatch on this repository\'s main branch.');
  }
  const inputs = event?.inputs;
  // GitHub's event context represents boolean inputs as strings; the typed
  // inputs context also supports actual booleans. Accept only explicit true.
  if (inputs?.publish !== true && inputs?.publish !== 'true') {
    throw new Error('Publication was not explicitly selected. Verification runs cannot publish.');
  }
  if (!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || '') ||
      inputs.expected_source_sha !== env.GITHUB_SHA) {
    throw new Error('Publication requires the full expected source SHA to match the workflow revision.');
  }
}
