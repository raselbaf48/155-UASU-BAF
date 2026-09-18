const fs = require('fs');
const path = 'src/components/PrintableParadeStateModal.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldStr = `
                {/* SPACER ROW: 0.9 INCH HEIGHT TO PROVIDE AMPLE SIGNATURE HEADROOM */}
                <div className="w-full" style={{ height: '0.9in' }} />

                {/* OFFICIAL SIGNATURE FOOTER */}
`;

const newStr = `
                {fromDate === toDate && (
                  <>
                    {/* SPACER ROW: 0.9 INCH HEIGHT TO PROVIDE AMPLE SIGNATURE HEADROOM */}
                    <div className="w-full" style={{ height: '0.9in' }} />

                    {/* OFFICIAL SIGNATURE FOOTER */}
`;

const oldStr2 = `
                </div>
              </div>

              {/* WATERMARK OR BORDER EXTENSION IF NEEDED */}
`;

const newStr2 = `
                </div>
              </div>
                  </>
                )}

              {/* WATERMARK OR BORDER EXTENSION IF NEEDED */}
`;

if (code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  code = code.replace(oldStr2, newStr2);
  fs.writeFileSync(path, code);
  console.log("Patched PrintableParadeStateModal");
} else {
  console.log("oldStr not found");
}

