// checkFeatures.js
const fs = require("fs");
const path = require("path");

const featuresDir = path.join(__dirname, "data", "features");      
const files = [
  "antiDelete.json",
  "antiViewOnce.json",
  "autoReact.json",
  "messageCache.json"
];

// Ensure the features directory exists
if (!fs.existsSync(featuresDir)) {
  fs.mkdirSync(featuresDir, { recursive: true });
  console.log("✅ Created missing folder:", featuresDir);
}

// Ensure each required JSON file exists and is valid
files.forEach(file => {
  const filePath = path.join(featuresDir, file);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "{}");
    console.log("✅ Created missing file:", filePath);
  } else {
    try {
      // Validate JSON content
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);
      console.log("✅ Validated file:", filePath);
    } catch (error) {
      // Fix corrupted JSON files
      fs.writeFileSync(filePath, "{}");
      console.log("🔧 Fixed corrupted file:", filePath);
    }
  }
});

console.log("🔍 Feature files check completed!");