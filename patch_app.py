import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace("<NominalRoll\\n              initialFlightFilter", "var_replace")
content = content.replace('''          {activeTab === 'biodata-register' && (
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
              onDeleteAirman={handleDeleteAirman}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}''', '''          {activeTab === 'biodata-register' && (
            <NominalRoll
              variant="biodata"
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
              onDeleteAirman={handleDeleteAirman}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}''')

content = content.replace('''        <AddEditAirmanModal
          airmanToEdit={airmanToEdit}
          onSave={handleSaveAirman}
          onClose={() => {
            setIsAddEditOpen(false);
            setAirmanToEdit(null);
          }}
        />''', '''        <AddEditAirmanModal
          variant={activeTab === 'biodata-register' ? 'biodata' : 'nominal'}
          airmanToEdit={airmanToEdit}
          onSave={handleSaveAirman}
          onClose={() => {
            setIsAddEditOpen(false);
            setAirmanToEdit(null);
          }}
        />''')

with open('src/App.tsx', 'w') as f:
    f.write(content)

