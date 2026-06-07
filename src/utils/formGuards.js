export function preventInvalidNumberKeys(event) {
  const invalidKeys = ["e", "E", "+", "-"];

  if (invalidKeys.includes(event.key)) {
    event.preventDefault();
  }
}

export function onlyPositiveNumber(value) {
  if (value === "") return "";

  const normalizedValue = String(value).replace(",", ".");
  const numberValue = Number(normalizedValue);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    return "";
  }

  return normalizedValue;
}

export function capitalizeFirstLetter(value) {
  if (!value) return "";

  const cleanValue = value.trimStart();

  return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}