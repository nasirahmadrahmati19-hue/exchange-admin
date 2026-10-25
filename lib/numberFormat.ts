export function addCommas(value: string): string {
  const clean = value.replace(/[^\d.]/g, "");
  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export function removeCommas(value: string): number {
  return Number(String(value).replace(/,/g, "")) || 0;
}
