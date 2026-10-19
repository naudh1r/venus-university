import { create } from 'zustand'

/** Non-null while a running table owns scene input, including solo tables without chat. */
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
