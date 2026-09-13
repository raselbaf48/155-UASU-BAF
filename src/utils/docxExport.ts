import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageOrientation,
  TextDirection,
  VerticalAlign,
  HeightRule,
  TableLayoutType,
} from 'docx';
import { saveAs } from 'file-saver';
import { Airman, DutyAssignment, FlightName } from '../types';
import { DutyRatioTable } from '../data/officialDutyRatioMatrix';


const formatRunningLetter = (text: string) => {
  if (!text) return '';
  return text.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export interface RosterExportItem {
  serNo: string;
  bdNo: string;
  rank: string;
  name: string;
  trade: string;
  block: string;
  mobileNo: string;
  dateStr: string;
  section: string;
}

export interface RosterSectionData {
  title: string;
  subTitle?: string;
  items: RosterExportItem[];
}

const invisibleBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

export async function exportDutyRosterDocx(
  unitHeader: string,
  dateRangeHeader: string,
  sections: RosterSectionData[],
  fileName: string = 'Duty_Roster_155_UASU.docx'
) {
  const docChildren: any[] = [
    // Main Unit Header
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'BASE DUTIES: AIRMEN',
          bold: true,
          size: 26, // 13pt
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `(${unitHeader})`,
          bold: true,
          size: 24, // 12pt
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `(${dateRangeHeader})`,
          bold: true,
          size: 22, // 11pt
        }),
      ],
    }),
  ];

  // Add each section and its table
  for (const section of sections) {
    if (section.items.length === 0) continue;

    // Section Title
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: section.subTitle ? 40 : 100 },
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 22,
            underline: {},
          }),
        ],
      })
    );

    if (section.subTitle) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: `(${section.subTitle})`,
              bold: true,
              size: 20,
            }),
          ],
        })
      );
    }

    // Table Header Row
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('Ser No', 800),
        createHeaderCell('BD No', 1100),
        createHeaderCell('Rank', 900),
        createHeaderCell('Name', 1400),
        createHeaderCell('Trade', 1300),
        createHeaderCell('Block', 1100),
        createHeaderCell('Mobile No', 1600),
        createHeaderCell('Date', 1000),
        createHeaderCell('Section', 1200),
      ],
    });

    // Table Data Rows
    const dataRows = section.items.map((item, idx) => {
      const displaySer = String(idx + 1).padStart(2, '0');
      return new TableRow({
        children: [
          createDataCell(item.serNo || displaySer, 800, AlignmentType.CENTER),
          createDataCell(item.bdNo, 1100, AlignmentType.CENTER),
          createDataCell(formatRunningLetter(item.rank), 900, AlignmentType.CENTER),
          createDataCell(formatRunningLetter(item.name), 1400, AlignmentType.LEFT),
          createDataCell(item.trade, 1300, AlignmentType.CENTER),
          createDataCell(item.block || 'L/O', 1100, AlignmentType.CENTER),
          createDataCell(item.mobileNo || '-', 1600, AlignmentType.CENTER),
          createDataCell(item.dateStr, 1000, AlignmentType.CENTER),
          createDataCell(item.section || '155 UASU', 1200, AlignmentType.CENTER),
        ],
      });
    });

    const table = new Table({
    layout: TableLayoutType.AUTOFIT,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });

    docChildren.push(table);
    docChildren.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

export interface IdacRosterRow {
  dateDisplay: string;
  dayDisplay: string;
  morning: string;
  afternoon: string;
  night: string;
}

export async function exportIdacRosterDocx(
  unitHeader: string,
  dateRangeHeader: string,
  rows: IdacRosterRow[],
  fileName: string = 'IDAC_Duty_Roster_155_UASU.docx'
) {
  const docChildren: any[] = [
    // Main Title: DUTY ROSTER : 155 UASU BAF
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `DUTY ROSTER : ${unitHeader.toUpperCase()}`,
          font: 'Arial',
          bold: true,
          size: 26, // 13pt
          underline: {},
        }),
      ],
    }),
    // Sub-title: (IDA CENTER DUTY)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: '(IDA CENTER DUTY)',
          font: 'Arial',
          bold: true,
          size: 24, // 12pt
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `(${dateRangeHeader})`,
          font: 'Arial',
          bold: true,
          size: 22, // 11pt
        }),
      ],
    }),
  ];

  // Table Header Row
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createArialHeaderCell('Date', 1500),
      createArialHeaderCell('Day', 1700),
      createArialHeaderCell('Morning\n(0730F - 1430F)', 2400),
      createArialHeaderCell('Afternoon\n(1430F - 2100F)', 2400),
      createArialHeaderCell('Night\n(2100F - 0730F)', 2800),
    ],
  });

  // Table Data Rows
  const dataRows = rows.map((item) => {
    return new TableRow({
      children: [
        createArialDataCell(item.dateDisplay, 1500, AlignmentType.CENTER),
        createArialDataCell(item.dayDisplay, 1700, AlignmentType.CENTER),
        createArialDataCell(item.morning || '-', 2400, AlignmentType.CENTER),
        createArialDataCell(item.afternoon || '-', 2400, AlignmentType.CENTER),
        createArialDataCell(item.night || '-', 2800, AlignmentType.CENTER),
      ],
    });
  });

  const table = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  docChildren.push(table);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

