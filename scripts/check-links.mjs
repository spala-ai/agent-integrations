const urls = [
  'https://spala.ai',
  'https://mcp.spala.ai/mcp',
  'https://docs.spala.ai',
];

if (process.env.CHECK_REPOSITORY_URL === '1') {
  urls.push('https://github.com/spala-ai/agent-integrations');
}

let failed = false;
for (const url of urls) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'spala-agent-integrations-link-check' },
    });
    const ok = response.status >= 200 && response.status < 400;
    process.stdout.write(`${ok ? 'ok' : 'fail'} ${response.status} ${url}\n`);
    failed ||= !ok;
  } catch (error) {
    process.stderr.write(`fail ${url}: ${error.message}\n`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
