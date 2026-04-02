import { OAuth2Client } from "google-auth-library";
import { UnauthorizedError } from "../../common/errors/unauthorzed.error";

const googleClient = new OAuth2Client();

const getAllowedAudiences = (): string[] => {
  const list = (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const single = process.env.GOOGLE_CLIENT_ID?.trim();
  const nextPublic = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  const merged = [...list];
  if (single) merged.push(single);
  if (nextPublic) merged.push(nextPublic);

  return Array.from(new Set(merged));
};

export async function verifyGoogleIdToken(idToken: string) {
  const audiences = getAllowedAudiences();
  if (!audiences.length) {
    throw new UnauthorizedError(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID (or GOOGLE_CLIENT_IDS)."
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
  } catch {
    throw new UnauthorizedError(
      "Invalid Google token audience. Ensure GOOGLE_CLIENT_ID matches NEXT_PUBLIC_GOOGLE_CLIENT_ID."
    );
  }
  const payload = ticket.getPayload();

  if (!payload?.sub) throw new UnauthorizedError("Invalid Google token");

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified: payload.email_verified ?? false,
    firstName: payload.given_name ?? "",
    lastName: payload.family_name ?? "",
    picture: payload.picture ?? null,
  };
}
