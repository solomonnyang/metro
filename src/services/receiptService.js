import PDFDocument from 'pdfkit';

const BRAND = '#7367f0';
const BRAND_LIGHT = '#f1effd';
const INK = '#26272b';
const MUTED = '#8a8f98';
const LINE = '#e6e6ef';
const SUCCESS = '#11a04c';
const SUCCESS_BG = '#dff7e7';

const MARGIN = 48;

const formatNaira = (amount) =>
  Number(amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });

const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

const card = (doc, x, y, w, h, fill, stroke) => {
  doc.save();
  doc.roundedRect(x, y, w, h, 10);
  if (fill) doc.fill(fill);
  if (stroke) doc.lineWidth(1).strokeColor(stroke).stroke();
  doc.restore();
};

const kvSectionHeight = (items) => 14 + 18 + items.length * 28 + 14;

const kvSection = (doc, x, w, title, items) => {
  const y0 = doc.y;
  const pad = 14;
  const h = kvSectionHeight(items);
  card(doc, x, y0, w, h, '#ffffff', LINE);

  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), x + pad, y0 + pad + 2);
  doc.moveDown(0.1);

  items.forEach((item, i) => {
    const yy = y0 + pad + 22 + i * 28;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text((item.label || '').toUpperCase(), x + pad, yy);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(item.value ?? 'N/A'), x + pad, yy + 12);
  });

  doc.y = y0 + h + 12;
};

const rightAlignedStack = (doc, x, w, rows, startY, rowGap = 22) => {
  rows.forEach((row, i) => {
    const yy = startY + i * rowGap;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(row[0].toUpperCase(), x, yy, { align: 'right', width: w });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(row[1] ?? 'N/A'), x, yy + 12, { align: 'right', width: w });
  });
};

