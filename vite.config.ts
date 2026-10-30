import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'atlas-local-execution-boundary',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/api/cloud') {
            void import('./server/src/cloud/control.ts')
              .then(({ cloudControl }) => cloudControl(req, res))
              .catch(() => {
                res.statusCode = 503
                res.end(
                  JSON.stringify({
                    data: { error: { message: 'Cloud control plane unavailable.' } },
                  }),
                )
              })
            return
          }
          if (req.url?.startsWith('/api/')) {
            const host = (req.headers.host ?? '').split(':')[0],
              peer = req.socket.remoteAddress
            if (
              !['127.0.0.1', 'localhost'].includes(host) ||
              !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer ?? '') ||
              req.headers.forwarded ||
              req.headers['x-forwarded-for'] ||
              req.headers['x-forwarded-host']
            ) {
              res.writeHead(403, { 'content-type': 'application/json' })
              res.end(
                JSON.stringify({
                  data: {
                    error: {
                      code: 'local_only',
                      message:
                        'Execution API access is local-only. Run Atlas on your own machine; public previews do not expose the local backend.',
                    },
                  },
                }),
              )
              return
            }
          }
          next()
        })
      },
    },
  ],
  optimizeDeps: {
    include: [
      'codemirror',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/lang-javascript',
      '@codemirror/lang-json',
      '@codemirror/lang-css',
      '@codemirror/lang-html',
      '@codemirror/lang-markdown',
      '@codemirror/lang-python',
      '@lezer/highlight',
    ],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
})
