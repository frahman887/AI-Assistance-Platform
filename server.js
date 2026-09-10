import app from "./src/app.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🌞 Helio-Sol MVP backend running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   DB check:     http://localhost:${PORT}/health/db\n`);
});