const PDFDocument = require('pdfkit');

/**
 * Generates a certificate PDF entirely IN MEMORY and returns it as a
 * Buffer — nothing is ever written to disk. This is a deliberate security
 * choice: with no certificates directory to manage, there's no
 * file-path-traversal surface at all for this feature, and nothing to
 * clean up or leak across requests. The PDF is rebuilt fresh from the
 * database every time it's requested (see certificate.service.js's
 * downloadCertificate), which also means it always reflects the current
 * revocation status.
 *
 * All content is passed in as plain data — no hardcoded employee/event
 * values anywhere in this file.
 */
const generateCertificatePdfBuffer = ({
  employeeName,
  eventTitle,
  eventDate,
  organizerName,
  certificateNumber,
  issuedAt,
  qrDataUrl,
}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;

    doc
      .rect(20, 20, pageWidth - 40, doc.page.height - 40)
      .lineWidth(2)
      .strokeColor('#4f46e5')
      .stroke();
    doc
      .rect(30, 30, pageWidth - 60, doc.page.height - 60)
      .lineWidth(0.5)
      .strokeColor('#c7d2fe')
      .stroke();

    doc
      .fillColor('#4f46e5')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(organizerName.toUpperCase(), 0, 70, { align: 'center' });

    doc
      .fillColor('#1e293b')
      .fontSize(30)
      .font('Helvetica-Bold')
      .text('Certificate of Participation', 0, 110, { align: 'center' });

    doc
      .fillColor('#475569')
      .fontSize(13)
      .font('Helvetica')
      .text('This certificate is proudly presented to', 0, 165, { align: 'center' });

    doc
      .fillColor('#4f46e5')
      .fontSize(26)
      .font('Helvetica-Bold')
      .text(employeeName, 0, 195, { align: 'center' });

    doc
      .fillColor('#475569')
      .fontSize(13)
      .font('Helvetica')
      .text('for successfully participating in', 0, 240, { align: 'center' });

    doc
      .fillColor('#1e293b')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(eventTitle, 0, 262, { align: 'center' });

    doc
      .fillColor('#475569')
      .fontSize(12)
      .font('Helvetica')
      .text(
        `held on ${new Date(eventDate).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`,
        0,
        292,
        { align: 'center' }
      );

    const footerY = doc.page.height - 130;

    doc
      .fontSize(9)
      .fillColor('#64748b')
      .font('Helvetica')
      .text(`Certificate No: ${certificateNumber}`, 70, footerY)
      .text(`Issued: ${new Date(issuedAt).toLocaleDateString()}`, 70, footerY + 14)
      .text("Scan the QR code to verify this certificate's authenticity.", 70, footerY + 28);

    if (qrDataUrl) {
      const base64 = qrDataUrl.split(',')[1];
      const qrBuffer = Buffer.from(base64, 'base64');
      doc.image(qrBuffer, pageWidth - 170, footerY - 10, { width: 90, height: 90 });
    }

    doc.end();
  });
};

module.exports = { generateCertificatePdfBuffer };
