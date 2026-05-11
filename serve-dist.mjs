import { serve } from "bun";
import { join } from "path";

const PORT = 3000;
const DIST_DIR = "./dist";

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    
    // SPA fallback: serve index.html for non-file routes
    if (!path.includes('.')) {
      path = '/index.html';
    }
    
    const filePath = join(DIST_DIR, path);
    const file = Bun.file(filePath);
    
    if (await file.exists()) {
      return new Response(file);
    }
    
    // Fallback to index.html for any unknown path
    const indexFile = Bun.file(join(DIST_DIR, 'index.html'));
    return new Response(indexFile);
  },
});

console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
console.log(`📁 Sirviendo carpeta: ${DIST_DIR}`);
console.log(`Presiona Ctrl+C para detener`);
