// Cloudflare Worker example for tokenless sync from manager panel.
// Deploy this worker and set secrets:
// 1) wrangler secret put GITHUB_TOKEN
// 2) wrangler secret put BRIDGE_SECRET
// Then set manager panel Sync Bridge URL to your deployed endpoint.

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const auth = request.headers.get('x-bridge-secret') || '';
    if (!env.BRIDGE_SECRET || auth !== env.BRIDGE_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const owner = String(payload.owner || '').trim();
    const repo = String(payload.repo || '').trim();
    const branch = String(payload.branch || 'main').trim() || 'main';
    const path = String(payload.path || 'license-registry.json').trim() || 'license-registry.json';
    const registryJson = String(payload.registryJson || '').trim();

    if (!owner || !repo || !path || !registryJson) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (!env.GITHUB_TOKEN) {
      return new Response('Server token not configured', { status: 500 });
    }

    const apiPath = path
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');

    const baseUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}`;
    const ghHeaders = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };

    let sha = null;
    const getRes = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: ghHeaders
    });

    if (getRes.ok) {
      const current = await getRes.json();
      sha = current?.sha || null;
    } else if (getRes.status !== 404) {
      const txt = await getRes.text();
      return new Response(`GitHub GET failed: ${txt}`, { status: 502 });
    }

    const content = btoa(unescape(encodeURIComponent(registryJson)));
    const body = {
      message: `sync online license registry (${new Date().toISOString()})`,
      content,
      branch
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(baseUrl, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const txt = await putRes.text();
      return new Response(`GitHub PUT failed: ${txt}`, { status: 502 });
    }

    return Response.json({ ok: true, mode: 'bridge', updatedAt: new Date().toISOString() });
  }
};
