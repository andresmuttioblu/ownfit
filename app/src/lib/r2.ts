// Private Cloudflare R2 bucket via its S3 API. Images are never public: pages get short-lived signed URLs.
import { AwsClient } from "aws4fetch";

const SIGNED_URL_TTL_S = 2 * 60 * 60;
const SIGN_WINDOW_MS = 60 * 60 * 1000; // URLs signed within the same hour are identical, so browsers cache them

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET })
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(`R2 is not configured: missing ${missing.join(", ")}.`);
  }
  return {
    client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
    base: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
  };
}

function objectUrl(base: string, key: string): string {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key), { method: "PUT", body: new Uint8Array(body),
    headers: { "content-type": contentType, "content-length": String(body.byteLength) }, // R2 rejects chunked uploads
  });
  if (!res.ok) throw new Error(`R2 upload failed for ${key}: ${res.status} ${await res.text()}`);
}

export async function objectExists(key: string): Promise<boolean> {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key), { method: "HEAD" });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`R2 head failed for ${key}: ${res.status}`);
  return true;
}

export async function deleteObject(key: string): Promise<void> {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed for ${key}: ${res.status}`);
}

export async function signedGetUrl(key: string): Promise<string> {
  const { client, base } = config();
  const url = new URL(objectUrl(base, key));
  url.searchParams.set("X-Amz-Expires", String(SIGNED_URL_TTL_S));
  const windowStart = new Date(Math.floor(Date.now() / SIGN_WINDOW_MS) * SIGN_WINDOW_MS);
  const datetime = windowStart.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const signed = await client.sign(url.toString(), { method: "GET", aws: { signQuery: true, datetime } });
  return signed.url;
}
