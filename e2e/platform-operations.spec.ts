import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { serverDir } from "../test/support/serverDir";

test("service inbox delivers notices, submits a real warning appeal and redeems Plus time", async ({ page }, info) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `operations.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Operations client");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for local verification");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery key" })).toBeVisible();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const dbPath = path.join(process.env.ORBIT_E2E_DATA!, "griip.sqlite");
  if (!dbPath.includes("orbit-e2e-")) throw new Error("Operations fixtures require a disposable local database");
  const lib = path.join(serverDir(), "node_modules/better-sqlite3/lib/index.js");
  const seeded = JSON.parse(
    execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import {pathToFileURL} from 'node:url';const {default:Database}=await import(pathToFileURL(process.argv[1]).href);const db=new Database(process.argv[2]);const a=db.prepare('SELECT user_id,id FROM accounts WHERE email=?').get(process.argv[3]);if(!a?.user_id)throw Error('missing test identity');const t=Date.now();db.prepare('INSERT INTO platform_notices(id,kind,title,body,target_user_id,status,starts_at,ends_at,version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('notice_web_ops_'+a.user_id,'announcement','Verified service announcement','This notice came from the real canonical platform store.',a.user_id,'published',t-1000,t+86400000,1,'local-test-fixture',t,t);db.prepare('INSERT INTO account_warnings(id,user_id,reason,created_by,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?)').run('warn_web_ops_'+a.user_id,a.user_id,'Please review this warning through the appeal workflow.','local-test-fixture',t,t+86400000,null);db.prepare('INSERT OR IGNORE INTO billing_promotions(code,title,months,max_redemptions,redeemed,enabled,starts_at,ends_at,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('WEBPLUS','Web client promotion',1,2,0,1,t-1000,t+86400000,1,t,t);console.log(JSON.stringify({userId:a.user_id,accountId:a.id}));db.close();`,
        lib,
        dbPath,
        email,
      ],
      { encoding: "utf8" },
    ),
  );
  await page.getByRole("button", { name: /Service inbox/ }).click();
  const inbox = page.getByRole("dialog", { name: "Service inbox", exact: true });
  await expect(inbox.getByRole("heading", { name: "Verified service announcement" })).toBeVisible();
  await inbox.getByRole("button", { name: "Mark read", exact: true }).click();
  await inbox.getByRole("button", { name: "Appeal warning", exact: true }).click();
  await inbox.getByLabel("Context for your appeal").fill("Please independently review this warning with the additional context.");
  await inbox.getByRole("button", { name: "Submit appeal", exact: true }).click();
  await expect(inbox.getByRole("status")).toContainText("Your appeal was submitted");
  await inbox.getByLabel("Promotion code", { exact: true }).fill("WEBPLUS");
  await inbox.getByRole("button", { name: "Redeem code", exact: true }).click();
  await expect(inbox.getByRole("status")).toContainText("Plus promotion redeemed");
  const state = JSON.parse(
    execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import {pathToFileURL} from 'node:url';const {default:Database}=await import(pathToFileURL(process.argv[1]).href);const db=new Database(process.argv[2],{readonly:true});console.log(JSON.stringify({reads:db.prepare('SELECT count(*) n FROM platform_notice_receipts WHERE user_id=?').get(process.argv[3]).n,appeals:db.prepare('SELECT count(*) n FROM platform_appeals WHERE user_id=? AND notice_id=?').get(process.argv[3],'warn_web_ops_'+process.argv[3]).n,grants:db.prepare('SELECT count(*) n FROM billing_grants WHERE account_id=? AND plan_key=?').get(process.argv[4],'plus').n}));db.close();`,
        lib,
        dbPath,
        seeded.userId,
        seeded.accountId,
      ],
      { encoding: "utf8" },
    ),
  );
  expect(state).toEqual({ reads: 1, appeals: 1, grants: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: `/tmp/meldiq-operations-web-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
