import crypto from "crypto";

export function createOkxHeaders(
  method: string,
  requestPath: string,
  body: string = ""
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  const signature = crypto
    .createHmac("sha256", process.env.OKX_SECRET_KEY || "")
    .update(prehash)
    .digest("base64");

  return {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY || "",
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE || "",
    "OK-ACCESS-PROJECT": process.env.OKX_PROJECT_ID || "",
    "Content-Type": "application/json",
  };
}
