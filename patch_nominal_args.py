with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

content = content.replace(
'''export const NominalRoll: React.FC<NominalRollProps> = ({
  initialFlightFilter = 'All',
  airmen,
  role,''',
'''export const NominalRoll: React.FC<NominalRollProps> = ({
  variant = 'nominal',
  initialFlightFilter = 'All',
  airmen,
  role,'''
)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)

