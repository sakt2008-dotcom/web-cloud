import React, { useMemo, useState } from 'react';
import { Download, Eye, Paperclip, Trash2 } from 'lucide-react';
import { Booking } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  BookingOwnerCategory,
  downloadReceiptFile,
  getBookingOwnerCategory,
  getBookingOwnerCategoryLabel,
  getBookingReceiptsList,
} from '../../lib/bookingReceipts';
import { Act, Chip, Chips, IconBtn, Info, Infos, Row, SearchBox, Seg, Sheet, Tag, Tile } from '../ui/kit';
import { BookingReceiptsModal } from './BookingReceiptsModal';

interface BankReceiptsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankReceiptsHubModal: React.FC<BankReceiptsHubModalProps> = ({ isOpen, onClose }) => {
  const { bookings, isAdmin, isSupervisor, currentMarketerId, canViewSupervisor } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<'all' | BookingOwnerCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'saved' | 'deleted' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const roleScopedBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      const cat = getBookingOwnerCategory(b);
      if (isAdmin) return true;
      if (cat === 'supervisor') {
        return (
          (canViewSupervisor || isSupervisor) &&
          (!b.supervisorId || b.supervisorId === currentMarketerId || b.marketerId === currentMarketerId)
        );
      }
      if (cat === 'marketer') {
        return b.marketerId === currentMarketerId;
      }
      return false;
    });
  }, [bookings, isAdmin, isSupervisor, canViewSupervisor, currentMarketerId]);

  const enrichedBookings = useMemo(() => {
    return roleScopedBookings
      .map((booking) => {
        const receipts = getBookingReceiptsList(booking);
        const category = getBookingOwnerCategory(booking);
        const isDeleted =
          Boolean(booking.receiptsDeletedAfterCommissionPaid) ||
          (booking.commissionStatus === 'paid' && receipts.length === 0);
        return { booking, receipts, category, isDeleted };
      })
      .filter((entry) => entry.receipts.length > 0 || entry.isDeleted);
  }, [roleScopedBookings]);

  const counts = useMemo(() => {
    const saved = enrichedBookings.filter((e) => e.receipts.length > 0).length;
    const deleted = enrichedBookings.filter((e) => e.receipts.length === 0 && e.isDeleted).length;
    const marketer = enrichedBookings.filter((e) => e.category === 'marketer').length;
    const admin = enrichedBookings.filter((e) => e.category === 'admin').length;
    const supervisor = enrichedBookings.filter((e) => e.category === 'supervisor').length;
    return { total: enrichedBookings.length, saved, deleted, marketer, admin, supervisor };
  }, [enrichedBookings]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedBookings.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (statusFilter === 'saved' && entry.receipts.length === 0) return false;
      if (statusFilter === 'deleted' && !(entry.receipts.length === 0 && entry.isDeleted)) {
        return false;
      }
      if (!q) return true;
      const b = entry.booking;
      return (
        b.bookingNumber.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerPhone.toLowerCase().includes(q) ||
        b.propertyName.toLowerCase().includes(q) ||
        (b.marketerName || '').toLowerCase().includes(q) ||
        (b.supervisorName || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedBookings, categoryFilter, statusFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      <Sheet wide title="الإيصالات البنكية" icon={Paperclip} tone="amy" onClose={onClose}>
        <Chips fill={isAdmin ? 4 : 3}>
          <Chip label="الكل" count={counts.total} on={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
          <Chip
            label="المسوق"
            count={counts.marketer}
            on={categoryFilter === 'marketer'}
            onClick={() => setCategoryFilter('marketer')}
          />
          {isAdmin && (
            <Chip
              label="الإدارة"
              count={counts.admin}
              on={categoryFilter === 'admin'}
              onClick={() => setCategoryFilter('admin')}
            />
          )}
          <Chip
            label="المشرف"
            count={counts.supervisor}
            on={categoryFilter === 'supervisor'}
            onClick={() => setCategoryFilter('supervisor')}
          />
        </Chips>

        <Seg
          compact
          label="حالة الإيصالات"
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: 'all' as const, label: 'الكل' },
            { id: 'saved' as const, label: 'محفوظة', badge: counts.saved },
            { id: 'deleted' as const, label: 'محذوفة', badge: counts.deleted },
          ]}
        />

        <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="ابحث بالحجز أو العميل أو العقار" />

        {filteredEntries.length === 0 ? (
          <div className="kt-bk-h kt-bk" style={{ flexDirection: 'row' }}>
            <Tile icon={Paperclip} tone="gray" size={40} />
            <span className="kt-row-t">
              <span className="kt-row-n">لا توجد إيصالات</span>
              <span className="kt-row-s">لا نتائج مطابقة للبحث أو التصنيف</span>
            </span>
          </div>
        ) : (
          filteredEntries.map(({ booking, receipts, category, isDeleted }) => (
            <div key={booking.id} className="kt-bk">
              <div className="kt-bk-h">
                <Tile icon={Paperclip} tone="amy" size={40} />
                <span className="kt-row-t">
                  <span className="kt-row-n">{booking.customerName}</span>
                  <span className="kt-row-s">
                    {booking.propertyName} · {booking.checkInDate}
                  </span>
                </span>
                <Tag tone="amy" mono>
                  {booking.bookingNumber}
                </Tag>
              </div>
              <Infos cols={2}>
                <Info label="التصنيف" value={getBookingOwnerCategoryLabel(category)} />
                <Info label="المسؤول" value={booking.supervisorName || booking.marketerName || 'حجز مباشر'} />
              </Infos>

              {receipts.length > 0 ? (
                receipts.map((item) => (
                  <Row
                    key={item.id}
                    icon={Paperclip}
                    tone="jade"
                    title={item.label}
                    sub={item.fileName}
                    end={
                      <span className="flex gap-1.5">
                        <IconBtn icon={Eye} label="استعراض" onClick={() => setSelectedBooking(booking)} />
                        <IconBtn
                          icon={Download}
                          label="تحميل"
                          onClick={() =>
                            downloadReceiptFile(item.dataUrl, `${booking.bookingNumber}-${item.label}-${item.fileName}`)
                          }
                        />
                      </span>
                    }
                  />
                ))
              ) : isDeleted ? (
                <div className="kt-ok">
                  <span className="text-[13.5px] font-bold" style={{ color: '#0e5a49' }}>
                    ✓ حُذفت بعد تحويل العمولة{booking.receiptsDeletedAt ? ` · ${booking.receiptsDeletedAt}` : ''}
                  </span>
                </div>
              ) : null}

              <Act
                tone="ink"
                icon={receipts.length > 0 ? Eye : Trash2}
                label={receipts.length > 0 ? 'استعراض الكل' : 'التفاصيل'}
                onClick={() => setSelectedBooking(booking)}
              />
            </div>
          ))
        )}
      </Sheet>

      <BookingReceiptsModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </>
  );
};
