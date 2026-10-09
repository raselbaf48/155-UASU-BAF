export const handleSafePrint = () => {
  try {
    setTimeout(() => {
      window.print();
    }, 100);
  } catch (err) {
    console.warn('Printing not available:', err);
  }
};
