import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] React component error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0f0f1a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#fff',
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>⚠️ Application Error</h1>
          <p style={{ marginBottom: '20px', textAlign: 'center', maxWidth: '500px' }}>
            Something went wrong. Please refresh the page or contact support.
          </p>
          {this.state.error && (
            <details style={{
              backgroundColor: '#1e1e30',
              padding: '15px',
              borderRadius: '8px',
              maxWidth: '100%',
              overflowX: 'auto',
              marginBottom: '20px',
              width: '100%',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details
              </summary>
              <pre style={{
                fontSize: '12px',
                margin: '10px 0 0 0',
                overflow: 'auto',
              }}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
