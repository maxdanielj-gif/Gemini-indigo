import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear potentially corrupted data
    localStorage.clear();
    // We can't easily clear IndexedDB from here without the service, 
    // but clearing localStorage might help if that's where the issue is.
    // The AppContext resetApp function is better but we might not be able to reach it.
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-indigo-50 dark:bg-indigo-950 p-4">
          <div className="max-w-md w-full bg-indigo-100 dark:bg-indigo-900 rounded-2xl shadow-xl p-8 text-center border border-indigo-200 dark:border-indigo-800">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-4">Something went wrong</h1>
            <p className="text-indigo-600 dark:text-indigo-400 mb-8 leading-relaxed">
              The application encountered an unexpected error. This might be due to corrupted local data.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-all shadow-lg"
              >
                Try Refreshing
              </button>
              <button
                onClick={this.handleReset}
                className="w-full bg-indigo-100 dark:bg-indigo-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-3 px-6 rounded-xl font-semibold hover:bg-red-900/10 transition-all"
              >
                Reset Application Data
              </button>
            </div>
            {this.state.error && (
              <details open className="mt-8 text-left">
                <summary className="text-xs font-semibold text-red-600 cursor-pointer">Error Details (Please copy this to the agent):</summary>
                <pre className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg text-xs overflow-auto max-h-60 text-red-600 dark:text-red-400 font-mono break-all whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.error.stack && this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
