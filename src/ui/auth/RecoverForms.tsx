import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { cleanVerifyCode, emailProblem, normalizeEmail, PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { AuthHeading, FormError, FormNotice } from "./AuthFrame";
import { Back, Field, type FormContext, submitHandler } from "./AccountForms";
import { useSubmit } from "./useSubmit";
/** A recovery code as typed: "abcd-efgh-jklm", spaces or none; the server ignores dashes and case. */
const RECOVERY_CODE_MIN = 12;
/**
 * Getting back into an account after losing its email address (android sign-in › Lost access to your email?, server
 * docs/ACCOUNT_RECOVERY.md). Step 1: the account's address, one recovery code (used up by this step) and the new address,
 * which is sent a 6-digit code. Recovery codes restore the account only: setting up this browser afterwards still needs
 * the encryption recovery key or a signed-in phone.
 */
export function RecoverStartForm(props: { ctx: FormContext; initialEmail: string; onStarted: (ticket: string, newEmail: string) => void; onBack: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [email, setEmail] = useState(props.initialEmail);
  const [code, setCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const raw = code.replace(/[\s-]/g, "");
    const problem =
      emailProblem(email) ??
      (raw.length < RECOVERY_CODE_MIN ? uiText("auth.interface.enter_one_of_your_recovery_codes_12_characters_like_abcd_efgh_jkl_da3e878") : null) ??
      emailProblem(newEmail) ??
      (normalizeEmail(newEmail) === normalizeEmail(email) ? uiText("auth.interface.the_new_address_must_be_different_if_you_can_still_read_this_one_4bcddb6") : null);
    if (problem) return setError(problem);
    void run(async () => {
      const r = await props.ctx.accounts.recoverStart(normalizeEmail(email), code.trim(), normalizeEmail(newEmail));
      props.onStarted(r.ticket, r.email);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title={uiText("auth.interface.lost_access_to_your_email_0f4d731")} sub={uiText("auth.interface.use_one_of_the_recovery_codes_you_saved_to_move_your_account_to_a_a42ad6d")} />
      <FormError text={error} />
      <Field id="rc-email" label={uiText("auth.interface.your_account_s_current_email_5d87803")}>
        <input id="rc-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!props.initialEmail} />
      </Field>
      <Field id="rc-code" label={uiText("auth.interface.recovery_code_5bda830")} hint={uiText("auth.interface.each_code_works_once_this_step_uses_it_up_3481839")}>
        <input id="rc-code" className="input code-input" autoComplete="off" spellCheck={false} value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} autoFocus={!!props.initialEmail} />
      </Field>
      <Field id="rc-new" label={uiText("auth.interface.new_email_address_bb0d06f")} hint={uiText("auth.interface.we_ll_send_a_code_there_to_make_sure_it_s_yours_6944e11")}>
        <input id="rc-new" className="input" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? l10n("common.common_checking") : l10n("common.actions.continue")}
      </button>
    </form>
  );
}
/** Step 2: the 6-digit code sent to the new address and a new password. Every session of the account is signed out. */
export function RecoverCompleteForm(props: { ctx: FormContext; ticket: string; newEmail: string; onDone: (email: string, remainingCodes: number) => void; onBack: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const digits = cleanVerifyCode(code);
    const problem = (digits.length === 6 ? null : uiText("auth.verify_enter")) ?? passwordProblem(password, props.newEmail);
    if (problem) return setError(problem);
    void run(async () => {
      const r = await props.ctx.accounts.recoverComplete(props.ticket, digits, password);
      props.onDone(r.email, r.remainingCodes);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} label={uiText("auth.interface.start_again_962e64b")} />
      <AuthHeading title={uiText("auth.interface.confirm_your_new_address_ed5f86b")} />
      <FormNotice text={uiText("auth.interface.we_sent_a_6_digit_code_to_value0_it_s_valid_for_30_minutes_4083236", { value0: props.newEmail })} />
      <FormError text={error} />
      <Field id="rc-email-code" label={uiText("auth.interface.code_from_the_email_5cab1e5")}>
        <input id="rc-email-code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={12} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      <Field
        id="rc-password"
        label={l10n("auth.reset_new_password")}
        hint={uiText("auth.interface.at_least_value0_characters_every_device_of_the_account_signs_out_78e692b", { value0: PASSWORD_MIN_LENGTH })}
      >
        <input id="rc-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? l10n("common.common_saving") : uiText("auth.interface.move_my_account_1fdc374")}
      </button>
    </form>
  );
}
