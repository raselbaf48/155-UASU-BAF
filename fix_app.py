import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

bad_app = """          {activeTab === 'biodata-register' && (
            <div className="animate-fadeIn w-full h-full">
              <NominalRoll
                role={userRole}
                searchQuery={searchQuery}
                onAddAirman={() => setIsAddModalOpen(true)}
                onRequestAdminAccess={() => setIsAdminAuthOpen(true)}
                isSelectionMode={false}
              />
            </div>
          )}"""

good_app = """          {activeTab === 'biodata-register' && (
            <NominalRoll
              initialFlightFilter={selectedFlight === "Overall" || selectedFlight === "All" ? "All" : selectedFlight}
              airmen={airmen}
              role={role}
              userFlight={userSession?.flightName}
              onRefresh={fetchAirmen}
              onSyncGoogleSheet={handleSyncGoogleSheet}
              onAddAirman={() => {
                setAirmanToEdit(null);
                setIsAddEditOpen(true);
              }}
              onEditAirman={(a) => {
                setAirmanToEdit(a);
                setIsAddEditOpen(true);
              }}
              onDeleteAirman={(a) => setAirmanToDelete(a)}
            />
          )}"""

content = content.replace(bad_app, good_app)

with open('src/App.tsx', 'w') as f:
    f.write(content)

