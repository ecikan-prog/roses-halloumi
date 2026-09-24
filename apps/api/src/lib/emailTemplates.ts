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

const GENERAL_ENQUIRY_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General enquiry',
  PRODUCT: 'Product enquiry',
  ORDER: 'Order enquiry',
  DELIVERY: 'Delivery enquiry',
  OTHER: 'Other',
};

export function getGeneralEnquiryTypeLabel(enquiryType: string) {
  return GENERAL_ENQUIRY_TYPE_LABELS[enquiryType] ?? enquiryType;
}

export function buildGeneralContactAdminEmail(params: {
  name: string;
  email: string;
  phone?: string | null;
  enquiryType: string;
  message: string;
}) {
  const enquiryTypeLabel = getGeneralEnquiryTypeLabel(params.enquiryType);
  const subject = `New General Contact Enquiry from ${params.name}`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;"><strong>Submission type:</strong> General Contact Enquiry</p>
    <p style="font-size:14px;line-height:22px;"><strong>Name:</strong> ${escapeHtml(params.name)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Email:</strong> ${escapeHtml(params.email)}</p>
    ${params.phone ? `<p style="font-size:14px;line-height:22px;"><strong>Phone:</strong> ${escapeHtml(params.phone)}</p>` : ''}
    <p style="font-size:14px;line-height:22px;"><strong>Enquiry type:</strong> ${escapeHtml(enquiryTypeLabel)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Message:</strong><br/>${escapeHtml(params.message).replace(/\n/g, '<br/>')}</p>
  `;

  const text = [
    'Submission type: General Contact Enquiry',
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    ...(params.phone ? [`Phone: ${params.phone}`] : []),
    `Enquiry type: ${enquiryTypeLabel}`,
    '',
    'Message:',
    params.message,
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export function buildGeneralContactAcknowledgementEmail(params: { name: string; enquiryType: string }) {
  const enquiryTypeLabel = getGeneralEnquiryTypeLabel(params.enquiryType);
  const subject = `Thanks for contacting ${BRAND_NAME}`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;">Hi ${escapeHtml(params.name)},</p>
    <p style="font-size:14px;line-height:22px;">Thank you for contacting ${BRAND_NAME}. We've received your ${escapeHtml(enquiryTypeLabel.toLowerCase())} and the ${BRAND_NAME} team will respond as soon as possible.</p>
    <p style="font-size:14px;line-height:22px;">Thanks,<br/>The ${BRAND_NAME} Team</p>
  `;

  const text = [
    `Hi ${params.name},`,
    '',
    `Thank you for contacting ${BRAND_NAME}. We've received your ${enquiryTypeLabel.toLowerCase()} and the ${BRAND_NAME} team will respond as soon as possible.`,
    '',
    'Thanks,',
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export function buildWholesaleEnquiryAdminEmail(params: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  businessLocation: string;
  message: string;
}) {
  const subject = `New Wholesale Enquiry from ${params.businessName}`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;"><strong>Submission type:</strong> Wholesale Enquiry</p>
    <p style="font-size:14px;line-height:22px;"><strong>Business name:</strong> ${escapeHtml(params.businessName)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Contact name:</strong> ${escapeHtml(params.contactName)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Email:</strong> ${escapeHtml(params.email)}</p>
    ${params.phone ? `<p style="font-size:14px;line-height:22px;"><strong>Phone:</strong> ${escapeHtml(params.phone)}</p>` : ''}
    <p style="font-size:14px;line-height:22px;"><strong>Business/location:</strong> ${escapeHtml(params.businessLocation)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Message:</strong><br/>${escapeHtml(params.message).replace(/\n/g, '<br/>')}</p>
  `;

  const text = [
    'Submission type: Wholesale Enquiry',
    `Business name: ${params.businessName}`,
    `Contact name: ${params.contactName}`,
    `Email: ${params.email}`,
    ...(params.phone ? [`Phone: ${params.phone}`] : []),
    `Business/location: ${params.businessLocation}`,
    '',
    'Message:',
    params.message,
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export function buildWholesaleEnquiryAcknowledgementEmail(params: { contactName: string }) {
  const subject = `Thanks for your wholesale enquiry — ${BRAND_NAME}`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;">Hi ${escapeHtml(params.contactName)},</p>
    <p style="font-size:14px;line-height:22px;">Thank you for contacting ${BRAND_NAME}. We've received your wholesale enquiry and the ${BRAND_NAME} team will respond as soon as possible.</p>
    <p style="font-size:14px;line-height:22px;">Thanks,<br/>The ${BRAND_NAME} Team</p>
  `;

  const text = [
    `Hi ${params.contactName},`,
    '',
    `Thank you for contacting ${BRAND_NAME}. We've received your wholesale enquiry and the ${BRAND_NAME} team will respond as soon as possible.`,
    '',
    'Thanks,',
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export function buildWholesaleApplicationAdminEmail(params: {
  businessName: string;
  businessType: string;
  nzbn?: string;
  contactName: string;
  email: string;
  phone?: string | null;
  deliveryAddress: string;
  estimatedVolume?: string;
  productsOfInterest?: string;
  message?: string;
}) {
  const subject = `New Wholesale Application from ${params.businessName}`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;"><strong>Submission type:</strong> Wholesale Application</p>
    <p style="font-size:14px;line-height:22px;"><strong>Business name:</strong> ${escapeHtml(params.businessName)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Business type:</strong> ${escapeHtml(params.businessType)}</p>
    ${params.nzbn ? `<p style="font-size:14px;line-height:22px;"><strong>NZBN:</strong> ${escapeHtml(params.nzbn)}</p>` : ''}
    <p style="font-size:14px;line-height:22px;"><strong>Contact name:</strong> ${escapeHtml(params.contactName)}</p>
    <p style="font-size:14px;line-height:22px;"><strong>Email:</strong> ${escapeHtml(params.email)}</p>
    ${params.phone ? `<p style="font-size:14px;line-height:22px;"><strong>Phone:</strong> ${escapeHtml(params.phone)}</p>` : ''}
    <p style="font-size:14px;line-height:22px;"><strong>Delivery address:</strong><br/>${escapeHtml(params.deliveryAddress).replace(/\n/g, '<br/>')}</p>
    ${params.estimatedVolume ? `<p style="font-size:14px;line-height:22px;"><strong>Estimated volume:</strong> ${escapeHtml(params.estimatedVolume)}</p>` : ''}
    ${params.productsOfInterest ? `<p style="font-size:14px;line-height:22px;"><strong>Products of interest:</strong> ${escapeHtml(params.productsOfInterest)}</p>` : ''}
    ${params.message ? `<p style="font-size:14px;line-height:22px;"><strong>Message:</strong><br/>${escapeHtml(params.message).replace(/\n/g, '<br/>')}</p>` : ''}
  `;

  const text = [
    'Submission type: Wholesale Application',
    `Business name: ${params.businessName}`,
    `Business type: ${params.businessType}`,
    ...(params.nzbn ? [`NZBN: ${params.nzbn}`] : []),
    `Contact name: ${params.contactName}`,
    `Email: ${params.email}`,
    ...(params.phone ? [`Phone: ${params.phone}`] : []),
    `Delivery address: ${params.deliveryAddress}`,
    ...(params.estimatedVolume ? [`Estimated volume: ${params.estimatedVolume}`] : []),
    ...(params.productsOfInterest ? [`Products of interest: ${params.productsOfInterest}`] : []),
    ...(params.message ? ['', 'Message:', params.message] : []),
  ].join('\n');

  return { subject, html: wrapEmailHtml(subject, bodyHtml), text };
}

export function buildWholesaleApplicationAcknowledgementEmail(params: { contactName: string }) {
  const subject = `Your ${BRAND_NAME} wholesale application has been received`;
  const bodyHtml = `
    <p style="font-size:14px;line-height:22px;">Hi ${escapeHtml(params.contactName)},</p>
    <p style="font-size:14px;line-height:22px;">Thank you for submitting your wholesale application to ${BRAND_NAME}. We've received your application and our team will review it and respond within 1 business day.</p>
    <p style="font-size:14px;line-height:22px;">If you have any questions in the meantime, feel free to reach out to us at info@grasslandcheese.com.</p>
    <p style="font-size:14px;line-height:22px;">Thanks,<br/>The ${BRAND_NAME} Team</p>
  `;

  const text = [
    `Hi ${params.contactName},`,
    '',
    `Thank you for submitting your wholesale application to ${BRAND_NAME}. We've received your application and our team will review it and respond within 1 business day.`,
    '',
    'If you have any questions in the meantime, feel free to reach out to us at info@grasslandcheese.com.',
    '',
    'Thanks,',
    `The ${BRAND_NAME} Team`,
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
