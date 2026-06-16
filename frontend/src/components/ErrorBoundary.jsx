import React from 'react'

// Catches render-time crashes so the user sees a recoverable panel, not a white page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('UI crash:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center text-foreground">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-xl font-semibold">Something broke</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
