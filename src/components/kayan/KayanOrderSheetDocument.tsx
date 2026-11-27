import React, { forwardRef } from 'react';
import { KayanOrderSheet } from '../../types';
import { formatKayanOrderDateTime, formatKayanUnitQuantity } from '../../lib/kayanDetergents';
import { generateQRCodeSvg } from '../../lib/qrCode';

export interface KayanOrderSheetDocumentProps {
  order: KayanOrderSheet;
  compact?: boolean;
}

export const KayanOrderSheetDocument = forwardRef<HTMLDivElement, KayanOrderSheetDocumentProps>(
  ({ order, compact = false }, ref) => {
    const qrUri = order.locationUrl
      ? generateQRCodeSvg(order.locationUrl, 86)
      : generateQRCodeSvg(`KAYAN-${order.orderNumber}`, 86);

    const outerPad = compact ? '16px' : '24px';

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #D8CCF0',
          borderRadius: '14px',
          padding: outerPad,
          color: '#0F172A',
          fontFamily: "'Tajawal', system-ui, -apple-system, sans-serif",
          lineHeight: 1.6,
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Top Official Royal Purple Banner */}
        <div
          style={{
            backgroundColor: '#4C1D95',
            borderRadius: '12px',
            padding: compact ? '16px 18px' : '20px 22px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                color: '#DDD6FE',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            >
              AMASA RESORT · نموذج طلب توريد مستلزمات نظافة
            </div>
            <h1
              style={{
                color: '#FFFFFF',
                fontSize: compact ? '20px' : '24px',
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              كيان للمنظفات — ورقة طلبات المندوب
            </h1>
          </div>
          <div
            style={{
              backgroundColor: '#5B21B6',
              border: '1px solid #7C3AED',
              borderRadius: '10px',
              padding: '8px 14px',
              textAlign: 'left',
              flexShrink: 0,
            }}
          >
            <div style={{ color: '#DDD6FE', fontSize: '11px', fontWeight: 600 }}>رقم الطلب</div>
            <div
              style={{
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                direction: 'ltr',
              }}
            >
              {order.orderNumber}
            </div>
          </div>
        </div>

        {/* Order Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '18px',
          }}
        >
          <div
            style={{
              backgroundColor: '#F8F5FC',
              border: '1px solid #E5DDF5',
              borderRadius: '10px',
              padding: '10px 14px',
            }}
          >
            <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>الجهة الطالبة</div>
            <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
              {order.propertyName || 'AMASA RESORT'}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#F8F5FC',
              border: '1px solid #E5DDF5',
              borderRadius: '10px',
              padding: '10px 14px',
            }}
          >
            <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>تاريخ ووقت الطلب</div>
            <div
              style={{
                color: '#0F172A',
                fontSize: '13px',
                fontWeight: 700,
                marginTop: '2px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatKayanOrderDateTime(order.createdAt)}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#F8F5FC',
              border: '1px solid #E5DDF5',
              borderRadius: '10px',
              padding: '10px 14px',
            }}
          >
            <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>رقم جوال المندوب</div>
            <div
              style={{
                color: '#4C1D95',
                fontSize: '14px',
                fontWeight: 800,
                marginTop: '2px',
                fontVariantNumeric: 'tabular-nums',
                direction: 'ltr',
                textAlign: 'right',
              }}
            >
              {order.delegatePhone || 'غير محدد'}
              {order.delegateName ? ` · ${order.delegateName}` : ''}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#F8F5FC',
              border: '1px solid #E5DDF5',
              borderRadius: '10px',
              padding: '10px 14px',
            }}
          >
            <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>إجمالي بنود الطلب</div>
            <div
              style={{
                color: '#0F172A',
                fontSize: '14px',
                fontWeight: 800,
                marginTop: '2px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {order.items.length} صنف
            </div>
          </div>
        </div>

        {/* Strict Order Items Table: Index | Item Number | Item Name | Quantity & Unit (NO PRICES) */}
        <div
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '18px',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'right',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F1ECF9', borderBottom: '1.5px solid #D8CCF0' }}>
                <th
                  style={{
                    padding: '10px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#4C1D95',
                    width: '44px',
                    textAlign: 'center',
                  }}
                >
                  م
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#4C1D95',
                    width: '120px',
                  }}
                >
                  رقم الصنف
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#4C1D95',
                  }}
                >
                  اسم الصنف
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#4C1D95',
                    width: '145px',
                    textAlign: 'center',
                  }}
                >
                  الكمية والوحدة
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr
                  key={`${item.itemId}-${idx}`}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAF8FE',
                    borderBottom: idx === order.items.length - 1 ? 'none' : '1px solid #E2E8F0',
                  }}
                >
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#64748B',
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#4C1D95',
                      fontVariantNumeric: 'tabular-nums',
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  >
                    {item.itemCode || '—'}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    {item.name}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#0F172A',
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatKayanUnitQuantity(item.quantity, item.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes (if any) */}
        {order.notes && (
          <div
            style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#92400E', marginBottom: '2px' }}>
              ملاحظات التوصيل:
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#78350F' }}>{order.notes}</div>
          </div>
        )}

        {/* Delivery Location + Scannable QR Box */}
        <div
          style={{
            backgroundColor: '#F8F5FC',
            border: '1px solid #D8CCF0',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#4C1D95', marginBottom: '3px' }}>
              موقع التوصيل — {order.propertyName}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#334155',
                wordBreak: 'break-all',
                direction: 'ltr',
                textAlign: 'right',
              }}
            >
              {order.locationUrl}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              يمكن للمندوب مسح رمز QR للانتقال مباشرة إلى خرائط قوقل
            </div>
          </div>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              flexShrink: 0,
            }}
          >
            <img
              src={qrUri}
              alt="رمز موقع الاستراحة"
              width={76}
              height={76}
              style={{ display: 'block', width: '76px', height: '76px' }}
            />
          </div>
        </div>
      </div>
    );
  }
);

KayanOrderSheetDocument.displayName = 'KayanOrderSheetDocument';
