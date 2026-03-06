export class GatewayAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "GatewayAuthError";
    this.statusCode = statusCode;
  }
}

function parseBearerToken(headers: Headers): string {
  const authorization = headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    throw new GatewayAuthError("Missing Authorization bearer token", 401);
  }
  return token.trim();
}

function getRequiredEnvToken(envName: string): string {
  const token = process.env[envName]?.trim();
  if (!token) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
  return token;
}

export function requireGatewayAccess(headers: Headers): void {
  const expected = getRequiredEnvToken("GATEWAY_SKILL_TOKEN");
  const actual = parseBearerToken(headers);

  if (actual !== expected) {
    throw new GatewayAuthError("Invalid gateway bearer token", 403);
  }
}

export function requireInternalAccess(headers: Headers): void {
  const expected = getRequiredEnvToken("INTERNAL_CONTROL_TOKEN");
  const actual = parseBearerToken(headers);

  if (actual !== expected) {
    throw new GatewayAuthError("Invalid internal control bearer token", 403);
  }
}
