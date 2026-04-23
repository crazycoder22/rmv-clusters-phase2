import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

const ACCEPTED_AUDIENCES = [
  "114554164765-h0ppp7e7enlkql9iebmcc0lef89bol74.apps.googleusercontent.com", // iOS
  "114554164765-ailu3r77sc4pl7g30p815kfm46fsis6v.apps.googleusercontent.com", // Web (kept for shared tokens)
];

const MOBILE_JWT_ISSUER = "rmv-clusters-mobile";
const MOBILE_JWT_AUDIENCE = "rmv-clusters-mobile-app";
const MOBILE_JWT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ACCEPTED_AUDIENCES,
  });
  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("Google token missing email");
  }
  return {
    sub: String(payload.sub),
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(raw);
}

export type MobileJwtPayload = {
  sub: string; // resident.id
  email: string;
};

export async function issueMobileJwt(payload: MobileJwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_JWT_TTL_SECONDS}s`)
    .setIssuer(MOBILE_JWT_ISSUER)
    .setAudience(MOBILE_JWT_AUDIENCE)
    .sign(getSecret());
}

export async function verifyMobileJwt(token: string): Promise<MobileJwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: MOBILE_JWT_ISSUER,
    audience: MOBILE_JWT_AUDIENCE,
  });
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Malformed mobile JWT");
  }
  return { sub: payload.sub, email: payload.email };
}