export const generateReceiptPdf = (payment) => {
  const bill = payment.bill || {};
  const account = bill.account || {};

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const contentW = doc.page.width - MARGIN * 2;
  const isPrepaid = account.accountType?.toLowerCase() === 'prepaid';
  const customerName = [payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(' ') || 'N/A';

  doc.fillColor(BRAND).rect(0, 0, doc.page.width, 112).fill();
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('MetroElectric', MARGIN, 30);
  doc.font('Helvetica').fontSize(11).fillColor('#e3deff')
    .text('Electricity Payment Receipt', MARGIN, 60);

  const badgeW = 96;
  const badgeH = 30;
  card(doc, doc.page.width - MARGIN - badgeW, 34, badgeW, badgeH, SUCCESS_BG);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(SUCCESS)
    .text('PAID', doc.page.width - MARGIN - badgeW, 43, { align: 'center', width: badgeW });

  doc.fillColor(BRAND).rect(0, 112, doc.page.width, 4).fill();

  doc.y = 122;

  const heroH = 116;
  card(doc, MARGIN, doc.y, contentW, heroH, '#ffffff', LINE);
  const heroY = doc.y;
  const pad = 20;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('AMOUNT PAID', MARGIN + pad, heroY + pad);
  doc.font('Helvetica-Bold').fontSize(30).fillColor(INK).text(formatNaira(payment.amount), MARGIN + pad, heroY + pad + 14);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text(`${payment.currency}  |  Paid via Paystack`, MARGIN + pad, heroY + pad + 60);

  rightAlignedStack(doc, MARGIN + pad, contentW - pad * 2, [
    ['Receipt No', payment.paystackReference],
    ['Date', formatDateTime(payment.paidAt || payment.createdAt)],
    ['Method', `Paystack (${payment.paymentChannel || 'Card'})`]
  ], heroY + pad + 10);

  doc.y = heroY + heroH + 10;

  const halfW = (contentW - 16) / 2;
  const rightX = MARGIN + halfW + 16;

  const custH = kvSectionHeight([['CUSTOMER', customerName], ['EMAIL', payment.user?.email]]);
  const meterH = kvSectionHeight([
    ['METER NUMBER', account.meterNumber],
    ['ACCOUNT NAME', account.accountName || 'My Meter']
  ]);
  const row1H = Math.max(custH, meterH);

  card(doc, MARGIN, doc.y, halfW, row1H, '#ffffff', LINE);
  const custY = doc.y;
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(9).text('CUSTOMER', MARGIN + 16, custY + 16);
  [
    ['Customer', customerName],
    ['Email', payment.user?.email]
  ].forEach((item, i) => {
    const yy = custY + 16 + 22 + i * 28;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item[0].toUpperCase(), MARGIN + 16, yy);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(item[1] ?? 'N/A'), MARGIN + 16, yy + 12);
  });

  card(doc, rightX, custY, halfW, row1H, '#ffffff', LINE);
  [
    ['Meter Number', account.meterNumber],
    ['Account Name', account.accountName || 'My Meter']
  ].forEach((item, i) => {
    const yy = custY + 16 + 22 + i * 28;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item[0].toUpperCase(), rightX + 16, yy);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(item[1] ?? 'N/A'), rightX + 16, yy + 12);
  });

  doc.y = custY + row1H + 10;

  const typeH = kvSectionHeight([['METER TYPE', account.accountType || 'N/A'], ['DISTRIBUTION CO', account.distributionCompany || 'N/A']]);
  const billH = kvSectionHeight([['BILL REFERENCE', bill.billReference], ['BILL PERIOD', bill.period || 'N/A']]);
  const row2H = Math.max(typeH, billH);

  card(doc, MARGIN, doc.y, halfW, row2H, '#ffffff', LINE);
  const typeY = doc.y;
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(9).text('METER', MARGIN + 16, typeY + 16);
  [
    ['Meter Type', account.accountType ? `${account.accountType[0].toUpperCase()}${account.accountType.slice(1)}` : 'N/A'],
    ['Distribution Co', account.distributionCompany || 'N/A']
  ].forEach((item, i) => {
    const yy = typeY + 16 + 22 + i * 28;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item[0].toUpperCase(), MARGIN + 16, yy);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(item[1] ?? 'N/A'), MARGIN + 16, yy + 12);
  });

  card(doc, rightX, typeY, halfW, row2H, '#ffffff', LINE);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(9).text('BILL', rightX + 16, typeY + 16);
  [
    ['Bill Reference', bill.billReference],
    ['Bill Period', bill.period || 'N/A']
  ].forEach((item, i) => {
    const yy = typeY + 16 + 22 + i * 28;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item[0].toUpperCase(), rightX + 16, yy);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(item[1] ?? 'N/A'), rightX + 16, yy + 12);
  });

  doc.y = typeY + row2H + 10;

  const payH = kvSectionHeight([['PAYMENT REF', payment.paystackReference], ['STATUS', 'PAID']]);
  card(doc, MARGIN, doc.y, contentW, payH, '#ffffff', LINE);
  const payY = doc.y;
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(9).text('PAYMENT', MARGIN + 16, payY + 16);
  const payColW = (contentW - 32 - 16) / 2;
  [
    ['Payment Reference', payment.paystackReference],
    ['Status', `${payment.status === 'success' ? 'Paid successfully' : payment.status}`]
  ].forEach((item, i) => {
    const x = MARGIN + 16 + i * (payColW + 16);
    const yy = payY + 16 + 22;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item[0].toUpperCase(), x, yy);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(item[1] ?? 'N/A'), x, yy + 12);
  });
  doc.y = payY + payH + 10;

  if (isPrepaid && bill.token) {
    const tokenY = doc.y;
    const tokenH = 96;
    card(doc, MARGIN, doc.y, contentW, tokenH, BRAND_LIGHT);
    doc.save();
    doc.roundedRect(MARGIN + 16, doc.y + 14, 5, tokenH - 28, 3).fill(BRAND);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text('YOUR ELECTRICITY TOKEN', MARGIN + 34, tokenY + 16);
    doc.font('Courier-Bold').fontSize(20).fillColor(INK).text(bill.token, MARGIN + 34, tokenY + 38);
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Enter this 20-digit token into your meter to credit your units.', MARGIN + 34, tokenY + 70);
    doc.y = tokenY + tokenH + 10;
  }

  doc.moveDown(1.2);
  const footerY = doc.y;
  doc.save();
  doc.dash(4, { space: 4 }).moveTo(MARGIN, footerY).lineTo(doc.page.width - MARGIN, footerY).lineWidth(1).strokeColor(LINE).stroke();
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text('MetroElectric', null, footerY + 14, { align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text('Thank you for paying with MetroElectric. For help, open @MetroelectricBot on Telegram.', { align: 'center' });
  doc.text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

  doc.end();
  return finished;
};