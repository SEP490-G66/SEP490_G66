import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

// After the build, writes <route>/index.html for the privacy policy and terms of use pages with the full text
// already inside #root. Crawlers and reviewers that do not run JavaScript then see the real document; in a browser
// React renders the same page over it. The text comes from src/utils/legalContent.jsx, so there is one source.

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const renderBlock = (block) => {
  if (typeof block === 'string') return `<p>${escapeHtml(block)}</p>`
  const intro = block.intro ? `<p>${escapeHtml(block.intro)}</p>` : ''
  return `${intro}<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

const renderDocument = (doc, updatedAt, related) => `
<article style="max-width:768px;margin:0 auto;padding:24px 16px 48px;line-height:1.6">
  <h1>${escapeHtml(doc.title)}</h1>
  <p>Cập nhật lần cuối: ${escapeHtml(updatedAt)}</p>
  ${doc.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
  ${doc.sections
    .map((section, index) => `<section><h2>${index + 1}. ${escapeHtml(section.title)}</h2>${section.blocks.map(renderBlock).join('')}</section>`)
    .join('')}
  <p>Xem thêm: <a href="${related.href}">${escapeHtml(related.title)}</a></p>
</article>`

export default function staticLegalPages() {
  let root
  let outDir

  return {
    name: 'static-legal-pages',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false },
        resolve: { alias: { '@': path.join(root, 'src') } },
      })
      try {
        const { LEGAL_UPDATED_AT, PRIVACY_POLICY, TERMS_OF_USE } = await server.ssrLoadModule('/src/utils/legalContent.jsx')
        const { ROUTES } = await server.ssrLoadModule('/src/utils/routes.jsx')
        const shell = await readFile(path.join(outDir, 'index.html'), 'utf8')

        const pages = [
          { route: ROUTES.PRIVACY_POLICY, doc: PRIVACY_POLICY, related: { title: TERMS_OF_USE.title, href: ROUTES.TERMS_OF_USE } },
          { route: ROUTES.TERMS_OF_USE, doc: TERMS_OF_USE, related: { title: PRIVACY_POLICY.title, href: ROUTES.PRIVACY_POLICY } },
        ]
        for (const { route, doc, related } of pages) {
          const html = shell
            .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(doc.title)} - Nha khoa OZE</title>`)
            .replace('<div id="root"></div>', `<div id="root">${renderDocument(doc, LEGAL_UPDATED_AT, related)}</div>`)
          if (!html.includes(escapeHtml(doc.sections[0].title))) throw new Error(`static-legal-pages: could not inject ${route}`)
          const dir = path.join(outDir, route.replace(/^\//, ''))
          await mkdir(dir, { recursive: true })
          await writeFile(path.join(dir, 'index.html'), html)
        }
      } finally {
        await server.close()
      }
    },
  }
}
