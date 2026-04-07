import LoginClient from "./LoginClient";

type LoginPageSearchParams = {
  redirect?: string | string[];
  next?: string | string[];
  registered?: string | string[];
  verified?: string | string[];
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginPageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <LoginClient
      initialNextUrl={
        firstParam(resolvedSearchParams.redirect) ?? firstParam(resolvedSearchParams.next)
      }
      registered={firstParam(resolvedSearchParams.registered) === "true"}
      verified={firstParam(resolvedSearchParams.verified) === "true"}
    />
  );
}
