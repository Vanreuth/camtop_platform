# 🌍 Internationalization (i18n) Setup Guide

This project supports **multi-language** functionality using **next-intl** for Next.js 15.

## 📋 Supported Languages

- 🇺🇸 **English (en)** - Default
- 🇰🇭 **Khmer (kh)** - ភាសាខ្មែរ

## 🏗️ Project Structure

```
src/
├── app/
│   ├── [locale]/              # Locale-based routing
│   │   ├── layout.tsx         # Locale-aware layout
│   │   └── page.tsx          # Home page with translations
│   ├── messages/              # Translation files
│   │   ├── en.json           # English translations
│   │   └── kh.json           # Khmer translations
│   ├── i18n.ts               # i18n configuration
│   └── middleware.ts         # Locale detection middleware
├── components/
│   └── language-switcher.tsx  # Language toggle component
└── lib/
    └── navigation.ts          # Locale-aware navigation utilities
```

## 🚀 How to Use Translations

### 1. In Server Components

```tsx
import { useTranslations } from "next-intl";

export default function MyServerComponent() {
  const t = useTranslations("common");
  
  return (
    <div>
      <h1>{t("welcome")}</h1>
      <p>{t("search")}</p>
    </div>
  );
}
```

### 2. In Client Components

```tsx
"use client";
import { useTranslations } from "next-intl";

export default function MyClientComponent() {
  const t = useTranslations("users");
  
  return (
    <div>
      <h1>{t("title")}</h1>
      <button>{t("addUser")}</button>
    </div>
  );
}
```

### 3. Using Locale-Aware Navigation

```tsx
import { Link } from "@/lib/navigation";

export default function MyComponent() {
  return (
    <div>
      {/* Automatically prefixes with current locale */}
      <Link href="/dashboard">Go to Dashboard</Link>
      <Link href="/users">View Users</Link>
    </div>
  );
}
```

## 🔧 Adding New Translations

### 1. Update English (en.json)

```json
{
  "myNewSection": {
    "title": "My New Section",
    "description": "This is a new section"
  }
}
```

### 2. Update Khmer (kh.json)

```json
{
  "myNewSection": {
    "title": "ផ្នែកថ្មីរបស់ខ្ញុំ",
    "description": "នេះគឺជាផ្នែកថ្មី"
  }
}
```

### 3. Use in Component

```tsx
const t = useTranslations("myNewSection");
return <h1>{t("title")}</h1>;
```

## 🎨 Language Switcher Component

The **LanguageSwitcher** component is already integrated in the topbar:

```tsx
import { LanguageSwitcher } from "@/components/language-switcher";

<LanguageSwitcher />
```

It provides:
- 🌐 Dropdown with language options
- 🔄 Automatic locale switching
- ✓ Visual indicator for current language
- 🎯 Preserves current route when switching

## 📖 Translation Keys Available

### Common (`common`)
- welcome, login, logout, register
- email, password, username, phone
- search, filter, sort, actions
- edit, delete, save, cancel, submit
- loading, success, error, warning
- And more...

### Navigation (`nav`)
- dashboard, users, properties, analytics
- settings, profile, help, messages
- calendar, database, documents, etc.

### Authentication (`auth`)
- signIn, signUp, signOut
- forgotPassword, resetPassword, verifyEmail
- setup2FA, rememberMe, etc.

### Users (`users`)
- title, addUser, editUser, deleteUser
- userDetails, userList
- firstName, lastName, email, phone
- confirmDelete, deleteSuccess, etc.

### Properties (`properties`)
- title, addProperty, editProperty
- propertyCode, propertyName, propertyType
- location, address, province, district
- landArea, buildingArea, valuation
- And more...

### Settings (`settings`)
- title, account, appearance
- notifications, security, apiKeys
- theme, language, timezone

### Errors (`errors`)
- 404, 401, 403, 500, maintenance
- somethingWentWrong, tryAgain

### Validation (`validation`)
- required, invalidEmail
- passwordTooShort, passwordMismatch
- invalidPhone, invalidUsername

## 🔗 URL Structure

All routes are automatically prefixed with the locale:

```
/en/dashboard        → English dashboard
/kh/dashboard        → Khmer dashboard
/en/users           → English users page
/kh/users           → Khmer users page
/en/properties/123   → English property detail
/kh/properties/123   → Khmer property detail
```

## ⚙️ Configuration Files

### next.config.ts
```typescript
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/app/i18n.ts");
export default withNextIntl(nextConfig);
```

### middleware.ts
```typescript
import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["en", "kh"],
  defaultLocale: "en",
  localePrefix: "always",
});
```

### i18n.ts
```typescript
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => ({
  locale,
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

## 🎯 Best Practices

1. **Always use translation keys** instead of hardcoded text
2. **Organize translations by feature** (common, users, properties, etc.)
3. **Keep keys consistent** between English and Khmer files
4. **Use the Link component** from `@/lib/navigation` for locale-aware routing
5. **Test both languages** when adding new features
6. **Keep translations short and clear** for better UI/UX

## 🐛 Troubleshooting

### Issue: "Locale not found" error
**Solution:** Ensure the locale is in the middleware's `locales` array

### Issue: Translation key not working
**Solution:** Check that the key exists in both `en.json` and `kh.json`

### Issue: Wrong language displayed
**Solution:** Clear browser cache and check URL has correct locale prefix

### Issue: Language switcher not working
**Solution:** Verify `LanguageSwitcher` component is imported in topbar

## 📚 Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Khmer Unicode Guide](https://en.wikipedia.org/wiki/Khmer_script)

## 🤝 Contributing Translations

When adding new features:

1. Add English text to `src/app/messages/en.json`
2. Add Khmer translation to `src/app/messages/kh.json`
3. Use the translation key in your component
4. Test both languages
5. Submit PR with both translation files updated

---

**Happy Translating! 🎉**
**សូមអរគុណ! 🙏**
