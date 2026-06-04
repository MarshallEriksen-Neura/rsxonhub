export function maskSecret(secret: string): string {
  const value = secret.trim();

  if (!value) {
    return "未配置";
  }

  if (value.length <= 4) {
    return "••••";
  }

  return `${"•".repeat(Math.min(value.length - 4, 16))}${value.slice(-4)}`;
}