// 3. NOMINAL ROLL DIRECTORY EXPORT
export async function exportNominalRollDocx(
  airmen: Airman[],
  fileName: string = 'Nominal_Roll_155_UASU_BAF.docx'
) {
  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'NOMINAL ROLL : AIRMEN',
          font: 'Arial',
          bold: true,
          size: 26,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: '155 UASU BAF',
          font: 'Arial',
          bold: true,
          size: 26,
          underline: {},
        }),
      ],
    }),
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createArialHeaderCell('Ser', 700),
      createArialHeaderCell('BD No', 1400),
      createArialHeaderCell('Rank', 1000),
      createArialHeaderCell('Full Name', 2200),
      createArialHeaderCell('Trade', 1400),
      createArialHeaderCell('Flight', 1300),
      
    ],
  });

  const dataRows = airmen.map((a, idx) => {
    return new TableRow({
      children: [
        createArialDataCell(String(idx + 1), 700, AlignmentType.CENTER),
        createArialDataCell(a.bdNo.replace(/^BD\//i, ''), 1400, AlignmentType.CENTER),
        createArialDataCell(formatRunningLetter(a.rank), 1000, AlignmentType.LEFT),
        createArialDataCell(formatRunningLetter(a.fullName || a.name), 2200, AlignmentType.LEFT),
        createArialDataCell(a.trade, 1400, AlignmentType.LEFT),
        createArialDataCell(a.flightName, 1300, AlignmentType.LEFT),
        createArialDataCell(a.addressBlock || '-', 1600, AlignmentType.LEFT),
        createArialDataCell(a.mobileNo || '-', 1500, AlignmentType.CENTER),
        createArialDataCell(a.active !== false ? 'Active' : (a.leaveReason || 'Inactive'), 1200, AlignmentType.CENTER),
      ],
    });
  });

  const table = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  docChildren.push(table);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

// 4. DUTY RATIO MATRIX EXPORT
export async function exportDutyRatioDocx(
  matrix: DutyRatioTable[],
  fileName: string = 'Duty_Ratio_Matrix_155_UASU.docx'
) {
  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'OFFICIAL DUTY RATIO & FLIGHT QUOTA MATRIX : 155 UASU BAF',
          font: 'Arial',
          bold: true,
          size: 26,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: 'Flight-wise Personnel Allocation Guidelines & Daily Shift Quota',
          font: 'Arial',
          bold: false,
          size: 20,
        }),
      ],
    }),
  ];

  for (const tableData of matrix) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 140, after: 60 },
        children: [
          new TextRun({
            text: tableData.title,
            font: 'Arial',
            bold: true,
            size: 22,
          }),
        ],
      })
    );

    const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        createArialHeaderCell('Flight Name', 1800),
        ...Array.from({ length: 31 }, (_, i) =>
          createArialHeaderCell(String(i + 1), 240)
        ),
        createArialHeaderCell('Total Duty', 800),
      ],
    });

    const dailySums = Array.from({ length: 31 }, (_, dayIdx) =>
      flights.reduce((sum, fl) => sum + (tableData.data?.[fl]?.[dayIdx] || 0), 0)
    );
    const tableGrandTotal = flights.reduce((sum, fl) => {
      return sum + (tableData.data?.[fl]?.reduce((s, c) => s + c, 0) || 0);
    }, 0);

    const dataRows = flights.map((fl) => {
      const rowVals = tableData.data?.[fl] || [];
      const rowTotal = rowVals.reduce((s, c) => s + c, 0);
      return new TableRow({
        children: [
          createArialDataCell(fl, 1800, AlignmentType.LEFT),
          ...Array.from({ length: 31 }, (_, i) => {
            const v = rowVals[i] !== undefined ? rowVals[i] : 0;
            return createArialDataCell(v > 0 ? String(v) : '-', 240, AlignmentType.CENTER);
          }),
          createArialDataCell(String(rowTotal), 800, AlignmentType.CENTER, true),
        ],
      });
    });

    const dailyTotalRow = new TableRow({
      children: [
        createArialHeaderCell('Daily Total', 1800),
        ...dailySums.map((dSum) =>
          createArialDataCell(dSum > 0 ? String(dSum) : '-', 240, AlignmentType.CENTER, true)
        ),
        createArialDataCell(String(tableGrandTotal), 800, AlignmentType.CENTER, true),
      ],
    });

    const table = new Table({
    layout: TableLayoutType.AUTOFIT,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows, dailyTotalRow],
    });

    docChildren.push(table);
    docChildren.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { top: 500, right: 500, bottom: 500, left: 500 },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

