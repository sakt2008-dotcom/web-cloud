import React, { useState } from 'react';
import { Eye, ArrowRightLeft, BellRing, Stethoscope, ShieldCheck, CheckCircle2, AlertTriangle, X, ClipboardList } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Sheet, Head, Acts, Act, Infos, Info, Tile } from '../ui/kit';
import { fmtN } from '../../lib/format';

export const SimulationTopBanner: React.FC = () => {
  const {
    simulation,
    exitSimulation,
    setIsAccountSwitcherOpen,
    testAlertOnCurrentAccount,
    diagnoseCurrentAccount,
    isSoundEnabled,
    toggleSound,
    activeTab,
    setActiveTab,
    guardTasks,
  } = useApp();

  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<{
    hasErrors: boolean;
    issues: string[];
    details: string[];
  } | null>(null);

  if (!simulation?.isSimulating) {
    return null;
  }

  const handleRunDiagnosis = () => {
    const res = diagnoseCurrentAccount();
    setDiagnosisResult(res);
    setDiagnosisModalOpen(true);
  };

  const roleLabel =
    simulation.role === 'guard'
      ? 'حارس عقار'
      : simulation.role === 'coordinator'
      ? 'منسقة حفلات'
      : 'مسوق معتمد';

  const pendingGuardTasks = guardTasks
    ? guardTasks.filter((t) => (t.guardId === simulation.targetId || !t.guardId) && (t.status === 'pending' || t.status === 'in_progress')).length
    : 0;
  const showGuardTasks = simulation.role === 'guard' && activeTab !== 'guard-tasks';
  const subLine = [simulation.targetName, roleLabel, simulation.targetProperty].filter(Boolean).join(' · ');

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-[#C9A45C]/50 text-white animate-in slide-in-from-top duration-300" style={{ background: '#1B0E33' }} dir="rtl">
        <div className="max-w-7xl mx-auto px-3 py-2 space-y-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Tile icon={Eye} tone="ch" size={40} dark />
            <span className="kt-row-t" style={{ color: '#fff' }}>
              <span className="kt-row-n" style={{ color: '#fff' }}>
                وضع فحص الإدارة
              </span>
              <span className="kt-row-s" style={{ color: '#BFB2DC' }}>
                {subLine}
              </span>
            </span>
            <Act small tone="jade" icon={ShieldCheck} label="عودة" title="العودة للإدارة" onClick={exitSimulation} className="!w-auto shrink-0 px-4" />
          </div>
          <Acts cols={showGuardTasks ? 4 : 3}>
            <Act stack small tone="dark" icon={BellRing} label="تنبيه" title="تجربة تنبيه فوري" onClick={() => testAlertOnCurrentAccount()} />
            <Act stack small tone="dark" icon={Stethoscope} label="فحص" title="فحص الأخطاء" onClick={handleRunDiagnosis} />
            <Act stack small tone="dark" icon={ArrowRightLeft} label="تبديل" title="تبديل الحساب" onClick={() => setIsAccountSwitcherOpen(true)} />
            {showGuardTasks && (
              <Act
                stack
                small
                tone="gold"
                icon={ClipboardList}
                label={pendingGuardTasks > 0 ? `مهمات ${fmtN(pendingGuardTasks)}` : 'مهمات'}
                title="مهمات الحارس"
                onClick={() => setActiveTab('guard-tasks')}
              />
            )}
          </Acts>
        </div>
      </div>

      {/* تقرير الفحص */}
      {diagnosisModalOpen && diagnosisResult && (
        <Sheet
          title="تقرير فحص الحساب"
          icon={Stethoscope}
          tone={diagnosisResult.hasErrors ? 'garn' : 'jade'}
          onClose={() => setDiagnosisModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act
                tone="ink"
                icon={BellRing}
                label="تنبيه تجريبي"
                title="إرسال تنبيه تجريبي الآن"
                onClick={() => {
                  testAlertOnCurrentAccount();
                  setDiagnosisModalOpen(false);
                }}
              />
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setDiagnosisModalOpen(false)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info label="الحساب" value={simulation.targetName || '—'} />
            <Info label="الصلاحية" value={roleLabel} />
          </Infos>

          {diagnosisResult.hasErrors ? (
            <div className="kt-err" role="alert">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>رُصدت ملاحظات في إعدادات الحساب — راجعها من لوحة الإدارة.</span>
            </div>
          ) : (
            <div className="kt-ok" role="status">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
                <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">الحساب سليم ولا توجد أخطاء.</span>
              </div>
            </div>
          )}

          {diagnosisResult.issues.length > 0 && (
            <>
              <Head title="الملاحظات" icon={AlertTriangle} tone="garn" count={diagnosisResult.issues.length} />
              {diagnosisResult.issues.map((issue, idx) => (
                <div key={idx} className="kt-bk">
                  <div className="kt-bk-h">
                    <Tile icon={AlertTriangle} tone="garn" size={32} />
                    <span className="kt-row-t">
                      <span className="kt-row-n">{issue}</span>
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}

          <Head title="تفاصيل الجاهزية" icon={CheckCircle2} tone="jade" count={diagnosisResult.details.length} />
          {diagnosisResult.details.map((detail, idx) => (
            <div key={idx} className="kt-bk">
              <div className="kt-bk-h">
                <Tile icon={CheckCircle2} tone="jade" size={32} />
                <span className="kt-row-t">
                  <span className="kt-row-n">{detail}</span>
                </span>
              </div>
            </div>
          ))}
        </Sheet>
      )}
    </>
  );
};
