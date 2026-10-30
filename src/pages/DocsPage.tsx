import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { articles } from '../features/articles'
import { Button, CodeBlock, SearchInput } from '../components/ui'
export function DocsPage() {
  const { articleId = 'introduction' } = useParams()
  const [search, setSearch] = useState('')
  const index = articles.findIndex((item) => item.id === articleId)
  const article = articles[index]
  const filtered = articles.filter((item) =>
    `${item.title} ${item.description} ${item.sections.map((section) => `${section.heading} ${section.paragraphs.join(' ')}`).join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const links = (
    <>
      <SearchInput
        label="Search documentation"
        value={search}
        onChange={setSearch}
        placeholder="Search the docs…"
      />
      <p className="result-count" role="status">
        {search ? `${filtered.length} articles found` : 'Guides & reference'}
      </p>
      <nav aria-label="Documentation articles">
        {filtered.map((item, i) => (
          <NavLink
            key={item.id}
            to={`/docs/${item.id}`}
            className={articleId === item.id ? 'active' : ''}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            {item.title}
          </NavLink>
        ))}
      </nav>
      {!filtered.length && <p className="muted">No articles match. Try “runtime” or “sessions”.</p>}
    </>
  )
  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <p className="eyebrow">Atlas / Documentation</p>
        {links}
      </aside>
      <details className="docs-mobile-nav">
        <summary>Browse & search documentation</summary>
        {links}
      </details>
      {!article ? (
        <article className="docs-article">
          <h1>Article not found</h1>
          <p>This documentation page does not exist.</p>
          <Button href="/docs">Documentation home</Button>
        </article>
      ) : (
        <>
          <article className="docs-article">
            <nav aria-label="Breadcrumb" className="breadcrumb">
              <Link to="/docs">Docs</Link>
              <span aria-hidden="true">/</span>
              <span>{article.title}</span>
            </nav>
            <p className="eyebrow">Atlas help center</p>
            <h1>{article.title}</h1>
            <p className="article-lede">{article.description}</p>
            <div className="article-notice">
              Hosted AI execution and billing are not available yet. Neon account flows are
              implemented, but live provider acceptance is still pending.
            </div>
            {article.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {section.code && <CodeBlock code={section.code} language={section.language} />}
              </section>
            ))}
            <nav className="article-pagination" aria-label="Article pagination">
              {index > 0 && (
                <Link to={`/docs/${articles[index - 1].id}`}>
                  <small>← Previous</small>
                  {articles[index - 1].title}
                </Link>
              )}
              {index < articles.length - 1 && (
                <Link to={`/docs/${articles[index + 1].id}`}>
                  <small>Next →</small>
                  {articles[index + 1].title}
                </Link>
              )}
            </nav>
          </article>
          <aside className="docs-toc">
            <p>On this page</p>
            <nav aria-label="Table of contents">
              {article.sections.map((section) => (
                <a href={`#${section.id}`} key={section.id}>
                  {section.heading}
                </a>
              ))}
            </nav>
            <Link to="/docs/troubleshooting" className="text-link">
              Need a hand? →
            </Link>
          </aside>
        </>
      )}
    </div>
  )
}
