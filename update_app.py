import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

old_app = """        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          {activeTab === 'overview' && (
            <div className="animate-fadeIn w-full h-full">"""

new_app = """        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          {activeTab === 'biodata-register' && (
            <div className="animate-fadeIn w-full h-full">
              <NominalRoll
                role={userRole}
                searchQuery={searchQuery}
                onAddAirman={() => setIsAddModalOpen(true)}
                onRequestAdminAccess={() => setIsAdminAuthOpen(true)}
                isSelectionMode={false}
              />
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="animate-fadeIn w-full h-full">"""

content = content.replace(old_app, new_app)

with open('src/App.tsx', 'w') as f:
    f.write(content)

