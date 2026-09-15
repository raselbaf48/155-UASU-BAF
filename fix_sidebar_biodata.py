import re

with open('src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Add to type SidebarTab if not present
if "'biodata-register'" not in content:
    content = content.replace("  | 'leave-register'", "  | 'biodata-register'\n  | 'leave-register'")

# Insert Biodata UI before Leave Register
biodata_ui = """                    {/* Biodata Register */}
                    <button
                      onClick={() => handleSelectTab('biodata-register')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'biodata-register'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="Biodata Register"
                    >
                      <UserCircle className={`w-4 h-4 shrink-0 ${activeTab === 'biodata-register' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">Biodata Register</span>}
                    </button>

                    {/* Leave Register */}"""

content = content.replace("                    {/* Leave Register */}", biodata_ui)

with open('src/components/Sidebar.tsx', 'w') as f:
    f.write(content)

