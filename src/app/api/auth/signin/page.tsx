import { Metadata } from "next";
import SignInForm from "@/components/auth/sign-in-form";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/route";

export const metadata: Metadata = { title: "Sign In" };

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <SignInForm />
      </div>
    </div>
  );
}