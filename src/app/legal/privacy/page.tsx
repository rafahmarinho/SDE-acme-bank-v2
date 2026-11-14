export const metadata = { title: "Privacy Notice" };

export default function Privacy() {
  return (
    <article>
      <h1>Privacy Notice</h1>
      <p className="text-muted-foreground">Version 2026-11 · ACME Bank simulation</p>
      <h2>What we collect and why</h2>
      <ul>
        <li><strong>Name, email, phone and address</strong> - to open and operate your account and to send security notices. Required.</li>
        <li><strong>Transactions</strong> - to keep your ledger, show balances and produce statements. Required.</li>
        <li><strong>Product news by email</strong> - only if you opt in. Optional.</li>
        <li><strong>App usage analytics</strong> - only if you opt in; never your transactions. Optional.</li>
      </ul>
      <p>We do not collect your date of birth or national ID number.</p>
      <h2>Your choices and rights</h2>
      <ul>
        <li>Turn optional consents on or off at any time in Settings. Withdrawing takes effect immediately.</li>
        <li>Correct your personal details at any time in Profile.</li>
        <li>Ask Support to restrict a specific use of your data (for example analytics), and we will record and honour it.</li>
      </ul>
      <h2>Who can see your data</h2>
      <p>Support agents see a limited, masked view needed to help you. Administrators can see more for operations and security. Every access to money, card and personal data is recorded in an audit trail.</p>
      <h2>Demo data</h2>
      <p>All demo customers are fictional. Simulated integrations (card network, payment rails) receive pseudonymous identifiers only.</p>
    </article>
  );
}
