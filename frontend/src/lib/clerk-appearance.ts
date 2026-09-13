import type { ComponentProps } from "react"
import type { SignIn } from "@clerk/nextjs"

type Appearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>

/**
 * Shared Clerk appearance — Vercel / Linear style.
 * The Clerk card itself is rendered "flush" (transparent, borderless)
 * so our own AuthShell provides the premium outer card.
 *
 * THEMING MODEL (permanent, no reload needed):
 * Every color below resolves through our CSS vars (var(--ink),
 * var(--surface), …) which flip values when `.dark` toggles on <html>.
 * That means light/dark adapts instantly on the client — Clerk's
 * server-chosen base theme only affects first paint.
 * (Requires the matching `--color-*` tokens in globals.css @theme.)
 */
export const authAppearance: Appearance = {
  variables: {
    fontFamily: "var(--font-inter), -apple-system, sans-serif",
    fontSize: "0.875rem",
    borderRadius: "0.625rem",
    colorPrimary: "var(--primary-solid)",
    colorPrimaryForeground: "var(--primary-solid-text)",
    colorBackground: "transparent",
    colorInput: "var(--surface)",
    colorInputForeground: "var(--ink)",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--muted)",
    colorMuted: "var(--surface-secondary)",
    colorBorder: "var(--border)",
    colorNeutral: "var(--ink)",
    colorRing: "var(--ink)",
    colorDanger: "var(--danger)",
    colorSuccess: "var(--success)",
    colorWarning: "var(--warning)",
  },
  elements: {
    // ——— Layout: Clerk card is flush, AuthShell owns the outer card ———
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0",
    card: "w-full bg-transparent shadow-none border-0 p-0 gap-5 rounded-none",
    // AuthShell renders its own title/subtitle.
    header: "gap-1.5 hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    main: "w-full flex flex-col gap-5 p-0",

    // ——— Step headers ("Check your email", "Enter a code", …) ———
    formHeaderTitle: "text-[15px] font-semibold text-ink",
    formHeaderSubtitle: "text-sm text-muted",

    // ——— Social buttons ———
    socialButtons: "flex flex-col gap-2.5",
    socialButtonsBlockButton:
      "h-10 rounded-[8px] border border-border bg-surface text-ink text-sm font-medium hover:bg-surface-secondary hover:border-border-strong transition-all duration-150 [&_span]:font-medium [&_span]:text-ink",
    socialButtonsBlockButtonText: "text-sm font-medium text-ink",
    socialButtonsBlockButtonArrow: "text-muted",
    socialButtonsProviderIcon: "h-4 w-4",
    // "Last used" pill on the most-recent provider.
    lastAuthenticationStrategyBadge:
      "border border-border bg-surface-secondary text-muted text-[11px]",

    // ——— Divider ("or") ———
    dividerRow: "my-1",
    dividerLine: "bg-border",
    dividerText: "text-xs text-faint px-3 normal-case",

    // ——— Form + fields ———
    form: "flex flex-col gap-4",
    formFieldRow: "gap-1.5",
    formFieldLabelRow: "mb-1.5",
    formFieldLabel: "text-[13px] font-medium text-ink",
    formFieldAction:
      "text-[13px] font-medium text-muted hover:text-ink transition-colors no-underline hover:no-underline",
    formFieldInputGroup: "rounded-[8px]",
    formFieldInput:
      "h-10 rounded-[8px] border border-border bg-surface px-3 text-sm text-ink placeholder:text-faint outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20 transition-all duration-150 w-full",
    formFieldInputShowPasswordButton:
      "text-muted hover:text-ink transition-colors",
    // Helper / validation lines under inputs (password hints, errors…).
    // Each has an explicit var-driven color so none go invisible in dark.
    formFieldHintText: "text-xs text-muted",
    formFieldInfoText: "text-xs text-muted",
    formFieldErrorText: "text-xs text-danger",
    formFieldWarningText: "text-xs text-warning",
    formFieldSuccessText: "text-xs text-success",
    phoneInputBox:
      "h-10 rounded-[8px] border border-border bg-surface text-ink",

    // ——— Primary button. Explicit text color is critical: bg is black in
    // light and white in dark — without it the label vanishes in dark. ———
    formButtonRow: "mt-1",
    formButtonPrimary:
      "h-10 rounded-[8px] bg-primary-solid text-primary-solid-text text-sm font-medium normal-case tracking-normal shadow-none hover:bg-primary-solid-hover transition-all duration-150 data-[disabled]:opacity-50 [&_span]:text-primary-solid-text [&_svg]:text-primary-solid-text",
    formButtonPrimary__signIn: "w-full",
    formButtonPrimary__signUp: "w-full",
    formButtonReset: "text-muted hover:text-ink",
    buttonArrowIcon: "text-primary-solid-text",

    // ——— Identity preview ("Continue as …") ———
    identityPreview: "rounded-[8px] border border-border bg-surface-secondary",
    identityPreviewText: "text-sm text-ink",
    identityPreviewEditButton: "text-muted hover:text-ink",

    // ——— OTP / verification code ———
    otpCodeFieldInput:
      "h-11 rounded-[8px] border border-border bg-surface text-ink focus:border-border-strong",
    otpCodeFieldErrorText: "text-xs text-danger",
    otpCodeFieldSuccessText: "text-xs text-success",
    verificationLinkStatusText: "text-sm text-muted",
    formResendCodeLink:
      "text-muted hover:text-ink no-underline hover:no-underline",

    // AuthShell renders its own switcher + trust row, so hide Clerk's
    // built-in footer to avoid duplicated "Sign up / Create account"
    // + "Secured by Clerk / Protected by Clerk" stacking.
    footer: "hidden",
    footerAction: "hidden",
    footerActionText: "hidden",
    footerActionLink: "hidden",
    footerPages: "hidden",
    footerPagesLink: "hidden",
    badge: "hidden",

    // ——— Alternative methods ("Use another method", SSO, …) ———
    alternativeMethodsBlockButton:
      "h-10 rounded-[8px] border border-border bg-surface text-ink text-sm hover:bg-surface-secondary transition-colors [&_span]:text-ink",
    alternativeMethodsBlockButtonText: "text-sm text-ink",
    alternativeMethodsBlockButtonArrow: "text-muted",
    backLink: "text-muted hover:text-ink no-underline hover:no-underline text-sm",

    // ——— Alerts ———
    alert: "rounded-[8px] text-[13px] border border-border bg-surface-secondary",
    alertText: "text-[13px] text-ink",

    // ——— Selects (e.g. country code) incl. dropdown options ———
    selectButton:
      "h-10 rounded-[8px] border border-border bg-surface text-ink text-sm",
    selectOption: "text-sm text-ink",
    selectSearchInput: "text-sm text-ink placeholder:text-faint",

    avatarBox: "h-9 w-9",
    userPreviewMainIdentifier: "text-sm text-ink",
    userPreviewSecondaryIdentifier: "text-[13px] text-muted",
  },
}
