const shekelFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatShekels(amount: number): string {
  return shekelFormatter.format(amount);
}
