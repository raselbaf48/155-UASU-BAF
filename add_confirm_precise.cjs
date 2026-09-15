const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const target = `  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    
    setDeletingGroup(true);`;

const replacement = `  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    if (!window.confirm('Are you sure you want to completely remove this entry?')) return;
    
    setDeletingGroup(true);`;

content = content.replace(target, replacement);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
