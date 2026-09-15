import re

with open('src/components/FlightDutyCalendarModal.tsx', 'r') as f:
    content = f.read()

bad_apply = """                <button 
                  onClick={() => {
                    const val = parseInt((document.getElementById('modalGlobalReqInput') as HTMLInputElement).value, 10);
                    if (isNaN(val)) return;
                    const newData = new Array(31).fill(val);
                    onSave(newData);
                  }}"""

good_apply = """                <button 
                  onClick={() => {
                    const val = parseInt((document.getElementById('modalGlobalReqInput') as HTMLInputElement).value, 10);
                    if (isNaN(val)) return;
                    const newData = new Array(31).fill(val);
                    setData(newData);
                  }}"""

content = content.replace(bad_apply, good_apply)

with open('src/components/FlightDutyCalendarModal.tsx', 'w') as f:
    f.write(content)

