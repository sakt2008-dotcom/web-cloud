import React, { useState, useMemo } from 'react';
import { Users, ShieldCheck, Eye, BellRing, X, Sparkles, ArrowRightLeft, Key } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { Sheet, Seg, SearchBox, Head, Row, Face, Tag, Acts, Act, Infos, Info } from '../ui/kit';
import { fmtN } from '../../lib/format';

interface AdminAccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAccountSwitcherModal: React.FC<AdminAccountSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    marketers,
    guardsList,
    coordinators,
    simulation,
    startSimulation,
    exitSimulation,
    testAlertOnCurrentAccount,
    userRole,
    currentMarketerId,
    guard,
    bookings,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'guards' | 'marketers' | 'coordinators'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [testedAccountId, setTestedAccountId] = useState<string | null>(null);

  // Compute bookings and commission counts for marketers
  const marketerStats = useMemo(() => {
    const stats: Record<string, { bookingsCount: number; totalEarnings: number }> = {};
    marketers.forEach((m) => {
      const mBookings = bookings.filter((b) => b.marketerId === m.id);
      const earnings = mBookings
        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + (b.marketerCommission || 0), 0);
      stats[m.id] = {
        bookingsCount: mBookings.length,
        totalEarnings: earnings,
      };
    });
    return stats;
  }, [marketers, bookings]);

  // Handle direct switch
  const handleSwitch = (role: UserRole, targetId?: string, targetName?: string, targetProperty?: string) => {
    startSimulation(role, targetId, targetName, targetProperty);
    onClose();
  };

  // Handle immediate test alert
  const handleTestAlert = (role: UserRole, targetId?: string, targetName?: string) => {
    testAlertOnCurrentAccount(role, targetId, targetName);
    setTestedAccountId(targetId || role);
    setTimeout(() => {
      setTestedAccountId(null);
    }, 2500);
  };

  const filteredGuards = guardsList.filter(
    (g) =>
      g.name.includes(searchQuery) ||
      (g.assignedPropertyName && g.assignedPropertyName.includes(searchQuery)) ||
      (g.phone && g.phone.includes(searchQuery))
  );

  const filteredMarketers = marketers.filter(
    (m) =>
      m.name.includes(searchQuery) ||
      (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.phone && m.phone.includes(searchQuery))
  );

  const filteredCoordinators = coordinators.filter(
    (c) =>
      c.name.includes(searchQuery) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.specialty && c.specialty.includes(searchQuery))
  );

  if (!isOpen) return null;

  const showAdmin = activeFilter === 'all' || searchQuery.includes('إدارة') || searchQuery.includes('مدير');
  const exitAndClose = () => {
    exitSimulation();
    onClose();
  };
  const roleLabel = simulation.role === 'guard' ? 'حارس' : simulation.role === 'coordinator' ? 'منسقة' : 'مسوق';

  return (
    <Sheet
      wide
      title="تبديل الحساب"
      icon={ArrowRightLeft}
      tone="amy"
      onClose={onClose}
      footer={<Act tone="line" icon={X} label="إغلاق" onClick={onClose} />}
    >
      {/* الحساب النشط حالياً */}
      <Row
        icon={simulation.isSimulating ? Eye : ShieldCheck}
        tone={simulation.isSimulating ? 'sand' : 'jade'}
        title={simulation.isSimulating ? `معاينة: ${simulation.targetName}` : 'الإدارة العامة'}
        sub={simulation.isSimulating ? `الحساب النشط · ${roleLabel}` : 'الحساب النشط · صلاحية كاملة'}
      />
      {simulation.isSimulating && <Act tone="jade" icon={ShieldCheck} label="إنهاء المعاينة" title="إنهاء المعاينة والرجوع للإدارة" onClick={exitAndClose} />}

      <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="الاسم أو الكود أو الجوال" />
      <Seg
        label="نوع الحساب"
        value={activeFilter}
        onChange={setActiveFilter}
        items={[
          { id: 'all', label: 'الكل' },
          { id: 'guards', label: 'الحراس' },
          { id: 'marketers', label: 'المسوقون' },
          { id: 'coordinators', label: 'المنسقات' },
        ]}
      />

      {/* الإدارة العامة */}
      {showAdmin && (
        <Row
          icon={ShieldCheck}
          tone="jade"
          title="الإدارة العامة"
          sub="المدير العام"
          end={<Act small tone="jade" icon={ShieldCheck} label="تصفح" title="تصفح كإدارة" onClick={exitAndClose} />}
        />
      )}

      {/* الحراس */}
      {(activeFilter === 'all' || activeFilter === 'guards') && filteredGuards.length > 0 && (
        <>
          <Head title="الحراس" icon={Key} tone="sand" count={filteredGuards.length} />
          {filteredGuards.map((g) => {
            const isCurrentGuard = userRole === 'guard' && (guard.id === g.id || simulation.targetId === g.id);
            const isTested = testedAccountId === g.id;
            return (
              <div key={g.id} className={`kt-bk ${isCurrentGuard ? 'kt-on' : ''}`}>
                <div className="kt-bk-h">
                  <Face src={g.avatar} name={g.name} size={44} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{g.name}</span>
                    <span className="kt-row-s">{g.assignedPropertyName || 'عقار غير محدد'}</span>
                  </span>
                  {isCurrentGuard && <Tag tone="gold">نشط</Tag>}
                </div>
                <Infos cols={2}>
                  <Info label="الجوال" value={g.phone || '—'} ltr />
                  <Info label="الراتب" value={`${fmtN(g.salary || 3500)} ر.س`} />
                </Infos>
                <Acts cols={2}>
                  <Act small tone="ink" icon={Eye} label="دخول كحارس" onClick={() => handleSwitch('guard', g.id, g.name, g.assignedPropertyName)} />
                  <Act
                    small
                    tone={isTested ? 'jade' : 'soft'}
                    icon={BellRing}
                    label={isTested ? 'تم ✓' : 'تجربة تنبيه'}
                    title="إرسال تنبيه تجريبي"
                    onClick={() => handleTestAlert('guard', g.id, g.name)}
                  />
                </Acts>
              </div>
            );
          })}
        </>
      )}

      {/* المسوقون */}
      {(activeFilter === 'all' || activeFilter === 'marketers') && filteredMarketers.length > 0 && (
        <>
          <Head title="المسوقون" icon={Users} count={filteredMarketers.length} />
          {filteredMarketers.map((m) => {
            const isCurrentMarketer = userRole === 'marketer' && (currentMarketerId === m.id || simulation.targetId === m.id);
            const isTested = testedAccountId === m.id;
            const stats = marketerStats[m.id] || { bookingsCount: 0, totalEarnings: 0 };
            return (
              <div key={m.id} className={`kt-bk ${isCurrentMarketer ? 'kt-on' : ''}`}>
                <div className="kt-bk-h">
                  <Face src={m.avatar} name={m.name} size={44} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{m.name}</span>
                    <span className="kt-row-s">عمولة {fmtN(m.commissionRate || 5)}%</span>
                  </span>
                  {isCurrentMarketer ? (
                    <Tag tone="gold">نشط</Tag>
                  ) : (
                    <Tag tone="gray" mono>
                      {m.code || '—'}
                    </Tag>
                  )}
                </div>
                <Infos cols={2}>
                  <Info label="الحجوزات" value={fmtN(stats.bookingsCount)} />
                  <Info label="الأرباح" value={`${fmtN(stats.totalEarnings)} ر.س`} />
                </Infos>
                <Acts cols={2}>
                  <Act small tone="ink" icon={Eye} label="دخول كمسوق" onClick={() => handleSwitch('marketer', m.id, m.name)} />
                  <Act
                    small
                    tone={isTested ? 'jade' : 'soft'}
                    icon={BellRing}
                    label={isTested ? 'تم ✓' : 'تجربة تنبيه'}
                    title="إرسال تنبيه تجريبي"
                    onClick={() => handleTestAlert('marketer', m.id, m.name)}
                  />
                </Acts>
              </div>
            );
          })}
        </>
      )}

      {/* المنسقات */}
      {(activeFilter === 'all' || activeFilter === 'coordinators') && filteredCoordinators.length > 0 && (
        <>
          <Head title="المنسقات" icon={Sparkles} tone="garn" count={filteredCoordinators.length} />
          {filteredCoordinators.map((c) => {
            const isCurrentCoord = userRole === 'coordinator' && simulation.targetId === c.id;
            const isTested = testedAccountId === c.id;
            return (
              <div key={c.id} className={`kt-bk ${isCurrentCoord ? 'kt-on' : ''}`}>
                <div className="kt-bk-h">
                  <Face src={c.avatar} name={c.name} size={44} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{c.name}</span>
                    <span className="kt-row-s">{c.specialty || '—'}</span>
                  </span>
                  {isCurrentCoord && <Tag tone="gold">نشط</Tag>}
                </div>
                <Acts cols={2}>
                  <Act small tone="ink" icon={Eye} label="دخول كمنسقة" onClick={() => handleSwitch('coordinator', c.id, c.name)} />
                  <Act
                    small
                    tone={isTested ? 'jade' : 'soft'}
                    icon={BellRing}
                    label={isTested ? 'تم ✓' : 'تجربة تنبيه'}
                    title="إرسال تنبيه تجريبي"
                    onClick={() => handleTestAlert('coordinator', c.id, c.name)}
                  />
                </Acts>
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
};
