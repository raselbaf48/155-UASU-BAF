import re

with open('src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Add to type SidebarTab
old_type = """  | 'pt-state'
  | 'night-count-state'
  | 'leave-register'"""

new_type = """  | 'pt-state'
  | 'night-count-state'
  | 'biodata-register'
  | 'leave-register'"""

content = content.replace(old_type, new_type)

# Add to Sidebar UI
# Look for Leave Register
leave_register_ui = """                    {/* Leave Register */}
                    <li className="relative group">"""

biodata_ui = """                    {/* Biodata Register */}
                    <li className="relative group">
                      <button
                        onClick={() => handleSelectTab('biodata-register')}
                        className={`w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-300 ease-out group-hover:pl-5
                          ${
                            activeTab === 'biodata-register'
                              ? 'bg-gradient-to-r from-teal-50 to-teal-100/50 dark:from-teal-500/20 dark:to-teal-500/10 text-teal-700 dark:text-teal-300 shadow-sm border border-teal-200/50 dark:border-teal-500/30 font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                          }
                        `}
                        title="Biodata Register"
                      >
                        <div className={`flex items-center justify-center ${collapsed ? 'w-full' : 'w-5'} transition-all duration-300`}>
                          <UserCircle className={`transition-all duration-300 ${activeTab === 'biodata-register' ? 'w-5 h-5 text-teal-600 dark:text-teal-400' : 'w-5 h-5 group-hover:scale-110'}`} />
                        </div>
                        {!collapsed && <span className="ml-3 truncate">Biodata Register</span>}
                      </button>
                    </li>

                    {/* Leave Register */}
                    <li className="relative group">"""

content = content.replace(leave_register_ui, biodata_ui)

# Need to ensure UserCircle is imported
if "UserCircle" not in content:
    content = content.replace("import { ", "import { UserCircle, ")

with open('src/components/Sidebar.tsx', 'w') as f:
    f.write(content)

