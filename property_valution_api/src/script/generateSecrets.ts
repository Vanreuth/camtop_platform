import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Generate a cryptographically secure random string
 * @param length - Length of the secret (default: 64)
 * @returns Base64 encoded random string
 */
function generateSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString("base64");
}

/**
 * Generate a hex-encoded random string
 * @param length - Length in bytes (default: 32)
 * @returns Hex encoded random string
 */
function generateHexSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Main function to generate and display secrets
 */
function main() {
  console.log("\n🔐 Generating Secure JWT Secrets...\n");
  console.log("=" .repeat(70));

  // Generate secrets
  const jwtSecret = generateSecret(64);
  const jwtRefreshSecret = generateSecret(64);
  const jwtSecretHex = generateHexSecret(32);
  const jwtRefreshSecretHex = generateHexSecret(32);

  console.log("\n📋 Base64 Encoded (Recommended):\n");
  console.log("JWT_SECRET=" + jwtSecret);
  console.log("JWT_REFRESH_SECRET=" + jwtRefreshSecret);

  console.log("\n📋 Hex Encoded (Alternative):\n");
  console.log("JWT_SECRET=" + jwtSecretHex);
  console.log("JWT_REFRESH_SECRET=" + jwtRefreshSecretHex);

  console.log("\n" + "=".repeat(70));

  // Ask if user wants to save to .env file
  console.log("\n💡 Tips:");
  console.log("   1. Copy the secrets above to your .env file");
  console.log("   2. Never commit these secrets to version control");
  console.log("   3. Use different secrets for dev/staging/production");
  console.log("   4. Rotate secrets periodically for security");

  // Optionally write to a file
  const outputPath = path.join(process.cwd(), "secrets.txt");
  const content = `
# Generated JWT Secrets - ${new Date().toISOString()}
# IMPORTANT: Never commit this file to version control!

# Base64 Encoded (Recommended)
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}

# Hex Encoded (Alternative)
# JWT_SECRET=${jwtSecretHex}
# JWT_REFRESH_SECRET=${jwtRefreshSecretHex}

# Additional secure secrets (if needed)
ENCRYPTION_KEY=${generateHexSecret(32)}
SESSION_SECRET=${generateSecret(48)}
`;

  try {
    fs.writeFileSync(outputPath, content.trim());
    console.log(`\n✅ Secrets also saved to: ${outputPath}`);
    console.log("   ⚠️  Remember to delete this file after copying to .env!\n");
  } catch (error) {
    console.log("\n⚠️  Could not save to file, but secrets are displayed above.\n");
  }
}

// Run the script
main();
