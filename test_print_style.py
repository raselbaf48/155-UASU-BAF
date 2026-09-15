with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# Let's see if we can find the style tag inside PrintableNightCountModal.tsx
if "<style>" in content:
    print("Style tag found!")
else:
    print("No style tag found.")
