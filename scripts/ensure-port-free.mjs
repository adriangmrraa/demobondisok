/**
 * Garantiza que el puerto indicado (default 3000) esté libre antes de correr
 * la suite E2E. En Windows, terminar la shell NO mata a `next dev`/`next start`:
 * quedan procesos zombie escuchando, y Playwright los reutiliza en silencio
 * (`reuseExistingServer`) sirviendo un dev-server con recursos cross-origin
 * bloqueados → falsos negativos por hidratación rota.
 *
 * Uso: node ./scripts/ensure-port-free.mjs [port]
 */
import { execSync } from 'node:child_process';

const port = process.argv[2] ?? '3000';

function listenersWindows(p) {
  let out = '';
  try {
    out = execSync(`netstat -ano | findstr :${p} | findstr LISTENING`, { encoding: 'utf8' });
  } catch {
    return [];
  }
  return [...new Set(out.trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
}

function listenersPosix(p) {
  try {
    const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

const pids = process.platform === 'win32' ? listenersWindows(port) : listenersPosix(port);

if (pids.length === 0) {
  console.log(`[ensure-port-free] :${port} libre`);
  process.exit(0);
}

for (const pid of pids) {
  console.log(`[ensure-port-free] matando proceso zombie PID ${pid} en :${port}`);
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill //PID ${pid} //F //T`, { stdio: 'inherit' });
    } else {
      process.kill(Number(pid), 'SIGKILL');
    }
  } catch (err) {
    console.error(`[ensure-port-free] no se pudo matar PID ${pid}: ${err.message}`);
    process.exit(1);
  }
}
console.log(`[ensure-port-free] :${port} liberado (${pids.length} proceso/s)`);
