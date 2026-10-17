import { create } from 'zustand'

/** Transient geometry of the table's input, while it owns the native dialogue box. */
interface InputLayout {
  open: boolean
  height: number
}

export const useTableInputLayout = create<{
  layout: InputLayout | null
  setLayout: (layout: InputLayout | null) => void
}>((set) => ({
  layout: null,
  setLayout: (layout) => set((state) =>
    state.layout?.open === layout?.open && state.layout?.height === layout?.height
      ? state
      : { layout })
}))
