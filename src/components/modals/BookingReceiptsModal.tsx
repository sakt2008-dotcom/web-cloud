import React, { useState } from 'react';
import { Crown, Download, Eye, FileText, Paperclip, Sparkles, Trash2, UserCheck, X, ZoomIn } from 'lucide-react';
import { Booking } from '../../types';
import {
  BookingReceiptItem,
  downloadReceiptFile,
  getBookingOwnerCategory,
  getBookingOwnerCategoryLabel,
  getBookingReceiptsList,
  isImageReceiptUrl,
  isPdfReceiptUrl,
} from '../../lib/bookingReceipts';
import { Act, Acts, Info, Infos, Sheet, Tag, Tile } from '../ui/kit';

interface BookingReceiptsModalProps {
  booking: Booking | null;
  onClose: () => void;
}

export const BookingReceiptsModal: React.FC<BookingReceiptsModalProps> = ({ booking, onClose }) => {
  const [zoomedItem, setZoomedItem] = useState<BookingReceiptItem | null>(null);

  if (!booking) return null;

  const receipts = getBookingReceiptsList(booking);
  const category = getBookingOwnerCategory(booking);
  const categoryLabel = getBookingOwnerCategoryLabel(category);
  const isDeletedAfterPaid =
    Boolean(booking.receiptsDeletedAfterCommissionPaid) ||
    (booking.commissionStatus === 'paid' && receipts.length === 0);
  const catIcon = category === 'supervisor' ? Sparkles : category === 'admin' ? Crown : UserCheck;

  return (
    <>
      <Sheet
        wide
        title="الإيصالات البنكية"
        icon={Paperclip}
        tone="amy"
        onClose={onClose}
        footer={
          <Acts cols={1}>
            <Act tone="line" icon={X} label="إغلاق" onClick={onClose} />
          </Acts>
        }
      >
        <div className="kt-bk-h">
          <Tile icon={catIcon} tone="amy" size={44} />
          <span className="kt-row-t">
            <span className="kt-row-n">{booking.customerName}</span>
            <span className="kt-row-s">{booking.propertyName}</span>
          </span>
          <Tag tone="amy" mono>
            {booking.bookingNumber}
          </Tag>
        </div>
        <Infos cols={2}>
          <Info label="التصنيف" value={categoryLabel} />
          <Info label="المسؤول" value={booking.supervisorName || booking.marketerName || 'حجز مباشر'} />
        </Infos>

        {receipts.length === 0 ? (
          isDeletedAfterPaid ? (
            <div className="kt-ok">
              <div className="kt-bk-h">
                <Tile icon={Trash2} tone="jade" size={40} />
                <span className="kt-row-t">
                  <span className="kt-row-n">حُذفت الإيصالات تلقائياً</span>
                  <span className="kt-row-s">
                    بعد تحويل العمولة{booking.receiptsDeletedAt ? ` · ${booking.receiptsDeletedAt}` : ''}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="kt-bk-h kt-bk" style={{ flexDirection: 'row' }}>
              <Tile icon={Paperclip} tone="gray" size={40} />
              <span className="kt-row-t">
                <span className="kt-row-n">لا توجد إيصالات</span>
                <span className="kt-row-s">لم تُرفق إيصالات بنكية لهذا الحجز</span>
              </span>
            </div>
          )
        ) : (
          <>
            <p className="kt-note">
              {receipts.length} محفوظة داخل التطبيق ·{' '}
              {booking.commissionStatus === 'paid' ? 'تم تحويل العمولة' : 'تُحذف تلقائياً بعد تحويل العمولة'}
            </p>
            {receipts.map((item) => {
              const isImg = isImageReceiptUrl(item.dataUrl);
              const isPdf = isPdfReceiptUrl(item.dataUrl);
              const downloadName = `${booking.bookingNumber}-${item.label}-${item.fileName}`;
              return (
                <div key={item.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <Tile icon={isPdf ? FileText : Paperclip} tone={isPdf ? 'garn' : 'amy'} size={40} />
                    <span className="kt-row-t">
                      <span className="kt-row-n">{item.label}</span>
                      <span className="kt-row-s">
                        {item.fileName}
                        {item.dateLabel ? ` · ${item.dateLabel}` : ''}
                      </span>
                    </span>
                  </div>
                  {isImg ? (
                    <button
                      type="button"
                      aria-label="تكبير الصورة"
                      onClick={() => setZoomedItem(item)}
                      className="block w-full cursor-zoom-in"
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.label}
                        className="w-full max-h-64 object-contain rounded-2xl bg-white"
                        style={{ boxShadow: 'inset 0 0 0 1px rgba(27,14,51,.12)' }}
                      />
                    </button>
                  ) : null}
                  <Acts cols={2}>
                    <Act tone="soft" icon={isImg ? ZoomIn : Eye} label={isPdf ? 'فتح الملف' : 'استعراض'} onClick={() => setZoomedItem(item)} />
                    <Act tone="jade" icon={Download} label="تحميل" onClick={() => downloadReceiptFile(item.dataUrl, downloadName)} />
                  </Acts>
                </div>
              );
            })}
          </>
        )}
      </Sheet>

      {zoomedItem && (
        <Sheet
          wide
          title={zoomedItem.label}
          icon={Eye}
          tone="amy"
          onClose={() => setZoomedItem(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="jade"
                icon={Download}
                label="تحميل"
                onClick={() =>
                  downloadReceiptFile(
                    zoomedItem.dataUrl,
                    `${booking.bookingNumber}-${zoomedItem.label}-${zoomedItem.fileName}`
                  )
                }
              />
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setZoomedItem(null)} />
            </Acts>
          }
        >
          <p className="kt-note">
            {booking.bookingNumber} · {zoomedItem.fileName}
          </p>
          {isPdfReceiptUrl(zoomedItem.dataUrl) ? (
            <iframe
              src={zoomedItem.dataUrl}
              title={zoomedItem.label}
              className="w-full rounded-2xl bg-white shrink-0"
              style={{ height: '60dvh', boxShadow: 'inset 0 0 0 1px rgba(27,14,51,.12)' }}
            />
          ) : (
            <img
              src={zoomedItem.dataUrl}
              alt={zoomedItem.label}
              className="w-full object-contain rounded-2xl bg-white shrink-0"
              style={{ maxHeight: '62dvh' }}
            />
          )}
        </Sheet>
      )}
    </>
  );
};
