import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../observability/clientErrorReporter';
import { repairCachedAppFiles } from './repairCachedAppFiles';

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

type GlobalErrorBoundaryState = {
  failed: boolean;
  repairing: boolean;
};

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    failed: false,
    repairing: false,
  };

  static getDerivedStateFromError(): Partial<GlobalErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    void reportClientError({
      kind: 'render',
      error,
      componentStack: info.componentStack ?? null,
    });
    console.error('BioTrack AI recovered from an unexpected render error.', error, info);
  }

  private reload = (): void => {
    window.location.reload();
  };

  private repairAndReload = async (): Promise<void> => {
    this.setState({ repairing: true });
    try {
      await repairCachedAppFiles();
    } catch (error: unknown) {
      console.warn('BioTrack AI could not clear every cached app file.', error);
    } finally {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="global-error-shell" role="alert" aria-labelledby="global-error-heading">
        <section className="global-error-card">
          <div className="global-error-mark" aria-hidden="true">B</div>
          <p className="eyebrow">Safe recovery</p>
          <h1 id="global-error-heading">BioTrack hit an unexpected problem</h1>
          <p>
            Your account, active workout copy and pending offline sets remain stored separately from
            the app files. Reload BioTrack first. Use repair only if the same screen returns.
          </p>
          <div className="global-error-actions">
            <button className="primary-button" type="button" onClick={this.reload}>
              Reload BioTrack
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={this.state.repairing}
              onClick={() => void this.repairAndReload()}
            >
              {this.state.repairing ? 'Repairing app files…' : 'Repair app files'}
            </button>
          </div>
          <small>
            Repair removes only BioTrack caches and the current service worker. It does not erase
            local workout recovery data.
          </small>
        </section>
      </main>
    );
  }
}
