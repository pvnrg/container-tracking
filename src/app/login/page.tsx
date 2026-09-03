import { ContainerStackIllustration } from "@/components/illustrations/container-stack"

import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-sky-500/15 via-background to-emerald-500/10 p-4">
      <ContainerStackIllustration className="pointer-events-none absolute -bottom-10 -left-16 hidden w-[420px] opacity-60 sm:block lg:w-[520px]" />
      <LoginForm />
    </div>
  )
}
