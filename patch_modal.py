import re

with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

# Add variant prop
intf_search = '''interface AddEditAirmanModalProps {
  airmanToEdit?: Airman | null;
  onSave: (airman: Omit<Airman, 'id'>) => void;
  onClose: () => void;
}'''
intf_replace = '''interface AddEditAirmanModalProps {
  variant?: 'nominal' | 'biodata';
  airmanToEdit?: Airman | null;
  onSave: (airman: Omit<Airman, 'id'>) => void;
  onClose: () => void;
}'''
content = content.replace(intf_search, intf_replace)

prop_search = '''const AddEditAirmanModal: React.FC<AddEditAirmanModalProps> = ({ airmanToEdit, onSave, onClose }) => {'''
prop_replace = '''const AddEditAirmanModal: React.FC<AddEditAirmanModalProps> = ({ variant = 'nominal', airmanToEdit, onSave, onClose }) => {'''
content = content.replace(prop_search, prop_replace)

# Blood group state
state_search = '''  const [mobileNo, setMobileNo] = useState(airmanToEdit?.mobileNo || '');'''
state_replace = '''  const [mobileNo, setMobileNo] = useState(airmanToEdit?.mobileNo || '');
  const [bloodGroup, setBloodGroup] = useState(airmanToEdit?.bloodGroup || '');'''
content = content.replace(state_search, state_replace)

save_search = '''      mobileNo: mobileNo.trim(),'''
save_replace = '''      mobileNo: mobileNo.trim(),
      bloodGroup: bloodGroup.trim(),'''
content = content.replace(save_search, save_replace)

# UI Title
title_search = '''                {airmanToEdit ? 'Edit Airman Details' : 'Add New Airman to Nominal Roll'}'''
title_replace = '''                {airmanToEdit ? 'Edit Airman Details' : `Add New Airman to ${variant === 'biodata' ? 'Biodata Register' : 'Nominal Roll'}`}'''
content = content.replace(title_search, title_replace)

btn_search = '''              <span>{airmanToEdit ? 'Update Airman' : 'Add to Nominal Roll'}</span>'''
btn_replace = '''              <span>{airmanToEdit ? 'Update Airman' : `Add to ${variant === 'biodata' ? 'Biodata Register' : 'Nominal Roll'}`}</span>'''
content = content.replace(btn_search, btn_replace)

# Address Label
addr_search = '''<span>Living Status & Address</span>'''
addr_replace = '''<span>{variant === 'biodata' ? 'Living Status & Present Address' : 'Living Status & Address'}</span>'''
content = content.replace(addr_search, addr_replace)

# Dt of Posting Label
dt_search = '''Date Joined Unit <span className="text-slate-400 font-normal">(Optional)</span>'''
dt_replace = '''{variant === 'biodata' ? 'Dt of Posting' : 'Date Joined Unit'} <span className="text-slate-400 font-normal">(Optional)</span>'''
content = content.replace(dt_search, dt_replace)

dt_search2 = '''Date Left Unit <span className="text-slate-400 font-normal">(Optional)</span>'''
dt_replace2 = '''{variant === 'biodata' ? 'Dt of Leaving' : 'Date Left Unit'} <span className="text-slate-400 font-normal">(Optional)</span>'''
content = content.replace(dt_search2, dt_replace2)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)

