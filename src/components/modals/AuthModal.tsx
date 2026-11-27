import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, LogIn, LogOut, Loader2, Plus, RefreshCw, Trash2, UserCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { googleSignIn, googleLogout } from '../../services/googleAuth';
import { AddMemberModal } from './AddMemberModal';
import { Act, Acts, Check, Face, IconBtn, Info, Infos, Seg, Sheet, Tag, type Tone } from '../ui/kit';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    isAdmin,
    isGuard,
    userRole,
    currentUserAccount,
    userAccounts,
    deleteMarketer,
    deleteCoordinator,
    deleteGuard,
    deleteUserAccount,
    loginWithGoogleAuth,
    refreshFromServer,
    logout,
    syncStatus,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'account' | 'members'>(isAdmin ? 'members' : 'account');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSwitch = async () => {
    setStatusMessage(null);
    setIsGoogleLoading(true);
    try {
      const res = await googleSignIn();
      if (!res?.user?.email) {
        throw new Error('لم يصل البريد من Google');
      }

      const authRes = await loginWithGoogleAuth(
        res.user.email,
        res.user.displayName || undefined,
        res.user.photoURL || undefined
      );

      if (authRes.success) {
        setStatusMessage({ ok: true, msg: authRes.message });
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        await googleLogout();
        setStatusMessage({ ok: false, msg: authRes.message });
      }
    } catch (err: any) {
      console.error('Google Switch error:', err);
      let errMsg = 'تعذر الدخول بحساب Google';
      if (err?.message) {
        errMsg = err.message;
      }
      setStatusMessage({ ok: false, msg: errMsg });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRefreshMembers = async () => {
    setIsRefreshing(true);
    const ok = await refreshFromServer();
    setIsRefreshing(false);
    setStatusMessage(
      ok
        ? { ok: true, msg: 'تم تحديث الأعضاء من Firebase' }
        : { ok: false, msg: 'تعذر التحديث، تحقق من الاتصال' }
    );
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleDeleteMember = async (
    accountId: string,
    marketerId?: string,
    coordinatorId?: string,
    guardId?: string,
    name?: string
  ) => {
    setPendingDeleteId(null);

    if (marketerId) {
      deleteMarketer(marketerId);
    } else if (coordinatorId) {
      deleteCoordinator(coordinatorId);
    } else if (guardId) {
      const res = deleteGuard(guardId);
      if (!res.success) {
        setStatusMessage({ ok: false, msg: res.message });
        return;
      }
    } else {
      const res = deleteUserAccount(accountId);
      if (!res.success) {
        setStatusMessage({ ok: false, msg: res.message });
        return;
      }
    }

    setStatusMessage({ ok: true, msg: `تم حذف ${name || 'الحساب'}` });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const roleInfo = (role?: string): { label: string; tone: Tone } =>
    role === 'admin'
      ? { label: 'إدارة', tone: 'amy' }
      : role === 'guard'
      ? { label: 'حارس', tone: 'sand' }
      : role === 'coordinator'
      ? { label: 'منسقة', tone: 'garn' }
      : { label: 'مسوقة', tone: 'saph' };

  const syncState: 'ok' | 'wait' | 'err' | 'idle' =
    syncStatus === 'connected' ? 'ok' : syncStatus === 'syncing' ? 'wait' : syncStatus === 'error' ? 'err' : 'idle';
  const syncText =
    syncStatus === 'connected' ? 'متصل ومزامن' : syncStatus === 'syncing' ? 'جاري الحفظ…' : syncStatus === 'error' ? 'تعذر الحفظ' : 'تخزين محلي';

  return (
    <>
      <Sheet
        title="الحسابات والأعضاء"
        icon={UserCheck}
        tone="amy"
        onClose={onClose}
        footer={<Check label="مزامنة Firebase" value={syncText} state={syncState} />}
      >
        {isAdmin && (
          <Seg
            compact
            label="القسم"
            value={activeTab}
            onChange={(v) => {
              setActiveTab(v);
              setStatusMessage(null);
            }}
            items={[
              { id: 'members' as const, label: `الأعضاء ${userAccounts.length}` },
              { id: 'account' as const, label: 'حسابي' },
            ]}
          />
        )}

        {statusMessage && (
          <div className={statusMessage.ok ? 'kt-ok' : 'kt-err'} role={statusMessage.ok ? 'status' : 'alert'}>
            {statusMessage.ok ? (
              <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{statusMessage.msg}</span>
              </span>
            ) : (
              <>
                <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{statusMessage.msg}</span>
              </>
            )}
          </div>
        )}

        {/* الأعضاء المصرح لهم (للإدارة فقط) */}
        {activeTab === 'members' && isAdmin && (
          <>
            <Acts cols={2}>
              <Act tone="ink" icon={Plus} label="إضافة عضو" title="إضافة عضو بالبريد" onClick={() => setIsAddModalOpen(true)} />
              <Act
                tone="soft"
                icon={RefreshCw}
                label={isRefreshing ? 'جاري التحديث…' : 'تحديث'}
                title="تحديث القائمة من Firebase"
                disabled={isRefreshing}
                onClick={handleRefreshMembers}
              />
            </Acts>

            {userAccounts.map((acc) => {
              const isOwner = acc.email.toLowerCase() === 'sakt2008@gmail.com';
              const { label, tone } = roleInfo(acc.role);
              const confirming = pendingDeleteId === acc.id;
              return (
                <div key={acc.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <Face name={acc.name || 'U'} size={40} />
                    <span className="kt-row-t">
                      <span className="kt-row-n">{acc.name}</span>
                      <bdi dir="ltr" className="kt-row-s" style={{ textAlign: 'right' }}>
                        {acc.email}
                      </bdi>
                    </span>
                    <Tag tone={tone}>{label}</Tag>
                    {isOwner ? (
                      <Tag tone="gold">المالك</Tag>
                    ) : (
                      !confirming && <IconBtn icon={Trash2} tone="garn" label={`حذف ${acc.name}`} onClick={() => setPendingDeleteId(acc.id)} />
                    )}
                  </div>
                  {!isOwner && confirming && (
                    <Acts cols={2}>
                      <Act
                        small
                        tone="garnet"
                        icon={Trash2}
                        label="تأكيد الحذف"
                        onClick={() => handleDeleteMember(acc.id, acc.marketerId, acc.coordinatorId, acc.guardId, acc.name)}
                      />
                      <Act small tone="line" icon={X} label="إلغاء" onClick={() => setPendingDeleteId(null)} />
                    </Acts>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* حسابي والدخول */}
        {activeTab === 'account' && (
          <>
            <Infos cols={2}>
              <Info label="الحساب" value={currentUserAccount?.name || 'مستخدم'} />
              <Info
                label="الدور"
                value={
                  userRole === 'admin' ? 'الإدارة' : userRole === 'guard' ? 'حارس' : userRole === 'coordinator' ? 'منسقة' : 'مسوقة'
                }
              />
              <Info wide ltr label="البريد" value={currentUserAccount?.email || '—'} />
            </Infos>
            <Acts cols={1}>
              <Act
                tone="ink"
                icon={isGoogleLoading ? Loader2 : LogIn}
                label={isGoogleLoading ? 'جاري التحقق…' : 'تبديل الحساب'}
                title="تبديل الحساب والدخول بحساب Google الرسمي"
                disabled={isGoogleLoading}
                onClick={handleGoogleSwitch}
              />
              <Act
                tone="garnS"
                icon={LogOut}
                label="تسجيل الخروج"
                title="تسجيل الخروج من الحساب"
                onClick={() => {
                  logout();
                  onClose();
                }}
              />
            </Acts>
          </>
        )}
      </Sheet>

      {/* إضافة عضو */}
      {isAddModalOpen && <AddMemberModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />}
    </>
  );
};
