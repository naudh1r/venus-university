import { Component, type ReactNode } from 'react'

/**
 * Around a game's own screen: a game that fails while drawing is taken down on its own, and the
 * scene goes on. Without it one game's fault would take the whole window with it, mid-scene.
 * Only what fails while drawing is caught; a fault in a timer or a click is the game's to bear,
 * and leaves the screen standing.
 */
export class GameGuard extends Component<
  { onFault: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    this.props.onFault(error)
  }

  render(): ReactNode {
    return this.state.failed ? (
      <p className="vu-empty">The game has broken off.</p>
    ) : (
      this.props.children
    )
  }
}
