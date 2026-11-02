import React from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isVi = document.documentElement.lang !== "en";

      return (
        <div className="error-boundary-screen" role="alert">
          <div className="error-boundary-content">
            <div className="error-boundary-icon" aria-hidden="true">🌐⚠️</div>
            <h1 className="error-boundary-title">
              {isVi ? "Đã xảy ra sự cố hiển thị" : "Something went wrong"}
            </h1>
            <p className="error-boundary-desc">
              {isVi
                ? "Ứng dụng gặp lỗi không mong muốn trong quá trình vẽ đồ họa 3D hoặc tải dữ liệu."
                : "The application encountered an unexpected error while rendering 3D graphics or loading data."}
            </p>
            {this.state.error?.message && (
              <pre className="error-boundary-details">
                {this.state.error.message}
              </pre>
            )}
            <div className="error-boundary-actions">
              <button
                type="button"
                className="error-boundary-btn is-primary"
                onClick={this.handleReload}
              >
                {isVi ? "Tải lại trang" : "Reload page"}
              </button>
              <button
                type="button"
                className="error-boundary-btn"
                onClick={this.handleReset}
              >
                {isVi ? "Thử phục hồi" : "Try to recover"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
