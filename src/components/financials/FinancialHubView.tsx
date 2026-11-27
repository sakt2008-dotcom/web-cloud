import React, { useState } from 'react';
import { ArrowRight, DollarSign, CreditCard, BarChart3, TrendingUp } from 'lucide-react';
import { NetProfitSection } from './NetProfitSection';
import { PayoutRequestsSection } from './PayoutRequestsSection';
import { ComparativeAnalyticsSection } from './ComparativeAnalyticsSection';
import { Head, Seg, Act } from '../ui/kit';
import { localTodayStr } from '../../lib/format';

interface FinancialHubViewProps {
  onBack: () => void;
  initialTab?: 'profits' | 'payouts' | 'analytics';
  /** عرض المسوّق: عمولاته وطلبات صرفه فقط، بدون أرباح العقارات أو الرسوم أو التحليل */
  marketerView?: boolean;
}

export const FinancialHubView: React.FC<FinancialHubViewProps> = ({
  onBack,
  initialTab = 'profits',
  marketerView = false,
}) => {
  const getTodayStr = () => localTodayStr();
  const getFirstDayOfMonth = () => getTodayStr().slice(0, 8) + '01';

  const [activeTab, setActiveTab] = useState<'profits' | 'payouts' | 'analytics'>(marketerView ? 'payouts' : initialTab);
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('all');

  return (
    <div className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-3 space-y-3 font-['Tajawal',sans-serif]">
      {/* الرأس والتنقل بين الأقسام */}
      <section className="lux-card p-4 space-y-3.5">
        <Head
          title={marketerView ? 'عمولاتي' : 'المركز المالي'}
          icon={DollarSign}
          tone="jade"
          action={<Act small tone="line" icon={ArrowRight} label="رجوع" title="العودة للمزيد" onClick={onBack} />}
        />
        {!marketerView && (
        <Seg
          label="أقسام المركز المالي"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'profits', label: 'الأرباح', icon: TrendingUp },
            { id: 'payouts', label: 'الصرف', icon: CreditCard },
            { id: 'analytics', label: 'التحليل', icon: BarChart3 },
          ]}
        />
        )}
      </section>

      <div className="animate-in fade-in duration-150">
        {!marketerView && activeTab === 'profits' && (
          <NetProfitSection
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            selectedPropertyFilter={selectedPropertyFilter}
            setSelectedPropertyFilter={setSelectedPropertyFilter}
          />
        )}

        {activeTab === 'payouts' && <PayoutRequestsSection />}

        {!marketerView && activeTab === 'analytics' && (
          <ComparativeAnalyticsSection fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} />
        )}
      </div>
    </div>
  );
};
