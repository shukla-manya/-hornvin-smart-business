/**
 * UPI deep link for QR / "Pay with UPI" (amount optional).
 * @see NPCI UPI URI spec
 */
export function buildUpiPayUri({ vpa, payeeName, amount, transactionNote }) {
  if (!vpa || typeof vpa !== "string") return "";
  const pa = encodeURIComponent(vpa.trim());
  const pn = encodeURIComponent((payeeName || "Payee").trim().slice(0, 50));
  let uri = `upi://pay?pa=${pa}&pn=${pn}&cu=INR`;
  if (amount != null && Number(amount) > 0) {
    uri += `&am=${encodeURIComponent(Number(amount).toFixed(2))}`;
  }
  if (transactionNote) {
    uri += `&tn=${encodeURIComponent(String(transactionNote).slice(0, 80))}`;
  }
  return uri;
}
