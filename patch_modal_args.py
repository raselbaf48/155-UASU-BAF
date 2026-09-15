with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

content = content.replace(
'''export const AddEditAirmanModal: React.FC<AddEditAirmanModalProps> = ({
  airmanToEdit,
  existingAirmen = [],
  onSave,
  onClose,
}) => {''',
'''export const AddEditAirmanModal: React.FC<AddEditAirmanModalProps> = ({
  variant = 'nominal',
  airmanToEdit,
  existingAirmen = [],
  onSave,
  onClose,
}) => {'''
)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)

