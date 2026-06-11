import { getRequestConfig } from "next-intl/server";
import localesConfig from "./locales.json";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !localesConfig.locales.includes(locale)) {
    locale = localesConfig.defaultLocale;
  }

  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (
      await import(`../messages/${localesConfig.defaultLocale}.json`)
    ).default;
  }

  return {
    locale,
    messages,
  };
});
