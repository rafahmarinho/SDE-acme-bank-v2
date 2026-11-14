export const metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Version 2026-11 · ACME Bank simulation</p>
      <h2>1. What ACME Bank is</h2>
      <p>ACME Bank is a product simulation. Accounts, balances, cards, transfers and statements are simulated. No real money is held or moved, and no real cards are issued.</p>
      <h2>2. Your account</h2>
      <ul>
        <li>Keep your password private. ACME Bank will never ask for it by email or phone.</li>
        <li>You are responsible for activity in your account until you tell us your access was compromised.</li>
        <li>You can block your card at any time from the Cards page.</li>
      </ul>
      <h2>3. Fees</h2>
      <p>Transfers between your own accounts are free. Transfers to beneficiaries cost 0.2% of the amount (minimum $1.50, maximum $25.00). The exact fee is always shown before you confirm.</p>
      <h2>4. Transfers</h2>
      <p>Transfers stay pending until they settle. Pending amounts are already reserved from your balance.</p>
      <h2>5. Closing your account</h2>
      <p>Contact Support to close your account or to withdraw the required consents, which ends the service.</p>
    </article>
  );
}
