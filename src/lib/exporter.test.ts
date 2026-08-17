import assert from 'node:assert/strict'
import test from 'node:test'
import { copyToClipboard } from './exporter'

test('reports failure when the clipboard fallback command returns false', async (t) => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const children: unknown[] = []
  let selected = false
  const textarea = {
    value: '',
    style: { position: '', opacity: '' },
    select: () => {
      selected = true
    },
  }

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error('Clipboard permission denied')
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tagName: string) => {
        assert.equal(tagName, 'textarea')
        return textarea
      },
      body: {
        appendChild: (child: unknown) => children.push(child),
        removeChild: (child: unknown) => {
          const index = children.indexOf(child)
          if (index !== -1) children.splice(index, 1)
        },
      },
      execCommand: (command: string) => {
        assert.equal(command, 'copy')
        return false
      },
    },
  })
  t.after(() => {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
    else delete (globalThis as { navigator?: unknown }).navigator
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor)
    else delete (globalThis as { document?: unknown }).document
  })

  assert.equal(await copyToClipboard('content'), false)
  assert.equal(selected, true)
  assert.deepEqual(children, [])
})
