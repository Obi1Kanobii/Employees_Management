import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Signing you in...
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
