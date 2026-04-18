import PDFDocument from 'pdfkit';

export interface CertificateData {
  organisation: string;
  volunteerName: string;
  year: number;
  hours: number;
  shifts: number;
  events: string[];
  issuedOn: string;
}

const GREEN = '#1f7a5a';

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0$/, '');
}

/** Renders a one-page landscape certificate and resolves with the PDF bytes. */
export function renderCertificate(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 56,
      info: {
        Title: `Volunteer certificate ${data.year}: ${data.volunteerName}`,
        Author: data.organisation,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { width, height } = doc.page;
    doc
      .rect(24, 24, width - 48, height - 48)
      .lineWidth(3)
      .stroke(GREEN);
    doc
      .rect(32, 32, width - 64, height - 64)
      .lineWidth(0.75)
      .stroke(GREEN);

    doc.moveDown(2);
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#5f6b64')
      .text(data.organisation, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(34).fillColor(GREEN).text('Certificate of Volunteering', {
      align: 'center',
    });
    doc.moveDown(1.2);
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#1d2420')
      .text('This certifies that', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(28).text(data.volunteerName, { align: 'center' });
    doc.moveDown(0.6);
    doc
      .font('Helvetica')
      .fontSize(16)
      .text(
        `gave ${formatHours(data.hours)} hours of their time as a volunteer in ${data.year}` +
          (data.shifts ? `, across ${data.shifts} shift${data.shifts === 1 ? '' : 's'}.` : '.'),
        { align: 'center' },
      );

    if (data.events.length) {
      doc.moveDown(0.8);
      doc
        .fontSize(12)
        .fillColor('#5f6b64')
        .text(`Including: ${data.events.join(', ')}`, {
          align: 'center',
          width: width - 200,
          indent: 0,
        });
    }

    doc
      .fontSize(11)
      .fillColor('#5f6b64')
      .text(`Issued ${data.issuedOn}`, 56, height - 100, { align: 'center', width: width - 112 });
    doc.end();
  });
}
