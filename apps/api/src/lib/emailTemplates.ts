import { BRAND_NAME } from '../config.js';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapEmailHtml(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f1ea;font-family:Arial, Helvetica, sans-serif;color:#1f2d24;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ea;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#1f5c43;padding:24px 32px;">
                <span style="color:#f4e7c1;font-size:20px;font-weight:bold;letter-spacing:0.5px;">${BRAND_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="font-size:20px;margin:0 0 16px;color:#1f5c43;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f4f1ea;color:#6b7a70;font-size:12px;">
                ${BRAND_NAME} • info@grasslandcheese.com
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildWelcomeEmail(params: { name: string }) {
  const subject = `Welcome to ${BRAND_NAME}`;
  const greeting = `Hi ${escapeHtml(params.name)},`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;">${greeting}</p>
    <p style="font-size:14px;line-height:22px;">Thanks for creating a ${BRAND_NAME} customer account. You can now browse our Halloumi range, add products to your cart, and check out whenever you're ready.</p>
    <p style="font-size:14px;line-height:22px;">If you have any questions, reply to this email or reach us directly at info@grasslandcheese.com.</p>
    <p style="font-size:14px;line-height:22px;">Welcome aboard,<br/>The ${BRAND_NAME} Team</p>
  `;

  const text = [
    `Hi ${params.name},`,
    '',
    `Thanks for creating a ${BRAND_NAME} customer account. You can now browse our Halloumi range, add products to your cart, and check out whenever you're ready.`,
    '',
    'If you have any questions, reply to this email or reach us directly at info@grasslandcheese.com.',
    '',
    `Welcome aboard,`,
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export function buildPasswordResetEmail(params: { name: string; resetLink: string }) {
  const subject = `Reset your ${BRAND_NAME} password`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;">Hi ${escapeHtml(params.name)},</p>
    <p style="font-size:14px;line-height:22px;">We received a request to reset the password for your ${BRAND_NAME} account. Click the button below to choose a new password.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(params.resetLink)}" style="background-color:#1f5c43;color:#f4e7c1;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">Reset password</a>
    </p>
    <p style="font-size:13px;line-height:20px;color:#6b7a70;">This link is single-use and expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
  `;

  const text = [
    `Hi ${params.name},`,
    '',
    `We received a request to reset the password for your ${BRAND_NAME} account. Open the link below to choose a new password:`,
    '',
    params.resetLink,
    '',
    "This link is single-use and expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will not be changed.",
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export type OrderConfirmationItem = {
  qty: number;
  unitPrice: number;
  productName: string;
  unit: string;
};

export function buildOrderConfirmationEmail(params: {
  name: string;
  orderNumber: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  deliveryCharge: number;
  discountApplied: number;
  total: number;
  deliveryAddress?: string | null;
  orderNotes?: string | null;
  /** Human-readable payment term, e.g. "Pay in 30". */
  paymentTermLabel: string;
  /** Human-readable payment status, e.g. "Deferred / unpaid". */
  paymentStatusLabel: string;
}) {
  const subject = `Your ${BRAND_NAME} order ${params.orderNumber} is confirmed`;

  const itemRows = params.items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;">${escapeHtml(item.productName)} (${escapeHtml(item.unit)})</td>
          <td style="padding:6px 0;font-size:13px;text-align:center;">${item.qty}</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;">$${(item.qty * item.unitPrice).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  const itemLinesText = params.items
    .map((item) => `  ${item.qty} x ${item.productName} (${item.unit}) - $${(item.qty * item.unitPrice).toFixed(2)}`)
    .join('\n');

  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;">Hi ${escapeHtml(params.name)},</p>
    <p style="font-size:14px;line-height:22px;">Thank you for your order! Here is a summary of order <strong>${escapeHtml(params.orderNumber)}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #e3ddcb;border-bottom:1px solid #e3ddcb;">
      ${itemRows}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      <tr><td>Subtotal</td><td style="text-align:right;">$${params.subtotal.toFixed(2)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right;">-$${params.discountApplied.toFixed(2)}</td></tr>
      <tr><td>Delivery</td><td style="text-align:right;">${params.deliveryCharge > 0 ? `$${params.deliveryCharge.toFixed(2)}` : 'Free'}</td></tr>
      <tr><td style="font-weight:bold;padding-top:8px;">Total</td><td style="text-align:right;font-weight:bold;padding-top:8px;">$${params.total.toFixed(2)}</td></tr>
    </table>
    ${params.deliveryAddress ? `<p style="font-size:13px;line-height:20px;"><strong>Delivery address:</strong><br/>${escapeHtml(params.deliveryAddress).replace(/\n/g, '<br/>')}</p>` : ''}
    <p style="font-size:13px;line-height:20px;"><strong>Payment method:</strong> ${escapeHtml(params.paymentTermLabel)}<br/><strong>Payment status:</strong> ${escapeHtml(params.paymentStatusLabel)}</p>
    ${params.orderNotes ? `<p style="font-size:13px;line-height:20px;"><strong>Order notes:</strong><br/>${escapeHtml(params.orderNotes)}</p>` : ''}
    <p style="font-size:14px;line-height:22px;">We'll be in touch with any updates on your order. Questions? Reply to this email or contact us at info@grasslandcheese.com.</p>
    <p style="font-size:14px;line-height:22px;">Thanks again,<br/>The ${BRAND_NAME} Team</p>
  `;

  const text = [
    `Hi ${params.name},`,
    '',
    `Thank you for your order! Here is a summary of order ${params.orderNumber}.`,
    '',
    itemLinesText,
    '',
    `Subtotal: $${params.subtotal.toFixed(2)}`,
    `Discount: -$${params.discountApplied.toFixed(2)}`,
    `Delivery: ${params.deliveryCharge > 0 ? `$${params.deliveryCharge.toFixed(2)}` : 'Free'}`,
    `Total: $${params.total.toFixed(2)}`,
    '',
    ...(params.deliveryAddress ? [`Delivery address: ${params.deliveryAddress}`, ''] : []),
    `Payment method: ${params.paymentTermLabel}`,
    `Payment status: ${params.paymentStatusLabel}`,
    '',
    ...(params.orderNotes ? [`Order notes: ${params.orderNotes}`, ''] : []),
    'We\'ll be in touch with any updates on your order. Questions? Reply to this email or contact us at info@grasslandcheese.com.',
    '',
    'Thanks again,',
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}
