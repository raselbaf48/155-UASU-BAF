const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const handleLogoutFunc = `
  const handleLogout = () => {
    if (currentUser.role === 'manager') {
      setCurrentUser({ name: initialMember ? initialMember.name : 'Guest', role: 'employee', bdNo: initialMember?.bdNo });
      setActiveTab('personal_portal');
    } else {
      onBack();
    }
  };
`;

// Insert the function just before `const handleLogin = async () => {`
code = code.replace(
  /const handleLogin = async \(\) => \{/,
  handleLogoutFunc + '\n  const handleLogin = async () => {'
);

// Replace onClick={onBack} for the two LOGOUT buttons and avatar
code = code.replace(/onClick=\{onBack\}/g, 'onClick={handleLogout}');

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
