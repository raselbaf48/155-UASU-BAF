import re

with open('src/components/UserLoginGate.tsx', 'r') as f:
    content = f.read()

# I will replace the return block for activeTab !== 'Office'
# Specifically the Nt Count and Canteen wrappers and the Back arrow

pattern = r"\{/\* Content Area \*/\}.*?\{/\* Floating Menu Toggle \*/\}"
# Wait, this regex might be tricky. Let's just find the substrings.
idx_content_area = content.find("{/* Content Area */}")
idx_floating_menu = content.find("{/* Floating Menu Toggle */}")

if idx_content_area != -1 and idx_floating_menu != -1:
    new_content = """{/* Content Area */}
      <div className={`w-full ${activeTab !== 'Office' ? 'flex-1 z-10 p-0 m-0' : 'max-w-md relative z-10'}`}>
        
        {activeTab === 'Office' && (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-white text-center mb-16">
"""
    # The part from "Header" to the end of Office form should remain untouched.
    idx_header = content.find("{/* Header */}")
    idx_end_office = content.find("        )}", content.find("</form>", content.find("/* PIN Reset Flow */"))) + 11
    
    office_content = content[idx_header:idx_end_office]
    
    new_content += "            " + office_content.strip() + "\n          </div>\n        )}\n\n"
    
    # Nt Count Full Page
    new_content += """        {activeTab === 'Nt Count' && (
          <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto animate-fadeIn flex flex-col">
            <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center">
              <button 
                onClick={() => setActiveTab('Office')}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 shadow-lg cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Back</span>
              </button>
              <h2 className="ml-4 text-white font-bold tracking-widest text-sm opacity-50">NIGHT COUNT STATE</h2>
            </div>
            <div className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto">
              <NightCountStateView
                role="USER"
                airmen={airmen}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            </div>
          </div>
        )}

        {activeTab === 'Canteen' && (
          <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto animate-fadeIn flex flex-col">
            <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center">
              <button 
                onClick={() => setActiveTab('Office')}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 shadow-lg cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Back</span>
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
              <Coffee className="w-20 h-20 text-slate-700" />
              <h2 className="text-2xl font-black text-white">Canteen Portal</h2>
              <p className="text-slate-500 font-medium">This feature is currently under development.</p>
            </div>
          </div>
        )}
      </div>

      """
    
    content = content[:idx_content_area] + new_content + content[idx_floating_menu:]

with open('src/components/UserLoginGate.tsx', 'w') as f:
    f.write(content)

