import { useLayoutEffect, useRef } from 'react'
import { create } from 'zustand'

/** The input a panel puts in place of the scene's own action row. */
export interface SceneInputLayout {
  /** Its field is out, as the scene's well is on the reader's turn; false while it is put away. */
  open: boolean
  /** How tall it stands, in pixels: the dialogue box stands clear of it, as of the scene's row. */
  height: number
}

const useSceneInputStore = create<{ holder: object | null; layout: SceneInputLayout | null }>(() => ({
  holder: null,
  layout: null
}))

/** The layout of the panel holding the scene's input; null while the scene's own row has it. */
export function useSceneInputLayout(): SceneInputLayout | null {
  return useSceneInputStore((state) => state.layout)
}

/**
 * Takes the scene's input for the component that calls it, for as long as `layout` is not null:
 * the scene's action row is put away and dead, and the dialogue box stands clear of the caller's
 * own input instead. Null, or unmounting, gives the input back. One holder at a time: a claim
 * while another component holds it is refused, with a warning.
 */
export function useSceneInput(layout: SceneInputLayout | null): void {
  const holder = useRef({}).current
  const held = layout !== null
  const open = layout?.open ?? false
  const height = layout?.height ?? 0

  // Claimed and given back on the layout's coming and going alone, so a change of height is never
  // a moment with the scene's row back up.
  useLayoutEffect(() => {
    if (!held) return
    const standing = useSceneInputStore.getState().holder
    if (standing !== null && standing !== holder) {
      console.warn('[scene] the scene input is already held by another panel; this claim is refused')
      return
    }
    useSceneInputStore.setState({ holder, layout: { open, height } })
    return () => {
      if (useSceneInputStore.getState().holder === holder) {
        useSceneInputStore.setState({ holder: null, layout: null })
      }
    }
    // The claim starts from the layout of the render that made it; the effect below follows it.
  }, [held, holder])

  useLayoutEffect(() => {
    const state = useSceneInputStore.getState()
    if (state.holder !== holder) return
    if (state.layout?.open === open && state.layout.height === height) return
    useSceneInputStore.setState({ layout: { open, height } })
  }, [holder, open, height])
}
