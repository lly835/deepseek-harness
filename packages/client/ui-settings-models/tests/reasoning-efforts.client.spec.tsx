// @vitest-environment jsdom
/** Per-model reasoning-effort editing in the pi-ai model-list form. */
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelListEditor } from '../src/client/ModelListEditor.tsx'
import type { ModelDraft } from '../src/client/ModelListEditor.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]
const api = { llm: { discoverModels: vi.fn() } } as never

function Fixture({ initial, onChange }: {
  initial: readonly ModelDraft[]
  onChange: (models: ModelDraft[]) => void
}) {
  const [models, setModels] = useState<readonly ModelDraft[]>(initial)
  return (
    <ModelListEditor
      models={models}
      onChange={(next) => {
        onChange(next)
        setModels(next)
      }}
      probe={{ settingsNs: 'llm-pi-ai', provider: 'custom' }}
      api={api}
      t={t}
      disabled={false}
    />
  )
}

function expandFirst(): void {
  fireEvent.click(screen.getByLabelText(`${en.modelAdvanced} 1`))
}

function level(name: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(`${en.modelReasoningLevel} ${name} 1`)
}

function wire(name: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(`${en.modelReasoningWire} ${name} 1`)
}

describe('custom model reasoning efforts', () => {
  it('declares selectable levels and preserves unrelated model fields', () => {
    const changed = vi.fn()
    render(<Fixture initial={[{ id: 'glm-5.2', hidden: 'keep' }]} onChange={changed} />)
    expandFirst()

    expect(level('off').disabled).toBe(true)
    fireEvent.click(level('high'))
    expect(changed.mock.lastCall?.[0]).toEqual([{
      id: 'glm-5.2',
      hidden: 'keep',
      reasoningEfforts: { high: 'high' },
    }])

    expect(level('off').disabled).toBe(false)
    fireEvent.click(level('off'))
    expect(changed.mock.lastCall?.[0]).toEqual([{
      id: 'glm-5.2',
      hidden: 'keep',
      reasoningEfforts: { high: 'high', off: null },
    }])

    fireEvent.change(wire('high'), { target: { value: 'provider-high' } })
    fireEvent.blur(wire('high'))
    expect(changed.mock.lastCall?.[0]).toEqual([{
      id: 'glm-5.2',
      hidden: 'keep',
      reasoningEfforts: { high: 'provider-high', off: null },
    }])
  })

  it('returns to inheritance when the last thinking level is removed', () => {
    const changed = vi.fn()
    render(<Fixture
      initial={[{ id: 'custom-model', reasoningEfforts: { off: null, medium: 'medium' } }]}
      onChange={changed}
    />)
    expandFirst()

    fireEvent.click(level('medium'))
    expect(changed.mock.lastCall?.[0]).toEqual([{ id: 'custom-model' }])
    expect(level('off').checked).toBe(false)
    expect(level('off').disabled).toBe(true)
  })

  it('never stores an empty wire value for a non-off effort', () => {
    const changed = vi.fn()
    render(<Fixture
      initial={[{ id: 'custom-model', reasoningEfforts: { high: 'high' } }]}
      onChange={changed}
    />)
    expandFirst()

    fireEvent.change(wire('high'), { target: { value: '   ' } })
    expect(wire('high').value).toBe('   ')
    fireEvent.blur(wire('high'))
    expect(wire('high').value).toBe('high')
    expect(changed).not.toHaveBeenCalled()
  })

  it('lets off use a custom wire spelling or an omitted effort value', () => {
    const changed = vi.fn()
    render(<Fixture
      initial={[{ id: 'custom-model', reasoningEfforts: { off: 'none', high: 'high' } }]}
      onChange={changed}
    />)
    expandFirst()

    expect(wire('off').value).toBe('none')
    fireEvent.change(wire('off'), { target: { value: '' } })
    fireEvent.blur(wire('off'))
    expect(changed.mock.lastCall?.[0]).toEqual([{
      id: 'custom-model',
      reasoningEfforts: { off: null, high: 'high' },
    }])
  })
})
