// ESLint flat config with security guard rails enforced in CI (`pnpm lint`).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const securityRules = {
  // XSS: no raw HTML injection; React escapes text by default.
  "react/no-danger": "error",
  // DOM XSS / code execution sinks.
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-restricted-properties": [
    "error",
    { object: "document", property: "write", message: "DOM XSS sink." },
    { object: "document", property: "writeln", message: "DOM XSS sink." },
    { property: "innerHTML", message: "Use React rendering / textContent instead (DOM XSS)." },
    { property: "outerHTML", message: "DOM XSS sink." },
    { property: "insertAdjacentHTML", message: "DOM XSS sink." },
    { object: "Math", property: "random", message: "Use node:crypto / crypto.getRandomValues for identifiers and tokens." },
  ],
  // Cryptography: platform libraries only (node:crypto, WebCrypto, pgcrypto, Supabase Auth).
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "crypto-js", message: "Use node:crypto (src/lib/crypto.ts)." },
        { name: "md5", message: "MD5 is not allowed." },
        { name: "sha1", message: "SHA-1 is not allowed." },
        { name: "js-sha1", message: "SHA-1 is not allowed." },
        { name: "bcryptjs", message: "Password hashing is handled by Supabase Auth." },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.property.name=/^create(Hash|Hmac)$/] > Literal[value=/^(md5|sha1|md4|ripemd160)$/i]",
      message: "Weak hash algorithm.",
    },
    {
      selector: "CallExpression[callee.property.name=/^createCipheriv$/] > Literal[value=/(des|rc4|ecb)/i]",
      message: "Weak cipher or mode.",
    },
    {
      selector: "Property[key.name='rejectUnauthorized'][value.value=false]",
      message: "Never disable TLS certificate validation.",
    },
  ],
};

const config = [
  ...nextCoreWebVitals,
  { ignores: [".next/**", "node_modules/**", "skills/**"] },
  { files: ["**/*.{ts,tsx,js,mjs}"], rules: securityRules },
  {
    // SQL random() for simulation amounts lives in SQL; scripts may use node:crypto randomInt.
    files: ["scripts/**"],
    rules: { "no-restricted-properties": "off" },
  },
];

export default config;
