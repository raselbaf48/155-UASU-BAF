const fs = require('fs');
let code = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

// Reduce top space (it has a lot of "spacing: { after: 120 }" etc in docChildren)
const oldDocChildren = `  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'PARADE STATE & DAILY DUTY REGISTER : AIRMEN',
          font: 'Arial',
          bold: true,
          size: 26,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: unitHeader,
          font: 'Arial',
          bold: true,
          size: 24,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: \`(\${dateRangeHeader})\`,
          font: 'Arial',
          bold: true,
          size: 24,
        }),
      ],
    }),
  ];`;

const newDocChildren = `  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'PARADE STATE : AIRMEN',
          font: 'Arial',
          bold: true,
          size: 20,
          underline: {
             type: 'single',
          },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: unitHeader,
          font: 'Arial',
          bold: true,
          size: 20,
          underline: {
             type: 'single',
          },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: \`Period: \${dateRangeHeader}\`,
          font: 'Arial',
          size: 16,
        }),
      ],
    }),
  ];`;
  
code = code.replace(oldDocChildren, newDocChildren);

// Also we need to make sure the table has cantSplit for all rows to prevent breaking "same dt 2 page a jbe na"
// "cantSplit: true" on TableRow

code = code.replace(
    /new TableRow\(\{/g,
    "new TableRow({ cantSplit: true,"
);

// We need to change orientation to PORTRAIT for multi docx
code = code.replace(
    /orientation: PageOrientation.LANDSCAPE,/g,
    "orientation: PageOrientation.PORTRAIT,"
);

// Change the table layout if necessary or widths
// Since Portrait is narrower, we might need smaller widths but word will autofit to window anyway
// To remove the "margin: { top: 720" we can replace it
code = code.replace(
    /margin: \{ top: 720, right: 720, bottom: 720, left: 720 \},/g,
    "margin: { top: 400, right: 400, bottom: 400, left: 400 },"
);


fs.writeFileSync('src/utils/docxExport.ts', code);
