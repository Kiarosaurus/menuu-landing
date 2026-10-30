import { handleRequest } from '../server/index.mjs';

export default function handler(req, res) {
  const incoming = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const rewrittenRoute = req.query?.route ?? incoming.searchParams.get('route');
  const route = Array.isArray(rewrittenRoute) ? rewrittenRoute.join('/') : rewrittenRoute;
  const path = route || incoming.pathname.replace(/^\/api\//, '');
  if (!path || path === 'handler' || path.includes('..') || path.startsWith('/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada.' }));
    return;
  }
  const apiUrl = new URL(`/api/${path}`, incoming.origin);
  for (const [key, value] of incoming.searchParams) if (key !== 'route') apiUrl.searchParams.append(key, value);
  return handleRequest(req, res, apiUrl);
}
