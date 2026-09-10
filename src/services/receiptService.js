import PDFDocument from 'pdfkit';

const formatNaira = (amount) =>
  amount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });

const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

const drawLabel = (doc, label, x) => {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#8a8f98').text(label, x, doc.y, { width: 130 });
  doc.moveDown(0.25);
};

const drawValue = (doc, value) => {
  doc.font('Helvetica').fontSize(10).fillColor('#1a1d21').text(value || 'N/A', { width: 240 });
  doc.moveDown(0.35);
};

export const generateReceiptPdf = (payment) => {
  const bill = payment.bill || {};
  const account = bill.account || {};

  const doc = new PDFDocument({ size: 'A4', margin: 52 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const isPrepaid = account.accountType === 'prepaid' || account.accountType?.toLowerCase() === 'prepaid';

  doc.fillColor('#1a3583').rect(0, 0, doc.page.width, 90).fill();

  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('⚡ MetroElectric', 52, 26, { continued: true });
  doc.font('Helvetica').fontSize(11).fillColor('#c9d4f5')
    .text('  Electricity Payment Receipt', { align: 'right', width: doc.page.width - 104 });

  doc.fillColor('#1a1d21');
  doc.moveDown(3.2);

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#1a3583').text('PAYMENT RECEIPT');
  doc.moveDown(0.5);

  doc.font('Helvetica').fontSize(9).fillColor('#8a8f98')
    .text(`Receipt No: ${payment.paystackReference}`, { align: 'right' })
    .text(`Date: ${formatDateTime(payment.paidAt || payment.createdAt)}`, { align: 'right' });
  doc.moveDown(1.2);

  doc.strokeColor('#e5e7eb').moveTo(52, doc.y).lineTo(doc.page.width - 52, doc.y).stroke();
  doc.moveDown(1.3);

  const customerName = [payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(' ') || 'N/A';
  drawLabel(doc, 'CUSTOMER');
  drawValue(doc, customerName);
  drawValue(doc, payment.user?.email);
  doc.moveDown(0.6);

  doc.strokeColor('#e5e7eb').moveTo(52, doc.y).lineTo(doc.page.width - 52, doc.y).stroke();
  doc.moveDown(1.3);

  drawLabel(doc, 'METER DETAILS');
  drawValue(doc, `Meter Number: ${account.meterNumber}`);
  drawValue(doc, `Account Name: ${account.accountName}`);
  drawValue(doc, `Type: ${account.accountType || 'N/A'}  |  Disco: ${account.distributionCompany || 'N/A'}`);
  doc.moveDown(0.6);

  doc.strokeColor('#e5e7eb').moveTo(52, doc.y).lineTo(doc.page.width - 52, doc.y).stroke();
  doc.moveDown(1.3);

  drawLabel(doc, 'BILL DETAILS');
  drawValue(doc, `Bill Reference: ${bill.billReference}`);
  drawValue(doc, `Period: ${bill.period || 'N/A'}`);
  doc.moveDown(0.6);

  doc.strokeColor('#e5e7eb').moveTo(52, doc.y).lineTo(doc.page.width - 52, doc.y).stroke();
  doc.moveDown(1.3);

  drawLabel(doc, 'PAYMENT DETAILS');
  drawValue(doc, `Payment Ref: ${payment.paystackReference}`);
  drawValue(doc, `Method: Paystack (${payment.paymentChannel || 'card'})`);
  drawValue(doc, `Status: ${payment.status === 'success' ? 'PAID ✓' : payment.status}`);
  doc.moveDown(0.6);

  doc.strokeColor('#e5e7eb').moveTo(52, doc.y).lineTo(doc.page.width - 52, doc.y).stroke();
  doc.moveDown(1.5);

  doc.fillColor('#1a3583');
  doc.font('Helvetica-Bold').fontSize(10).text('AMOUNT PAID');
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(28).text(formatNaira(payment.amount));
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor('#8a8f98')
    .text(`${payment.currency}  •  Rate applied by Paystack`);

  if (isPrepaid) {
    doc.moveDown(1.8);
    doc.roundedRect(52, doc.y, doc.page.width - 104, 78, 8).fill('#f1f5ff');
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a3583').text('🔌 YOUR ELECTRICITY TOKEN');
    doc.moveDown(0.4);
    doc.font('Courier-Bold').fontSize(17).fillColor('#0f172a').text(bill.token || 'N/A', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(8).fillColor('#64748b')
      .text('Enter this 20-digit token into your meter to credit your units.', { align: 'center' });
  }

  doc.moveDown(2);
  const footerY = doc.y;
  doc.strokeColor('#e5e7eb').moveTo(52, footerY).lineTo(doc.page.width - 52, footerY).stroke();
  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(8.5).fillColor('#8a8f98')
    .text('Thank you for paying with MetroElectric. For help, open @MetroelectricBot on Telegram.', { align: 'center' });
  doc.text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

  doc.end();
  return finished;
};