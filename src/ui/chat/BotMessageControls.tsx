import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { text as t } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import type { BotComponent, BotMessageComponents } from "../../sync/botComponentRules";
import { submitBotComponent } from "../../sync/botComponents";
import { BotTag } from "../components/BotTag";
import { Dialog } from "../components/Overlay";
import { ErrorLine } from "../components/SettingsCard";
import { useAction } from "../workspace/useLoad";

type Target = { channelId: string; messageId: string; botId: string };
type ControlProps = Target & { control: BotComponent; disabled: boolean };

/** Native message controls retain their source message. Inputs stay in this live UI, never account drafts. */
export function BotMessageControls({ controls, ...target }: Target & { controls: BotMessageComponents }) {
  useLocaleRender();
  const supported = useOrbit((state) => state.server?.features.includes("bot-components") ?? false);
  const canPost = useOrbit((state) => state.conversations[target.channelId]?.canPost ?? false);
  const [expired, setExpired] = useState(() => Date.now() >= controls.expiresAt);
  useEffect(() => {
    if (!supported || expired) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, controls.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [supported, expired, controls.expiresAt]);
  if (!supported) return null;
  return (
    <div className="bot-message-controls">
      <small className="faint">{t("workspace.botAccess.inputNotice")}</small>
      {expired && (
        <small className="faint" role="status">
          {t("workspace.interface.expired_424a255")}
        </small>
      )}
      {controls.items.map((control) => {
        const props = { ...target, control, disabled: expired || !canPost || !!control.disabled };
        return control.type === "select" ? (
          <SelectControl key={control.customId} {...props} control={control} />
        ) : control.type === "form" ? (
          <FormControl key={control.customId} {...props} control={control} />
        ) : (
          <ButtonControl key={control.customId} {...props} />
        );
      })}
    </div>
  );
}

function useSubmission(target: Target, control: BotComponent) {
  const engine = useEngine();
  const action = useAction();
  const [sent, setSent] = useState(false);
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const send = async (values: string[] = [], fields: Record<string, string> = {}) => {
    if (action.busy) return false;
    const signature = JSON.stringify({ values, fields });
    if (!retry.current || retry.current.signature !== signature) retry.current = { signature, id: crypto.randomUUID() };
    const interactionId = retry.current.id;
    setSent(false);
    const ok = await action.act(() => submitBotComponent(engine, { ...target, customId: control.customId, interactionId, values, fields }));
    if (ok) {
      retry.current = null;
      setSent(true);
    }
    return ok;
  };
  return { ...action, sent, send };
}
function Result({ error, sent }: { error: string | null; sent: boolean }) {
  useLocaleRender();
  return (
    <>
      <ErrorLine text={error} />
      {sent && <small role="status">{t("messaging.interface.sent_c16bc82")}</small>}
    </>
  );
}
function ButtonControl({ control, disabled, ...target }: ControlProps) {
  const action = useSubmission(target, control);
  return (
    <div className="bot-control">
      <button className="btn btn-secondary" disabled={disabled || action.busy} onClick={() => void action.send()}>
        {control.label}
      </button>
      <Result error={action.error} sent={action.sent} />
    </div>
  );
}
function SelectControl({ control, disabled, ...target }: ControlProps & { control: Extract<BotComponent, { type: "select" }> }) {
  useLocaleRender();
  const action = useSubmission(target, control);
  const [values, setValues] = useState<string[]>([]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!disabled) void action.send(values);
  };
  return (
    <form className="bot-control" onSubmit={submit} aria-label={control.label}>
      <fieldset disabled={disabled || action.busy} className="bot-control-fields">
        <legend>{control.label}</legend>
        {control.maxValues === 1 ? (
          <select className="input" aria-label={control.label} value={values[0] ?? ""} onChange={(event) => setValues(event.currentTarget.value ? [event.currentTarget.value] : [])}>
            <option value="" disabled={control.minValues > 0}>
              {control.label}
            </option>
            {control.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          control.options.map((option) => (
            <label className="perm-row" key={option.value}>
              <span className="grow">{option.label}</span>
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                disabled={!values.includes(option.value) && values.length >= control.maxValues}
                onChange={(event) => {
                  const selected = new Set(values);
                  if (event.currentTarget.checked) selected.add(option.value);
                  else selected.delete(option.value);
                  setValues(control.options.filter((item) => selected.has(item.value)).map((item) => item.value));
                }}
              />
            </label>
          ))
        )}
        <button className="btn btn-secondary" disabled={values.length < control.minValues || values.length > control.maxValues}>
          {t("messaging.send")}
        </button>
      </fieldset>
      <Result error={action.error} sent={action.sent} />
    </form>
  );
}
function FormControl({ control, disabled, ...target }: ControlProps & { control: Extract<BotComponent, { type: "form" }> }) {
  const [open, setOpen] = useState(false);
  const action = useSubmission(target, control);
  return (
    <div className="bot-control">
      <button className="btn btn-secondary" disabled={disabled || action.busy} onClick={() => setOpen(true)}>
        {control.label}
      </button>
      <Result error={open ? null : action.error} sent={action.sent} />
      {open && (
        <ControlForm
          key={control.customId}
          control={control}
          botId={target.botId}
          busy={action.busy}
          disabled={disabled}
          error={action.error}
          onClose={() => setOpen(false)}
          onSubmit={async (fields) => {
            if (await action.send([], fields)) setOpen(false);
          }}
        />
      )}
    </div>
  );
}
function ControlForm({
  control,
  botId,
  busy,
  disabled,
  error,
  onClose,
  onSubmit,
}: {
  control: Extract<BotComponent, { type: "form" }>;
  botId: string;
  busy: boolean;
  disabled: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (fields: Record<string, string>) => Promise<void>;
}) {
  useLocaleRender();
  const formId = useId();
  const name = useOrbit((state) => state.users[botId]?.displayName);
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(control.fields.map((field) => [field.id, ""])));
  const set = (id: string, value: string) => setFields((current) => ({ ...current, [id]: value }));
  return (
    <Dialog
      title={control.label}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.actions.cancel")}
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={disabled || busy}>
            {busy ? t("common.common_sending") : t("messaging.send")}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="dialog-body bot-control-form"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !busy) void onSubmit(fields);
        }}
      >
        <div>
          <strong>{name ?? t("messaging.interface.a_bot_7bcedea")}</strong> <BotTag />
        </div>
        <p className="muted">{t("workspace.botAccess.inputNotice")}</p>
        <fieldset disabled={disabled || busy} className="bot-control-fields">
          {control.fields.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.label}</span>
              {field.style === "paragraph" ? (
                <textarea
                  className="input"
                  value={fields[field.id]}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  required={field.required}
                  onChange={(event) => set(field.id, event.currentTarget.value)}
                />
              ) : (
                <input
                  className="input"
                  type="text"
                  autoComplete="off"
                  value={fields[field.id]}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  required={field.required}
                  onChange={(event) => set(field.id, event.currentTarget.value)}
                />
              )}
            </label>
          ))}
        </fieldset>
        <ErrorLine text={error} />
      </form>
    </Dialog>
  );
}
