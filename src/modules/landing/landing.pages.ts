/**
 * Plantillas HTML de las páginas públicas de la API (negro y dorado, la paleta
 * de Urban Blade). Autocontenidas (CSS inline + logo como data URI), sin
 * dependencias externas ni archivos estáticos.
 */
import { LOGO_DATA_URI } from './logo.asset';

const GOLD = '#C9A24B';
const GOLD_SOFT = '#E7D3A1';
const BG = '#0B0B0C';
const CARD = '#141416';

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1a1a1d 0%, ${BG} 60%);
    color: #EDEDED; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px;
  }
  .card {
    background: ${CARD}; border: 1px solid rgba(201,162,75,.25);
    border-radius: 18px; max-width: 560px; width: 100%; padding: 40px 36px;
    box-shadow: 0 20px 60px rgba(0,0,0,.5); text-align: center;
  }
  .logo {
    font-size: 13px; letter-spacing: 4px; text-transform: uppercase;
    color: ${GOLD}; font-weight: 700; margin-bottom: 8px;
  }
  .logo-img { width: 280px; max-width: 82%; height: auto; margin: 0 auto 4px; display: block; }
  h1 {
    font-size: 30px; font-weight: 800; margin-bottom: 6px;
    background: linear-gradient(90deg, ${GOLD} 0%, ${GOLD_SOFT} 50%, ${GOLD} 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub { color: #9A9A9A; font-size: 14px; margin-bottom: 26px; }
  .rule { height: 1px; background: linear-gradient(90deg, transparent, ${GOLD}, transparent); margin: 22px 0; }
  .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  a.btn {
    display: inline-block; text-decoration: none; padding: 11px 20px;
    border-radius: 10px; font-size: 14px; font-weight: 600; transition: .15s;
  }
  a.primary { background: ${GOLD}; color: #1a1400; }
  a.primary:hover { background: ${GOLD_SOFT}; }
  a.ghost { border: 1px solid rgba(201,162,75,.4); color: ${GOLD_SOFT}; }
  a.ghost:hover { border-color: ${GOLD}; background: rgba(201,162,75,.08); }
  .meta { margin-top: 22px; font-size: 12px; color: #6E6E6E; }
  .badge {
    display: inline-flex; align-items: center; gap: 8px; font-size: 15px;
    font-weight: 700; padding: 10px 18px; border-radius: 999px; margin: 8px 0 4px;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .up { background: rgba(46,204,113,.12); color: #6EE7A0; border: 1px solid rgba(46,204,113,.35); }
  .up .dot { background: #2ecc71; box-shadow: 0 0 10px #2ecc71; }
  .down { background: rgba(231,76,60,.12); color: #F1948A; border: 1px solid rgba(231,76,60,.35); }
  .down .dot { background: #e74c3c; box-shadow: 0 0 10px #e74c3c; }
  .row { display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; background: #0f0f11; border: 1px solid rgba(255,255,255,.05);
    border-radius: 10px; margin: 8px 0; font-size: 14px; }
  .row span:last-child { font-weight: 700; }
</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

/** Landing de bienvenida — GET /api */
export function landingPage(): string {
  return shell(
    'Urban Blade API',
    `
    <img class="logo-img" src="${LOGO_DATA_URI}" alt="Urban Blade" />
    <p class="sub">API · Backend de la barbería — NestJS + MongoDB</p>
    <div class="rule"></div>
    <div class="links">
      <a class="btn primary" href="/api/docs">Documentación (Swagger)</a>
      <a class="btn ghost" href="/api/status">Estado del servicio</a>
      <a class="btn ghost" href="/api/health">Health (JSON)</a>
    </div>
    <p class="meta">Servicio en línea · v1.0</p>
    `,
  );
}

/** Estado visual del servicio — GET /api/status */
export function statusPage(dbUp: boolean): string {
  const overallUp = dbUp;
  const badge = overallUp
    ? `<div class="badge up"><span class="dot"></span> Operativo</div>`
    : `<div class="badge down"><span class="dot"></span> Con problemas</div>`;
  const dbRow = `
    <div class="row">
      <span>Base de datos (MongoDB)</span>
      <span style="color:${dbUp ? '#6EE7A0' : '#F1948A'}">${dbUp ? 'Conectada' : 'Sin conexión'}</span>
    </div>`;
  const apiRow = `
    <div class="row">
      <span>API</span>
      <span style="color:#6EE7A0">En línea</span>
    </div>`;

  return shell(
    'Estado — Urban Blade API',
    `
    <img class="logo-img" src="${LOGO_DATA_URI}" alt="Urban Blade" style="width:220px" />
    <h1 style="font-size:22px">Estado del servicio</h1>
    ${badge}
    <div class="rule"></div>
    ${apiRow}
    ${dbRow}
    <div class="links" style="margin-top:22px">
      <a class="btn ghost" href="/api">Inicio</a>
      <a class="btn ghost" href="/api/health">Ver JSON</a>
    </div>
    <p class="meta">Actualizado: ${new Date().toISOString()}</p>
    `,
  );
}
