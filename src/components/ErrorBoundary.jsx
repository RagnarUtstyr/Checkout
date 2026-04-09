import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fullscreen-center login-screen">
          <div className="card auth-card">
            <p className="eyebrow">Something went wrong</p>
            <h1>The page hit an error</h1>
            <p className="muted">
              Refresh the page. If it keeps happening, the details below can help identify the problem.
            </p>
            <div className="error-box">{this.state.error?.message || 'Unknown error'}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
