import { redirect } from "next/navigation";
import { signInAsTestUser } from "./actions";

type TestLoginPageProps = {
  searchParams?: Promise<{
    redirectTo?: string;
  }>;
};

function isTestLoginEnabled() {
  return process.env.ENABLE_TEST_LOGIN === "true";
}

export default async function TestLoginPage({ searchParams }: TestLoginPageProps) {
  if (!isTestLoginEnabled()) {
    redirect("/login");
  }

  const params = await searchParams;
  const redirectTo = params?.redirectTo?.startsWith("/") ? params.redirectTo : "/bidding/all";

  return (
    <main className="min-h-screen bg-[#171614] px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[520px] flex-col items-center justify-center gap-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 grid-cols-2 gap-1 rounded-xl bg-white p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <span className="rounded-[3px] bg-[#5a5650]" />
            <span className="rounded-[3px] bg-[#5a5650]" />
            <span className="rounded-[3px] bg-[#5a5650]" />
            <span className="rounded-[3px] bg-[#5a5650]" />
          </div>
          <div className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            BuildRight
          </div>
        </div>

        <div className="w-full rounded-[24px] border border-white/10 bg-[#353432] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:px-8 sm:py-8">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Test login
          </h1>
          <p className="mt-2 text-base text-[#c6c0b7] sm:text-lg">
            This page signs in a dedicated automation user for local or staging walkthroughs.
          </p>

          <form action={signInAsTestUser} className="mt-8">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button
              type="submit"
              className="h-14 w-full rounded-2xl bg-[#f5f2ed] px-6 text-lg font-semibold text-[#2c2b29] transition hover:bg-white sm:h-16 sm:text-xl"
            >
              Sign in as test user
            </button>
          </form>

          <p className="mt-6 text-sm text-[#b2aca3] sm:text-base">
            Enable with <code>ENABLE_TEST_LOGIN=true</code> and set server-side test credentials in
            your environment.
          </p>
        </div>
      </div>
    </main>
  );
}