// 5. SINGLE-DAY PARADE STATE EXPORT
export interface SingleParadeExportParams {
  documentType?: 'PARADE' | 'PT';
  documentTitle?: string;
  dateStr: string;
  flight: string;
  stats: any;
  onParade: Airman[];
  leave: Airman[];
  bakeBite: Airman[];
  tdy: Airman[];
  canteen?: Airman[];
  reception: Airman[];
  dutyOn: { airman: Airman; note?: string }[];
  dutyOff: { airman: Airman; note?: string }[];
  airFdDuty: Airman[];
  essn?: Airman[];
  cmh?: Airman[];
  sickReport?: Airman[];
  drillCatC?: Airman[];
  adminOrder?: Airman[];
  classTrg?: Airman[];
  games?: Airman[];
  absent?: Airman[];
  otherDisposals?: { title: string; airmen: Airman[] }[];
  leftSig?: { rank: string; name: string; desig: string };
  rightSig?: { rank: string; name: string; desig: string };
}

export async function exportParadeStateSingleDocx(
  params: SingleParadeExportParams,
  fileName?: string
) {
  const {
    documentType = 'PARADE',
    documentTitle,
    dateStr,
    flight,
    stats,
    onParade,
    leave = [],
    bakeBite = [],
    tdy = [],
    reception = [],
    dutyOn = [],
    dutyOff = [],
    airFdDuty = [],
    essn = [],
    cmh = [],
    sickReport = [],
    drillCatC = [],
    adminOrder = [],
    classTrg = [],
    games = [],
    absent = [],
    otherDisposals = [],
  } = params;

  const isPt = documentType === 'PT';
  const finalTitle = documentTitle || (isPt ? 'PT STATE : AIRMEN' : 'PARADE STATE : AIRMEN');

  const unitLabel =
    flight === 'Overall'
      ? '155 UASU BAF'
      : `155 UASU BAF (${flight.toUpperCase()} FLT)`;

  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: finalTitle,
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
          text: unitLabel,
          font: 'Arial',
          bold: true,
          size: 24,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Date: ${dateStr}`,
          font: 'Arial',
          bold: true,
          size: 24,
        }),
      ],
    }),
  ];

  // 1st Table: Summary Matrix Table (20 columns exact)
  const statHeaders = [
    'Unit',
    'Total\nstr',
    'Det/\nTdy',
    'Eff\nstr',
    'Leave',
    'Essn',
    'CMH/ BNS/ BSH',
    'Sick\nReport',
    'Drill\nCat-C',
    'Guard Duty\nOn/Off',
    'Canteen',
    'Bake &\nBite',
    'K/O &\nReception',
    'Guard of\nHonour',
    isPt ? 'Total Out\nPT' : 'Total Out\nParade',
    isPt ? 'On PT' : 'On Parade',
    'Rmk',
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    height: { value: 1440, rule: HeightRule.ATLEAST },
    children: statHeaders.map((h, i) =>
      i === 0 ? createArialUnitHeaderCell(h, 1500) : createArialVerticalHeaderCell(h, 680)
    ),
  });

  const valOrDash = (v: number) => (v > 0 ? String(v) : '-');

  const dataRow = new TableRow({
    children: [
      createArialDataCell('155 UASU BAF', 1500, AlignmentType.CENTER),
      createArialDataCell(String(stats.totalStr), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.detTdyCount), 680, AlignmentType.CENTER),
      createArialDataCell(String(stats.effStr), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.leaveCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.essnCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.hospitalCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.sickExCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.drillCatCCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.guardDutyCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.canteenCount || 0), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.bakeBiteCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.koReceptionCount), 680, AlignmentType.CENTER),
      createArialDataCell(valOrDash(stats.gamesCount), 680, AlignmentType.CENTER),
      createArialDataCell(String(stats.totalOutPt), 680, AlignmentType.CENTER),
      createArialDataCell(String(stats.onPtParadeCount), 680, AlignmentType.CENTER),
      createArialDataCell('-', 680, AlignmentType.CENTER),
    ],
  });

  const matrixTable = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, dataRow],
  });

  docChildren.push(matrixTable);

  // Spacing between 1st & 2nd table: Font size 1 (2 half-points) with 0 margin
  docChildren.push(
    new Paragraph({
      spacing: { before: 0, after: 20, line: 20 },
      children: [
        new TextRun({
          text: '',
          font: 'Arial',
          size: 2, // 1pt font size
        }),
      ],
    })
  );

  // Helper to build a disposal section only if it has personnel
  const buildDisposalSection = (title: string, list: { displayName: string }[], isFirst: boolean = false): Paragraph[] => {
    if (!list || list.length === 0) return [];
    return [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: isFirst ? 0 : 80, after: 30 },
        children: [
          new TextRun({
            text: title,
            font: 'Arial',
            bold: true,
            size: 24,
            underline: {},
          }),
        ],
      }),
      ...list.map((item, idx) =>
        new Paragraph({
          spacing: { after: 15, line: 240 },
          children: [
            new TextRun({
              text: `${idx + 1}. ${item.displayName}`,
              font: 'Arial',
              size: 24,
            }),
          ],
        })
      ),
    ];
  };

  // Format airman names
  const toDisplay = (airmenList: Airman[]) => airmenList.map((a) => ({ displayName: `${formatRunningLetter(a.rank)} ${formatRunningLetter(a.name)}` }));

  // Format Duty Off as: `${rank} ${name} - ${duty} Off`
  const dutyOffDisplay = dutyOff.map((item) => {
    let dutyNote = item.note || 'GD Off';
    if (dutyNote.toLowerCase().includes('imported')) dutyNote = 'GD Off';
    if (!dutyNote.toLowerCase().endsWith('off')) {
      dutyNote = `${dutyNote} Off`;
    }
    return {
      displayName: `${formatRunningLetter(item.airman.rank)} ${formatRunningLetter(item.airman.name)} - ${dutyNote}`,
    };
  });

  const dutyOnDisplay = dutyOn.map((item) => {
    const dutyNote = item.note && !item.note.toLowerCase().includes('imported') ? item.note : 'GD';
    return {
      displayName: `${formatRunningLetter(item.airman.rank)} ${formatRunningLetter(item.airman.name)} - ${dutyNote}`,
    };
  });

  // Col 1: On Parade up to 3 columns (1-15, 16-30, 31-45)
  const onParade1To15 = onParade.slice(0, 15);
  const onParade16To30 = onParade.slice(15, 30);
  const onParade31Plus = onParade.slice(30, 45);

  const col1Children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: isPt ? 'On PT' : 'On Parade',
          font: 'Arial',
          bold: true,
          size: 24,
          underline: {},
        }),
      ],
    }),
  ];

  if (onParade.length === 0) {
    col1Children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Nil', font: 'Arial', bold: true, size: 24 })],
      })
    );
  } else if (onParade.length <= 15) {
    onParade.forEach((a, idx) => {
      col1Children.push(
        new Paragraph({
          spacing: { after: 15, line: 240 },
          children: [
            new TextRun({
              text: `${idx + 1}. ${formatRunningLetter(a.rank)} ${formatRunningLetter(a.name)}`,
              font: 'Arial',
              size: 22,
            }),
          ],
        })
      );
    });
  } else {
    const maxRows = Math.max(onParade1To15.length, onParade16To30.length, onParade31Plus.length);
    const innerRows: TableRow[] = [];
    for (let i = 0; i < maxRows; i++) {
      const col1Item = onParade1To15[i];
      const col2Item = onParade16To30[i];
      const col3Item = onParade31Plus[i];
      
      const col1Text = col1Item ? `${i + 1}. ${formatRunningLetter(col1Item.rank)} ${formatRunningLetter(col1Item.name)}` : '';
      const col2Text = col2Item ? `${16 + i}. ${formatRunningLetter(col2Item.rank)} ${formatRunningLetter(col2Item.name)}` : '';
      const col3Text = col3Item ? `${31 + i}. ${formatRunningLetter(col3Item.rank)} ${formatRunningLetter(col3Item.name)}` : '';

      innerRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 1680, type: WidthType.DXA },
              borders: invisibleBorders,
              margins: { top: 0, bottom: 20, left: 0, right: 0 },
              children: [
                new Paragraph({
                  spacing: { after: 15, line: 240 },
                  children: col1Text ? [new TextRun({ text: col1Text, font: 'Arial', size: 22 })] : [],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1680, type: WidthType.DXA },
              borders: invisibleBorders,
              margins: { top: 0, bottom: 20, left: 0, right: 0 },
              children: [
                new Paragraph({
                  spacing: { after: 15, line: 240 },
                  children: col2Text ? [new TextRun({ text: col2Text, font: 'Arial', size: 22 })] : [],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1680, type: WidthType.DXA },
              borders: invisibleBorders,
              margins: { top: 0, bottom: 20, left: 0, right: 0 },
              children: [
                new Paragraph({
                  spacing: { after: 15, line: 240 },
                  children: col3Text ? [new TextRun({ text: col3Text, font: 'Arial', size: 22 })] : [],
                }),
              ],
            }),
          ],
        })
      );
    }
    const onParadeSubTable = new Table({
    layout: TableLayoutType.AUTOFIT,
      width: { size: 5040, type: WidthType.DXA },
      columnWidths: [1680, 1680, 1680],
      borders: invisibleBorders,
      rows: innerRows,
    });
    col1Children.push(onParadeSubTable);
  }

  const col1 = new TableCell({
    width: { size: 5040, type: WidthType.DXA },
    borders: invisibleBorders,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: col1Children,
  });

  // Col 2 Disposals: LEAVE, BAKE & BITE, ESSN, CMH, SICK REPORT
  const col2Paragraphs: Paragraph[] = [];
  const secCanteen = buildDisposalSection('Canteen', toDisplay(params.canteen || []), col2Paragraphs.length === 0);
  if (secCanteen.length > 0) col2Paragraphs.push(...secCanteen);
  const secLeave = buildDisposalSection('Leave', toDisplay(leave), col2Paragraphs.length === 0);
  if (secLeave.length > 0) col2Paragraphs.push(...secLeave);

  const secBakeBite = buildDisposalSection('Bake & Bite', toDisplay(bakeBite), col2Paragraphs.length === 0);
  if (secBakeBite.length > 0) col2Paragraphs.push(...secBakeBite);

  const secEssn = buildDisposalSection('Essn', toDisplay(essn), col2Paragraphs.length === 0);
  if (secEssn.length > 0) col2Paragraphs.push(...secEssn);

  const secCmh = buildDisposalSection('Cmh / Bns / Bsh', toDisplay(cmh), col2Paragraphs.length === 0);
  if (secCmh.length > 0) col2Paragraphs.push(...secCmh);

  const secSick = buildDisposalSection('Sick Report', toDisplay(sickReport), col2Paragraphs.length === 0);
  if (secSick.length > 0) col2Paragraphs.push(...secSick);

  const col2 = new TableCell({
    width: { size: 3360, type: WidthType.DXA },
    borders: invisibleBorders,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: col2Paragraphs.length > 0 ? col2Paragraphs : [new Paragraph({ children: [] })],
  });

  // Col 3 Disposals: ATT/TDY/DETT, RECEPTION, AIR FD DUTY, ADMIN ORDER, CLASS/TRG, DRILL CAT-C, Other[0]
  const col3Paragraphs: Paragraph[] = [];
  const secTdy = buildDisposalSection('Att/Tdy/Dett', toDisplay(tdy), col3Paragraphs.length === 0);
  if (secTdy.length > 0) col3Paragraphs.push(...secTdy);

  const secReception = buildDisposalSection('Reception / K/O', toDisplay(reception), col3Paragraphs.length === 0);
  if (secReception.length > 0) col3Paragraphs.push(...secReception);

  const secAirFd = buildDisposalSection('Air Fd Duty', toDisplay(airFdDuty), col3Paragraphs.length === 0);
  if (secAirFd.length > 0) col3Paragraphs.push(...secAirFd);

  const secAdmin = buildDisposalSection('Admin Order', toDisplay(adminOrder), col3Paragraphs.length === 0);
  if (secAdmin.length > 0) col3Paragraphs.push(...secAdmin);

  const secClass = buildDisposalSection('Class / Trg', toDisplay(classTrg), col3Paragraphs.length === 0);
  if (secClass.length > 0) col3Paragraphs.push(...secClass);

  const secDrill = buildDisposalSection('Drill Cat-C', toDisplay(drillCatC), col3Paragraphs.length === 0);
  if (secDrill.length > 0) col3Paragraphs.push(...secDrill);

  if (otherDisposals && otherDisposals.length > 0) {
    const secOther0 = buildDisposalSection(formatRunningLetter(otherDisposals[0].title), toDisplay(otherDisposals[0].airmen), col3Paragraphs.length === 0);
    if (secOther0.length > 0) col3Paragraphs.push(...secOther0);
  }

  const col3 = new TableCell({
    width: { size: 3360, type: WidthType.DXA },
    borders: invisibleBorders,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: col3Paragraphs.length > 0 ? col3Paragraphs : [new Paragraph({ children: [] })],
  });

  // Col 4 Disposals: DUTY ON, DUTY OFF, GAMES, ABSENT, Remaining Other Disposals
  const col4Paragraphs: Paragraph[] = [];
  const secDutyOn = buildDisposalSection('Duty On', dutyOnDisplay, col4Paragraphs.length === 0);
  if (secDutyOn.length > 0) col4Paragraphs.push(...secDutyOn);

  if (!isPt) {
    const secDutyOff = buildDisposalSection('Duty Off', dutyOffDisplay, col4Paragraphs.length === 0);
    if (secDutyOff.length > 0) col4Paragraphs.push(...secDutyOff);
  }

  const secGames = buildDisposalSection('Games', toDisplay(games), col4Paragraphs.length === 0);
  if (secGames.length > 0) col4Paragraphs.push(...secGames);

  const secAbsent = buildDisposalSection('Absent', toDisplay(absent), col4Paragraphs.length === 0);
  if (secAbsent.length > 0) col4Paragraphs.push(...secAbsent);

  if (otherDisposals && otherDisposals.length > 1) {
    for (let odIdx = 1; odIdx < otherDisposals.length; odIdx++) {
      const secRem = buildDisposalSection(formatRunningLetter(otherDisposals[odIdx].title), toDisplay(otherDisposals[odIdx].airmen), col4Paragraphs.length === 0);
      if (secRem.length > 0) col4Paragraphs.push(...secRem);
    }
  }

  const col4 = new TableCell({
    width: { size: 3360, type: WidthType.DXA },
    borders: invisibleBorders,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: col4Paragraphs.length > 0 ? col4Paragraphs : [new Paragraph({ children: [] })],
  });

  // Spacer Row between 1st & 2nd rows: height 0.6 inch = 864 DXA
  const spacerRow = new TableRow({
    height: { value: 864, rule: HeightRule.EXACT },
    children: [
      new TableCell({
        columnSpan: 4,
        width: { size: 15120, type: WidthType.DXA },
        borders: invisibleBorders,
        children: [new Paragraph({ children: [] })],
      }),
    ],
  });

  // 2nd Row: 1st Column (Left Officer Sgt Nahid), 2nd & 3rd empty, Last column (Right Officer WO Shahin)
  const leftSigName = params.leftSig?.name || 'MD NAHID HASAN KHAN';
  const leftSigRank = params.leftSig?.rank || 'Sgt';
  const leftSigDesig = params.leftSig?.desig || 'UWO';

  const rightSigName = params.rightSig?.name || 'MAHIM RAAD SADAT';
  const rightSigRank = params.rightSig?.rank || 'FLT LT';
  const rightSigDesig = params.rightSig?.desig || 'Adjutant';

  const signatureRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 5040, type: WidthType.DXA },
        borders: invisibleBorders,
        margins: { top: 120, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 15, line: 240 },
            children: [
              new TextRun({
                text: leftSigName.toUpperCase(),
                font: 'Arial',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 15, line: 240 },
            children: [
              new TextRun({
                text: leftSigRank,
                font: 'Arial',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 15, line: 240 },
            children: [
              new TextRun({
                text: leftSigDesig,
                font: 'Arial',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: '155 UASU BAF',
                font: 'Arial',
                size: 24,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 3360, type: WidthType.DXA },
        borders: invisibleBorders,
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        width: { size: 3360, type: WidthType.DXA },
        borders: invisibleBorders,
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        width: { size: 3360, type: WidthType.DXA },
        borders: invisibleBorders,
        margins: { top: 120, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 15, line: 240 },
            children: [
              new TextRun({
                text: rightSigName.toUpperCase(),
                font: 'Arial',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 15, line: 240 },
            children: [
              new TextRun({
                text: rightSigRank,
                font: 'Arial',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 15, line: 240 },
            children: [
              new TextRun({
                text: rightSigDesig,
                font: 'Arial',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: '155 UASU BAF',
                font: 'Arial',
                size: 24,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const disposalTableRows = [
    new TableRow({
      children: [col1, col2, col3, col4],
    }),
    spacerRow,
    signatureRow,
  ];

  const disposalTable = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 15120, type: WidthType.DXA },
    columnWidths: [5040, 3360, 3360, 3360],
    borders: invisibleBorders,
    rows: disposalTableRows,
  });

  docChildren.push(disposalTable);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: docChildren,
      },
    ],
  });

  const targetFileName =
    fileName || `${isPt ? 'PT State' : 'Parade State'} - Airmen (${dateStr}).docx`;
  const blob = await Packer.toBlob(doc);
  saveAs(blob, targetFileName);
}

// 6. MULTI-DAY PARADE STATE MATRIX EXPORT
export interface MultiParadeDayItem {
  dateDisplay: string;
  dayDisplay: string;
  baseSec: string;
  btf: string;
  ntf: string;
  airfield: string;
  halishahar: string;
  bakeBite: string;
  tdy: string;
  leave: string;
  idaMorning: string;
  idaAfternoon: string;
  idaNight: string;
  dutyOff: string;
  onParade: string;
}

export async function exportParadeStateMultiDocx(
  unitHeader: string,
  dateRangeHeader: string,
  rows: MultiParadeDayItem[],
  fileName: string = 'Multi_Day_Parade_State_155_UASU.docx',
  leftSig?: { rank: string; name: string; desig: string },
  rightSig?: { rank: string; name: string; desig: string }
) {
  const docChildren: any[] = [
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
          text: `(${dateRangeHeader})`,
          font: 'Arial',
          bold: true,
          size: 24,
        }),
      ],
    }),
  ];

  const headerRow1 = new TableRow({
    tableHeader: true,
    children: [
      createArialHeaderCell('Date', 900),
      createArialHeaderCell('Day', 900),
      createArialHeaderCell('Base Security\nDuty', 1100),
      createArialHeaderCell('Base Taskforce\nDuty', 1100),
      createArialHeaderCell('Najirpara\nTF Duty', 1100),
      createArialHeaderCell('Airfield\nDuty', 1000),
      createArialHeaderCell('Halishahar\nDuty', 1000),
      createArialHeaderCell('Bake N\nBite', 900),
      createArialHeaderCell('Tdy', 900),
      createArialHeaderCell('Leave', 900),
      createArialHeaderCell('IDA CENTER Duty', 3300),
      createArialHeaderCell('Duty\nOff', 1100),
      createArialHeaderCell('On\nParade', 1800),
    ],
  });

  const dataRows = rows.map((r) => {
    return new TableRow({
      children: [
        createArialDataCell(r.dateDisplay, 900, AlignmentType.CENTER),
        createArialDataCell(r.dayDisplay, 900, AlignmentType.CENTER),
        createArialDataCell(r.baseSec || '-', 1100, AlignmentType.LEFT),
        createArialDataCell(r.btf || '-', 1100, AlignmentType.LEFT),
        createArialDataCell(r.ntf || '-', 1100, AlignmentType.LEFT),
        createArialDataCell(r.airfield || '-', 1000, AlignmentType.LEFT),
        createArialDataCell(r.halishahar || '-', 1000, AlignmentType.LEFT),
        createArialDataCell(r.bakeBite || '-', 900, AlignmentType.LEFT),
        createArialDataCell(r.tdy || '-', 900, AlignmentType.LEFT),
        createArialDataCell(r.leave || '-', 900, AlignmentType.LEFT),
        createArialDataCell(
          `Morning:\n${r.idaMorning || '-'}\n\nAfternoon:\n${r.idaAfternoon || '-'}\n\nNight:\n${r.idaNight || '-'}`,
          3300,
          AlignmentType.LEFT
        ),
        createArialDataCell(r.dutyOff || '-', 1100, AlignmentType.LEFT),
        createArialDataCell(r.onParade || '-', 1800, AlignmentType.LEFT),
      ],
    });
  });

  const table = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow1, ...dataRows],
  });

  docChildren.push(table);

  // Spacer between table & signature row
  docChildren.push(
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [],
    })
  );

  const lSigName = leftSig?.name || 'MD NAHID HASAN KHAN';
  const lSigRank = leftSig?.rank || 'Sgt';
  const lSigDesig = leftSig?.desig || 'UWO';

  const rSigName = rightSig?.name || 'MAHIM RAAD SADAT';
  const rSigRank = rightSig?.rank || 'FLT LT';
  const rSigDesig = rightSig?.desig || 'Adjutant';

  const sigTable = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: invisibleBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: invisibleBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 15, line: 240 },
                children: [
                  new TextRun({
                    text: lSigName.toUpperCase(),
                    font: 'Arial',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 15, line: 240 },
                children: [
                  new TextRun({
                    text: lSigRank,
                    font: 'Arial',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 15, line: 240 },
                children: [
                  new TextRun({
                    text: lSigDesig,
                    font: 'Arial',
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: '155 UASU BAF',
                    font: 'Arial',
                    size: 24,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: invisibleBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 15, line: 240 },
                children: [
                  new TextRun({
                    text: rSigName.toUpperCase(),
                    font: 'Arial',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 15, line: 240 },
                children: [
                  new TextRun({
                    text: rSigRank,
                    font: 'Arial',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 15, line: 240 },
                children: [
                  new TextRun({
                    text: rSigDesig,
                    font: 'Arial',
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: '155 UASU BAF',
                    font: 'Arial',
                    size: 24,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  docChildren.push(sigTable);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

// 7. MONTHLY DUTY REGISTER MATRIX EXPORT
export async function exportMonthlyDutyRegisterDocx(
  airmen: Airman[],
  assignments: DutyAssignment[],
  year: number,
  month: number,
  flightFilter: string = 'All',
  fileName?: string
) {
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: '2-digit',
  });
  const daysInMonth = new Date(year, month, 0).getDate();

  const filteredAirmen =
    flightFilter === 'All'
      ? airmen
      : airmen.filter((a) => a.flightName === flightFilter);

  const assignmentMap = new Map<string, DutyAssignment>();
  assignments.forEach((ass) => {
    const key = `${ass.airmanId}_${ass.date}`;
    const existing = assignmentMap.get(key);
    if (!existing || (existing.disposalScope || 'ALL') !== 'ALL') {
      assignmentMap.set(key, ass);
    }
  });

  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'MONTHLY DUTY REGISTER : 155 UASU BAF',
          font: 'Arial',
          bold: true,
          size: 26,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Month: ${monthName} • Flight: ${flightFilter}`,
          font: 'Arial',
          bold: true,
          size: 24,
        }),
      ],
    }),
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createArialHeaderCell('Ser', 500),
      createArialHeaderCell('BD No', 1100),
      createArialHeaderCell('Rank', 800),
      createArialHeaderCell('Name', 1800),
      createArialHeaderCell('Flt', 700),
      ...Array.from({ length: daysInMonth }, (_, i) =>
        createArialHeaderCell(String(i + 1), 260)
      ),
    ],
  });

  const dataRows = filteredAirmen.map((a, idx) => {
    return new TableRow({
      children: [
        createArialDataCell(String(idx + 1), 500, AlignmentType.CENTER),
        createArialDataCell(a.bdNo, 1100, AlignmentType.CENTER),
        createArialDataCell(formatRunningLetter(a.rank), 800, AlignmentType.CENTER),
        createArialDataCell(formatRunningLetter(a.name), 1800, AlignmentType.LEFT),
        createArialDataCell(a.flightName.slice(0, 3), 700, AlignmentType.CENTER),
        ...Array.from({ length: daysInMonth }, (_, i) => {
          const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const ass = assignmentMap.get(`${a.id}_${dStr}`);
          let codeDisplay = '-';
          if (ass) {
            if (ass.dutyCode === 'GD') codeDisplay = 'GD';
            else if (ass.dutyCode === 'BTF') codeDisplay = 'BTF';
            else if (ass.dutyCode === 'NTF') codeDisplay = 'NTF';
            else if (ass.dutyCode === 'HALISHAHAR') codeDisplay = 'HALI';
            else if (ass.dutyCode === 'AIRPORT') codeDisplay = 'AIR';
            else if (ass.dutyCode === 'IDAC' || ass.dutyCode === 'IDA') {
              codeDisplay = ass.idaShift === 'Night' ? 'IDAn' : ass.idaShift === 'Afternoon' ? 'IDAa' : 'IDAm';
            } else if (ass.dutyCode === 'LEAVE') codeDisplay = 'L';
            else if (ass.dutyCode === 'TDY') codeDisplay = 'TDY';
            else if (ass.dutyCode === 'BAKE_N_BITE') codeDisplay = 'BB';
            else if (ass.dutyCode === 'DUTY_OFF') codeDisplay = 'OFF';
          }
          return createArialDataCell(codeDisplay, 260, AlignmentType.CENTER);
        }),
      ],
    });
  });

  const table = new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  docChildren.push(table);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: docChildren,
      },
    ],
  });

  const targetName =
    fileName || `Duty_Register_${monthName.replace(/\s+/g, '_')}_${flightFilter}.docx`;
  const blob = await Packer.toBlob(doc);
  saveAs(blob, targetName);
}

