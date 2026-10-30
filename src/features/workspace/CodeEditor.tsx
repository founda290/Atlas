import { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { usePreferences } from '../../hooks/preferences'
function language(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext ?? ''))
    return javascript({
      typescript: ext === 'ts' || ext === 'tsx',
      jsx: ext === 'tsx' || ext === 'jsx',
    })
  if (ext === 'json') return json()
  if (ext === 'css' || ext === 'scss') return css()
  if (ext === 'html' || ext === 'svg' || ext === 'xml') return html()
  if (ext === 'md' || ext === 'mdx') return markdown()
  if (ext === 'py') return python()
  return []
}
function appearance(dark: boolean, readOnly: boolean, wrap: boolean) {
  const color = dark ? '#dce4db' : '#1c281e',
    background = dark ? '#101211' : '#fff',
    panel = dark ? '#171c18' : '#eaede7'
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    ...(wrap ? [EditorView.lineWrapping] : []),
    syntaxHighlighting(
      HighlightStyle.define([
        {
          tag: [tags.keyword, tags.modifier, tags.operatorKeyword],
          color: dark ? '#d5c7a1' : '#6f542d',
        },
        { tag: [tags.string, tags.special(tags.string)], color: dark ? '#c1d897' : '#3b631f' },
        {
          tag: [tags.number, tags.bool, tags.null, tags.typeName, tags.className],
          color: dark ? '#abc8d8' : '#365d76',
        },
        { tag: [tags.variableName, tags.propertyName, tags.name], color },
        { tag: [tags.comment, tags.meta], color: dark ? '#9ca49b' : '#576555' },
        { tag: tags.invalid, color: dark ? '#e5a6a0' : '#963e35' },
      ]),
    ),
    EditorView.theme(
      {
        '&': { backgroundColor: background, color, fontSize: '12px' },
        '.cm-content': { fontFamily: 'monospace', minHeight: '320px' },
        '.cm-gutters': {
          backgroundColor: panel,
          color: dark ? '#a4b1a5' : '#606e62',
          border: 'none',
        },
        '&.cm-focused': { outline: '1px solid #65983d' },
        '.cm-scroller': { overflow: 'auto', maxHeight: '650px' },
        '.cm-cursor': { borderLeftColor: dark ? '#b8e46b' : '#345e1c' },
        '.cm-selectionBackground': {
          backgroundColor: dark ? '#33432f !important' : '#dcead2 !important',
        },
        '.cm-activeLine': { backgroundColor: dark ? '#ffffff08' : '#00000004' },
        '.cm-panels': { backgroundColor: panel, color },
        '.cm-panels input,.cm-panels button': {
          color,
          backgroundColor: background,
          border: '1px solid #697360',
        },
      },
      { dark },
    ),
  ]
}
export default function CodeEditor({
  path,
  value,
  onChange,
  onSave,
  readOnly,
}: {
  path: string
  value: string
  onChange: (value: string) => void
  onSave: () => void
  readOnly: boolean
}) {
  const root = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    config = useRef(new Compartment()),
    change = useRef(onChange),
    save = useRef(onSave),
    canSave = useRef(!readOnly),
    initial = useRef(value)
  change.current = onChange
  save.current = onSave
  canSave.current = !readOnly
  const { preferences } = usePreferences()
  useEffect(() => {
    if (!root.current) return
    const instance = new EditorView({
      parent: root.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          basicSetup,
          language(path),
          config.current.of(
            appearance(preferences.theme === 'dark', readOnly, preferences.wrapCode),
          ),
          EditorView.contentAttributes.of({ 'aria-label': `Code editor: ${path}` }),
          keymap.of([
            {
              key: 'Mod-s',
              run: () => {
                if (canSave.current) save.current()
                return true
              },
            },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) change.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = instance
    return () => {
      initial.current = instance.state.doc.toString()
      instance.destroy()
      view.current = null
    }
  }, [path])
  // Reconfigure instead of recreating the editor: preserve cursor, undo history and find state on save/theme changes.
  useEffect(() => {
    view.current?.dispatch({
      effects: config.current.reconfigure(
        appearance(preferences.theme === 'dark', readOnly, preferences.wrapCode),
      ),
    })
  }, [readOnly, preferences.theme, preferences.wrapCode])
  useEffect(() => {
    const current = view.current
    if (current && current.state.doc.toString() !== value)
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } })
    initial.current = value
  }, [value])
  return <div className="atlas-code-editor" ref={root} />
}
