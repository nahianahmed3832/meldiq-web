/**
 * key: [English, Simplified Chinese, Bengali]. {name} placeholders are filled by translate() and kept in every language
 * (test/i18n.test.ts checks every entry). Terms follow Meldiq Android's table (android/i18n/strings.py): 恢复密钥 /
 * রিকভারি কী for the recovery key, 登录 / সাইন ইন for signing in.
 */
export const STRINGS = {
  // ── language ──
  lang_label: ["Language", "语言", "ভাষা"],
  lang_system: ["Same as this browser", "跟随浏览器", "এই ব্রাউজারের মতো"],
  lang_note: [
    "Changes Meldiq's language in this browser. Some screens are still in English while translation continues.",
    "更改此浏览器中 Meldiq 的语言。部分界面仍为英文，翻译仍在进行中。",
    "এই ব্রাউজারে Meldiq-এর ভাষা বদলায়। অনুবাদ চলছে, কিছু স্ক্রিন এখনো ইংরেজিতে।",
  ],

  // ── the signed-out frame ──
  hero_about: ["About Meldiq Web", "关于 Meldiq 网页版", "Meldiq ওয়েব সম্পর্কে"],
  hero_title_1: ["Your people,", "你的人，", "আপনার মানুষেরা,"],
  hero_title_2: ["on every screen.", "在每块屏幕上。", "প্রতিটি স্ক্রিনে।"],
  hero_body: [
    "Meldiq Web is another device of your Meldiq account. Messages stay end-to-end encrypted, and your phone and this computer stay in sync through your Meldiq server.",
    "Meldiq 网页版是你 Meldiq 账户的另一台设备。消息始终端到端加密，你的手机和这台电脑通过你的 Meldiq 服务器保持同步。",
    "Meldiq ওয়েব আপনার Meldiq অ্যাকাউন্টের আরেকটি ডিভাইস। মেসেজ এন্ড-টু-এন্ড এনক্রিপ্টেড থাকে, আর আপনার ফোন ও এই কম্পিউটার আপনার Meldiq সার্ভারের মাধ্যমে মিলে থাকে।",
  ],
  hero_point_encrypted: [
    "Messages are encrypted on your devices. The server only relays ciphertext.",
    "消息在你的设备上加密，服务器只转发密文。",
    "মেসেজ আপনার ডিভাইসেই এনক্রিপ্ট হয়। সার্ভার শুধু এনক্রিপ্ট করা লেখা পৌঁছে দেয়।",
  ],
  hero_point_keys: [
    "Your password signs you in. Your encryption keys leave your devices only locked with your password.",
    "密码用于登录。你的加密密钥只有在用密码锁定后才会离开你的设备。",
    "পাসওয়ার্ড দিয়ে সাইন ইন করেন। আপনার এনক্রিপশন কী শুধু পাসওয়ার্ড দিয়ে লক করা অবস্থায় ডিভাইস ছাড়ে।",
  ],
  hero_point_remove: [
    "Remove this browser from any of your devices at any time; it signs out at once.",
    "你可以随时从任何一台设备上移除此浏览器，它会立即退出登录。",
    "যেকোনো সময় আপনার যেকোনো ডিভাইস থেকে এই ব্রাউজারটি সরাতে পারেন; সঙ্গে সঙ্গে সাইন আউট হয়ে যায়।",
  ],

  // ── common ──
  common_back: ["Back", "返回", "ফিরে যান"],
  common_continue: ["Continue", "继续", "চালিয়ে যান"],
  common_checking: ["Checking…", "正在检查…", "যাচাই হচ্ছে…"],
  common_saving: ["Saving…", "正在保存…", "সংরক্ষণ হচ্ছে…"],
  common_sending: ["Sending…", "正在发送…", "পাঠানো হচ্ছে…"],
  common_email: ["Email", "电子邮箱", "ইমেইল"],
  common_password: ["Password", "密码", "পাসওয়ার্ড"],
  common_your_name: ["Your name", "你的名字", "আপনার নাম"],
  common_code: ["Code", "验证码", "কোড"],
  common_send_new_code: ["Send a new code", "重新发送验证码", "নতুন কোড পাঠান"],
  common_recovery_key: ["Recovery key", "恢复密钥", "রিকভারি কী"],
  common_copy: ["Copy", "复制", "কপি"],
  common_copied: ["Copied", "已复制", "কপি হয়েছে"],
  common_password_min: ["At least {n} characters.", "至少 {n} 个字符。", "অন্তত {n}টি অক্ষর।"],
  common_use_other_account: ["Use a different account", "使用其他账户", "অন্য অ্যাকাউন্ট ব্যবহার করুন"],

  // ── sign in ──
  signin_title: ["Sign in to Meldiq", "登录 Meldiq", "Meldiq-এ সাইন ইন করুন"],
  signin_sub: ["Use the email and password of your Meldiq account.", "使用你 Meldiq 账户的邮箱和密码。", "আপনার Meldiq অ্যাকাউন্টের ইমেইল ও পাসওয়ার্ড দিন।"],
  signin_button: ["Sign in", "登录", "সাইন ইন"],
  signin_busy: ["Signing in…", "正在登录…", "সাইন ইন হচ্ছে…"],
  signin_trouble: ["Having trouble signing in?", "登录遇到问题？", "সাইন ইন করতে সমস্যা হচ্ছে?"],
  signin_create: ["Create an account", "创建账户", "অ্যাকাউন্ট খুলুন"],
  signin_enter_password: ["Enter your password.", "请输入密码。", "আপনার পাসওয়ার্ড দিন।"],
  signin_old_server: [
    "This Meldiq server is older than email accounts. Link this browser with your phone instead.",
    "此 Meldiq 服务器不支持邮箱账户。请改用手机关联此浏览器。",
    "এই Meldiq সার্ভারে ইমেইল অ্যাকাউন্ট নেই। এর বদলে ফোন দিয়ে এই ব্রাউজার লিংক করুন।",
  ],
  help_sub: ["Choose what happened. What you typed stays here if you come back.", "请选择发生了什么。返回时你输入的内容会保留。", "কী হয়েছে বেছে নিন। ফিরে এলে আপনার লেখা থেকে যাবে।"],
  help_forgot: ["I forgot my password", "我忘记了密码", "আমি পাসওয়ার্ড ভুলে গেছি"],
  help_forgot_sub: ["We'll email you a code to set a new one.", "我们会发送验证码到你的邮箱，用来设置新密码。", "নতুন পাসওয়ার্ড দিতে আমরা আপনাকে একটি কোড ইমেইল করব।"],
  help_no_email: ["I can't get into my email", "我无法进入我的邮箱", "আমি ইমেইলে ঢুকতে পারছি না"],
  help_no_email_sub: [
    "Use one of your saved recovery codes to move the account to a new address.",
    "使用你保存的一个恢复码，把账户转到新的邮箱地址。",
    "সংরক্ষিত একটি রিকভারি কোড দিয়ে অ্যাকাউন্টটি নতুন ঠিকানায় সরান।",
  ],
  help_move: ["Move an existing account", "迁移已有账户", "পুরোনো অ্যাকাউন্ট সরান"],
  help_move_sub: [
    "Used Orbit before email sign-in? Use your username and recovery key once.",
    "在支持邮箱登录之前用过 Orbit？只需使用一次用户名和恢复密钥。",
    "ইমেইল সাইন ইনের আগে Orbit ব্যবহার করতেন? একবার ইউজারনেম ও রিকভারি কী দিন।",
  ],
  help_phone: ["Link with your phone instead", "改用手机关联", "এর বদলে ফোন দিয়ে লিংক করুন"],
  help_phone_sub: ["Haven't moved your account yet? Approve this browser from your phone.", "还没有迁移账户？在手机上批准此浏览器。", "এখনো অ্যাকাউন্ট সরাননি? ফোন থেকে এই ব্রাউজার অনুমোদন করুন।"],
  help_back: ["Back to sign in", "返回登录", "সাইন ইনে ফিরে যান"],

  // ── sign up ──
  signup_back: ["Sign in instead", "改为登录", "বরং সাইন ইন করুন"],
  signup_title: ["Create your Meldiq account", "创建你的 Meldiq 账户", "আপনার Meldiq অ্যাকাউন্ট খুলুন"],
  signup_sub: ["We'll email you a code to confirm the address.", "我们会发送验证码到你的邮箱以确认地址。", "ঠিকানা নিশ্চিত করতে আমরা আপনাকে একটি কোড ইমেইল করব।"],
  signup_name_hint: ["Shown to the people you talk to.", "会显示给与你聊天的人。", "আপনি যাদের সঙ্গে কথা বলেন তারা এটি দেখবে।"],
  signup_password_hint: [
    "At least {n} characters. A few unrelated words make a strong one.",
    "至少 {n} 个字符。几个不相关的词组合起来就是强密码。",
    "অন্তত {n}টি অক্ষর। কয়েকটি অসম্পর্কিত শব্দ মিলিয়ে শক্ত পাসওয়ার্ড হয়।",
  ],
  signup_invite: ["Invitation code", "邀请码", "আমন্ত্রণ কোড"],
  signup_invite_hint: ["This server only admits people with an invitation.", "此服务器只接受持有邀请的人。", "এই সার্ভারে শুধু আমন্ত্রণ পাওয়া মানুষ যোগ দিতে পারেন।"],
  signup_invite_missing: ["Enter your invitation code.", "请输入邀请码。", "আপনার আমন্ত্রণ কোড দিন।"],
  signup_button: ["Create account", "创建账户", "অ্যাকাউন্ট খুলুন"],
  signup_busy: ["Creating…", "正在创建…", "খোলা হচ্ছে…"],

  // ── email code ──
  verify_title: ["Check your email", "查收邮件", "আপনার ইমেইল দেখুন"],
  verify_sent: [
    "We sent a 6-digit code to {email}. It's valid for 15 minutes.",
    "我们已向 {email} 发送 6 位验证码，15 分钟内有效。",
    "আমরা {email}-এ ৬ সংখ্যার একটি কোড পাঠিয়েছি। এটি ১৫ মিনিট কাজ করবে।",
  ],
  verify_resent: ["If {email} is waiting for a code, a new one is on its way.", "如果 {email} 正在等待验证码，新的验证码已在路上。", "{email} কোডের অপেক্ষায় থাকলে নতুন একটি কোড পাঠানো হয়েছে।"],
  verify_enter: ["Enter the 6-digit code from the email.", "请输入邮件中的 6 位验证码。", "ইমেইলের ৬ সংখ্যার কোডটি দিন।"],
  verify_button: ["Confirm", "确认", "নিশ্চিত করুন"],

  // ── forgotten password ──
  forgot_title: ["Reset your password", "重置密码", "পাসওয়ার্ড রিসেট করুন"],
  forgot_sub: [
    "We'll email you a code. Resetting signs you out everywhere; your messages and keys stay on your devices.",
    "我们会通过邮件发送验证码。重置后你会在所有设备上退出登录；你的消息和密钥仍保留在你的设备上。",
    "আমরা আপনাকে একটি কোড ইমেইল করব। রিসেট করলে সব জায়গা থেকে সাইন আউট হবেন; আপনার মেসেজ ও কী আপনার ডিভাইসেই থাকবে।",
  ],
  forgot_button: ["Send code", "发送验证码", "কোড পাঠান"],
  reset_title: ["Choose a new password", "设置新密码", "নতুন পাসওয়ার্ড বেছে নিন"],
  reset_sent: [
    "If {email} has a Meldiq account, we sent it a reset code. It's valid for 15 minutes.",
    "如果 {email} 有 Meldiq 账户，我们已向其发送重置码，15 分钟内有效。",
    "{email}-এর Meldiq অ্যাকাউন্ট থাকলে আমরা সেখানে একটি রিসেট কোড পাঠিয়েছি। এটি ১৫ মিনিট কাজ করবে।",
  ],
  reset_code: ["Reset code", "重置码", "রিসেট কোড"],
  reset_enter_code: ["Enter the code from the email.", "请输入邮件中的验证码。", "ইমেইলের কোডটি দিন।"],
  reset_new_password: ["New password", "新密码", "নতুন পাসওয়ার্ড"],
  reset_button: ["Set password", "设置密码", "পাসওয়ার্ড সেট করুন"],
  reset_done: [
    "Your password was changed and every session signed out. Sign in with the new one.",
    "你的密码已更改，所有会话均已退出。请使用新密码登录。",
    "আপনার পাসওয়ার্ড বদলেছে এবং সব সেশন থেকে সাইন আউট হয়েছে। নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন।",
  ],

  // ── setting up this browser ──
  create_title: ["Set up end-to-end encryption", "设置端到端加密", "এন্ড-টু-এন্ড এনক্রিপশন চালু করুন"],
  create_signed_in: ["Signed in as {email}.", "已登录为 {email}。", "{email} হিসেবে সাইন ইন করেছেন।"],
  create_body: [
    "This browser will make your account's encryption keys. They're backed up locked with your password, so a new device needs your password and a code sent to your email. You'll also get a recovery key for when the email can't work, for example after a password reset.",
    "此浏览器将为你的账户生成加密密钥。密钥会用你的密码锁定后备份，所以新设备需要你的密码和发送到你邮箱的验证码。你还会得到一个恢复密钥，以备邮件无法使用时（例如重置密码后）使用。",
    "এই ব্রাউজার আপনার অ্যাকাউন্টের এনক্রিপশন কী তৈরি করবে। কীগুলো আপনার পাসওয়ার্ড দিয়ে লক করে ব্যাকআপ রাখা হয়, তাই নতুন ডিভাইসে আপনার পাসওয়ার্ড ও ইমেইলে পাঠানো কোড লাগবে। ইমেইল কাজ না করলে (যেমন পাসওয়ার্ড রিসেটের পরে) ব্যবহারের জন্য একটি রিকভারি কী-ও পাবেন।",
  ],
  create_button: ["Set up encryption", "设置加密", "এনক্রিপশন চালু করুন"],
  create_busy: ["Making keys…", "正在生成密钥…", "কী তৈরি হচ্ছে…"],
  reveal_title: ["Save your recovery key", "保存你的恢复密钥", "আপনার রিকভারি কী সংরক্ষণ করুন"],
  reveal_sub: [
    "It's shown only now. You'll need it if you can't get into your email, or after a password reset.",
    "它只会显示这一次。如果你无法进入邮箱，或重置密码后，你会需要它。",
    "এটি শুধু এখনই দেখানো হচ্ছে। ইমেইলে ঢুকতে না পারলে বা পাসওয়ার্ড রিসেটের পরে এটি লাগবে।",
  ],
  reveal_save_file: ["Save as a file", "保存为文件", "ফাইল হিসেবে সংরক্ষণ করুন"],
  reveal_warning: [
    "Anyone with this key can read your messages. Keep it private, in a password manager or on paper.",
    "任何拿到此密钥的人都能读取你的消息。请妥善保管，放在密码管理器中或写在纸上。",
    "এই কী যার কাছে থাকবে সে আপনার মেসেজ পড়তে পারবে। এটি গোপন রাখুন, পাসওয়ার্ড ম্যানেজারে বা কাগজে।",
  ],
  reveal_stored: ["I've stored my recovery key somewhere safe.", "我已把恢复密钥保存在安全的地方。", "আমি রিকভারি কী নিরাপদ জায়গায় রেখেছি।"],
  reveal_open: ["Open Meldiq", "打开 Meldiq", "Meldiq খুলুন"],
  setup_title: ["Set up this browser", "设置此浏览器", "এই ব্রাউজার সেট আপ করুন"],
  setup_sub: [
    "Signed in as {email}. To read your messages here, this browser needs your account's keys.",
    "已登录为 {email}。要在这里阅读消息，此浏览器需要你账户的密钥。",
    "{email} হিসেবে সাইন ইন করেছেন। এখানে মেসেজ পড়তে এই ব্রাউজারের আপনার অ্যাকাউন্টের কী লাগবে।",
  ],
  setup_checking: ["Checking for a backup of your keys…", "正在检查你的密钥备份…", "আপনার কী-এর ব্যাকআপ খোঁজা হচ্ছে…"],
  setup_code_sent: ["Enter the 6-digit code we sent to {email}.", "请输入我们发送到 {email} 的 6 位验证码。", "{email}-এ পাঠানো ৬ সংখ্যার কোডটি দিন।"],
  setup_code_sending: ["Sending a code to {email}…", "正在向 {email} 发送验证码…", "{email}-এ কোড পাঠানো হচ্ছে…"],
  setup_code_will_send: ["We'll send a code to {email}.", "我们会向 {email} 发送验证码。", "আমরা {email}-এ একটি কোড পাঠাব।"],
  setup_code_label: ["Verification code", "验证码", "যাচাইকরণ কোড"],
  setup_password_hint: ["Your password opens the backup in this browser.", "你的密码会在此浏览器中打开备份。", "আপনার পাসওয়ার্ড এই ব্রাউজারে ব্যাকআপ খোলে।"],
  setup_unlock: ["Unlock", "解锁", "আনলক করুন"],
  setup_unlocking: ["Unlocking…", "正在解锁…", "আনলক হচ্ছে…"],
  setup_trouble: ["Having trouble?", "遇到问题？", "সমস্যা হচ্ছে?"],
  setup_recovery: ["Account recovery", "账户恢复", "অ্যাকাউন্ট পুনরুদ্ধার"],
  setup_other_ways: [
    "Other ways to unlock: if the email code can't reach you, use one of these.",
    "其他解锁方式：如果收不到邮件验证码，请使用以下方式之一。",
    "আনলক করার অন্য উপায়: ইমেইলের কোড না পেলে এগুলোর একটি ব্যবহার করুন।",
  ],
  setup_no_backup: [
    "There's no key backup for your current password (for example after a password reset), so use your phone or your recovery key.",
    "你当前的密码没有对应的密钥备份（例如重置密码之后），请使用手机或恢复密钥。",
    "আপনার বর্তমান পাসওয়ার্ডের জন্য কোনো কী ব্যাকআপ নেই (যেমন পাসওয়ার্ড রিসেটের পরে), তাই ফোন বা রিকভারি কী ব্যবহার করুন।",
  ],
  setup_check_failed: [
    "Couldn't check whether your keys are backed up. Try again, or use another way below.",
    "无法检查你的密钥是否已备份。请重试，或使用下面的其他方式。",
    "আপনার কী ব্যাকআপ আছে কি না যাচাই করা গেল না। আবার চেষ্টা করুন, বা নিচের অন্য উপায় ব্যবহার করুন।",
  ],
  setup_try_again: ["Try again", "重试", "আবার চেষ্টা করুন"],
  setup_ways: ["How to set up this browser", "如何设置此浏览器", "এই ব্রাউজার কীভাবে সেট আপ করবেন"],
  setup_way_phone: ["Approve from my phone", "在手机上批准", "আমার ফোন থেকে অনুমোদন"],
  setup_way_recovery: ["Use my recovery key", "使用我的恢复密钥", "আমার রিকভারি কী ব্যবহার"],
  setup_back_to_email: ["Back to the email code", "返回邮件验证码", "ইমেইল কোডে ফিরে যান"],
  setup_recovery_hint: [
    "It stays in this browser: only a signature made with it is sent.",
    "它只留在此浏览器中：只会发送用它生成的签名。",
    "এটি এই ব্রাউজারেই থাকে: শুধু এটি দিয়ে তৈরি একটি স্বাক্ষর পাঠানো হয়।",
  ],
  setup_recovery_bad: [
    "That recovery key isn't complete or has a typo. Check it and try again.",
    "此恢复密钥不完整或有错字。请检查后重试。",
    "রিকভারি কী-টি অসম্পূর্ণ বা এতে টাইপো আছে। দেখে আবার চেষ্টা করুন।",
  ],
  setup_button: ["Set up this browser", "设置此浏览器", "এই ব্রাউজার সেট আপ করুন"],
  setup_busy: ["Setting up…", "正在设置…", "সেট আপ হচ্ছে…"],
  phone_step_open: ["On your phone, open Meldiq", "在手机上打开 Meldiq", "আপনার ফোনে Meldiq খুলুন"],
  phone_step_open_sub: ["Go to Settings › Devices and tap Approve new device.", "前往 设置 › 设备，点按“批准新设备”。", "সেটিংস › ডিভাইস-এ গিয়ে নতুন ডিভাইস অনুমোদন চাপুন।"],
  phone_step_code: ["Enter this code", "输入此代码", "এই কোডটি দিন"],
  phone_expired: ["That code expired.", "此代码已过期。", "কোডটির মেয়াদ শেষ।"],
  phone_new_code: ["New code", "新代码", "নতুন কোড"],
  phone_step_check: ["Check the device key, then approve", "核对设备密钥，然后批准", "ডিভাইস কী মিলিয়ে নিন, তারপর অনুমোদন করুন"],
  phone_step_check_sub: [
    "Your phone shows a device key. It must match this one exactly:",
    "你的手机会显示一个设备密钥，它必须与此完全一致：",
    "আপনার ফোনে একটি ডিভাইস কী দেখাবে। এটি হুবহু এটির মতো হতে হবে:",
  ],
  phone_waiting: ["Waiting for your phone to approve…", "正在等待手机批准…", "আপনার ফোনের অনুমোদনের অপেক্ষা…"],
  phone_finishing: ["Approved. Setting up this browser…", "已批准，正在设置此浏览器…", "অনুমোদিত। এই ব্রাউজার সেট আপ হচ্ছে…"],

  // ── sign in again ──
  reauth_title: ["Sign in again", "重新登录", "আবার সাইন ইন করুন"],
  reauth_sub: [
    "Your session on this browser ended. Enter the password for {email} to continue where you left off.",
    "你在此浏览器上的会话已结束。输入 {email} 的密码即可从上次的地方继续。",
    "এই ব্রাউজারে আপনার সেশন শেষ হয়েছে। যেখানে ছিলেন সেখান থেকে চালাতে {email}-এর পাসওয়ার্ড দিন।",
  ],
  reauth_other_email: ["Your account uses a different email now?", "你的账户现在使用其他邮箱？", "আপনার অ্যাকাউন্টে এখন অন্য ইমেইল?"],
  reauth_email_now: ["Your account's email now", "你账户现在的邮箱", "আপনার অ্যাকাউন্টের বর্তমান ইমেইল"],
  reauth_sign_out: ["Sign out and erase this browser", "退出并清除此浏览器", "সাইন আউট করে এই ব্রাউজার মুছুন"],

  // ── first-run introduction ──
  intro_label: ["Introduction to Meldiq", "Meldiq 简介", "Meldiq পরিচিতি"],
  intro_skip: ["Skip", "跳过", "এড়িয়ে যান"],
  intro_next: ["Next", "下一步", "পরবর্তী"],
  intro_start: ["Get started", "开始使用", "শুরু করুন"],
  intro_page: ["Page {n} of {total}", "第 {n} 页，共 {total} 页", "{total}টির মধ্যে {n} নম্বর পাতা"],
  intro_1_title: ["Talk in one place", "在一个地方交流", "এক জায়গায় কথা বলুন"],
  intro_1_body: [
    "Channels, groups and direct messages with threads, polls and files. Everything is end-to-end encrypted on your devices.",
    "频道、群组和私信，支持话题串、投票和文件。一切都在你的设备上端到端加密。",
    "থ্রেড, পোল ও ফাইলসহ চ্যানেল, গ্রুপ আর সরাসরি মেসেজ। সবকিছু আপনার ডিভাইসে এন্ড-টু-এন্ড এনক্রিপ্টেড।",
  ],
  intro_2_title: ["Never lose track", "不再遗漏", "কিছুই হারাবে না"],
  intro_2_body: [
    "Save messages for later and set reminders. They reach every device you're signed in on, even after a restart.",
    "保存消息稍后查看并设置提醒。它们会同步到你登录的每台设备，重启后也不会丢失。",
    "মেসেজ পরে দেখার জন্য রাখুন আর রিমাইন্ডার দিন। আপনার সাইন ইন করা সব ডিভাইসে পৌঁছায়, রিস্টার্টের পরেও।",
  ],
  intro_3_title: ["Talk it through", "畅所欲言", "কথা বলে মিটিয়ে নিন"],
  intro_3_body: [
    "Voice and video calls with screen sharing, and voice channels anyone can drop into any time.",
    "支持屏幕共享的语音和视频通话，以及任何人随时可以加入的语音频道。",
    "স্ক্রিন শেয়ারসহ ভয়েস ও ভিডিও কল, আর যেকোনো সময় যে কেউ ঢুকতে পারে এমন ভয়েস চ্যানেল।",
  ],
  intro_4_title: ["Find your communities", "找到你的社区", "আপনার কমিউনিটি খুঁজুন"],
  intro_4_body: [
    "Join public communities or start your own, with channels in categories, forums for organised topics and announcements.",
    "加入公开社区或创建自己的社区，频道按分类整理，还有用于整理话题的论坛和公告。",
    "পাবলিক কমিউনিটিতে যোগ দিন বা নিজেরটা শুরু করুন: ক্যাটাগরিতে সাজানো চ্যানেল, গোছানো আলোচনার ফোরাম আর ঘোষণা।",
  ],
  intro_5_title: ["Roles you control", "由你掌控的角色", "আপনার নিয়ন্ত্রণে রোল"],
  intro_5_body: [
    "Give people roles, decide who sees and posts in each channel, and keep the community safe with bans.",
    "为成员分配角色，决定谁能查看和发言于每个频道，并通过封禁维护社区安全。",
    "মানুষকে রোল দিন, কোন চ্যানেলে কে দেখবে ও লিখবে ঠিক করুন, আর ব্যান দিয়ে কমিউনিটি নিরাপদ রাখুন।",
  ],

  // ── navigation ──
  nav_home: ["Home", "主页", "হোম"],
  nav_dms: ["DMs", "私信", "মেসেজ"],
  nav_activity: ["Activity", "动态", "অ্যাক্টিভিটি"],
  nav_later: ["Later", "稍后", "পরে"],
  nav_settings: ["Settings", "设置", "সেটিংস"],
  nav_unread: ["{n} unread", "{n} 条未读", "{n}টি অপঠিত"],
  side_direct_messages: ["Direct messages", "私信", "সরাসরি মেসেজ"],
  side_unreads: ["Unreads", "未读", "অপঠিত"],
  side_unreads_only: ["Showing unreads only", "仅显示未读", "শুধু অপঠিত দেখাচ্ছে"],
  side_mentions: ["Mentions", "提及", "মেনশন"],
  side_new_message: ["New message", "新消息", "নতুন মেসেজ"],
  side_connections: ["Connections", "联系人", "কানেকশন"],
  side_connection_requests: ["Connection requests", "联系人请求", "কানেকশন অনুরোধ"],
  side_message_requests: ["Message requests · {n} waiting", "消息请求 · {n} 条待处理", "মেসেজ অনুরোধ · {n}টি অপেক্ষায়"],
  search_placeholder: ["Search conversations, people and messages", "搜索会话、联系人和消息", "কথোপকথন, মানুষ ও মেসেজ খুঁজুন"],
  composer_message: ["Message {name}", "发消息给 {name}", "{name}-কে মেসেজ"],
  composer_thread: ["Reply in thread…", "在话题串中回复…", "থ্রেডে উত্তর দিন…"],

  // ── new release ──
  update_ready: ["A new version of Meldiq is ready.", "Meldiq 新版本已就绪。", "Meldiq-এর নতুন সংস্করণ তৈরি।"],
  update_reload: ["Reload", "重新加载", "রিলোড করুন"],

  // ── settings menu ──
  settings_title: ["Settings", "设置", "সেটিংস"],
  settings_profile: ["Profile", "个人资料", "প্রোফাইল"],
  settings_account: ["Account", "账户", "অ্যাকাউন্ট"],
  settings_devices: ["Devices", "设备", "ডিভাইস"],
  settings_notifications: ["Notifications", "通知", "নোটিফিকেশন"],
  settings_calls: ["Calls", "通话", "কল"],
  settings_appearance: ["Appearance", "外观", "চেহারা"],
  settings_storage: ["Storage", "存储", "স্টোরেজ"],
  settings_security: ["Privacy & security", "隐私与安全", "গোপনীয়তা ও নিরাপত্তা"],
  settings_about: ["About", "关于", "সম্পর্কে"],
} as const satisfies Record<string, readonly [string, string, string]>;

export type StringKey = keyof typeof STRINGS;