// -------------------------------------------------------------
// Cell Formatting Helpers
// -------------------------------------------------------------
function createArialUnitHeaderCell(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 40, right: 40 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            font: 'Arial',
            bold: true,
            size: 24,
          }),
        ],
      }),
    ],
  });
}

function createArialVerticalHeaderCell(text: string, width: number) {
  const cleanText = text.replace(/\n/g, ' ');
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 30, right: 30 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: cleanText,
            font: 'Arial',
            bold: true,
            size: 24, // 12pt
          }),
        ],
      }),
    ],
  });
}

function createArialHeaderCell(text: string, width: number) {
  const lines = text.split('\n');
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'E2E8F0' },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 50, right: 50 },
    children: lines.map(
      (l) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: l,
              font: 'Arial',
              bold: true,
              size: 24, // 12pt
            }),
          ],
        })
    ),
  });
}

function createArialDataCell(
  text: string,
  width: number,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
  bold: boolean = false
) {
  const lines = (text || '').split('\n');
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 50, right: 50 },
    children: lines.map(
      (l) =>
        new Paragraph({
          alignment,
          children: [
            new TextRun({
              text: l,
              font: 'Arial',
              bold: bold,
              size: 24, // 12pt
            }),
          ],
        })
    ),
  });
}

function createHeaderCell(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'E2E8F0' },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            font: 'Arial',
            bold: true,
            size: 24,
          }),
        ],
      }),
    ],
  });
}

function createDataCell(
  text: string,
  width: number,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType]
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text: text || '',
            font: 'Arial',
            size: 24,
          }),
        ],
      }),
    ],
  });
}
