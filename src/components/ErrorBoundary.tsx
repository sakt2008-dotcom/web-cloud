import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AMASA UI ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-[100dvh] bg-[#140322] flex items-center justify-center p-4 font-['Tajawal',sans-serif]"
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-purple-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-black text-slate-900">
                حدث خطأ غير متوقع في عرض التطبيق
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                بياناتك محفوظة بأمان. اضغط على الزر أدناه لإعادة تحميل التطبيق ومتابعة العمل بسلاسة.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
