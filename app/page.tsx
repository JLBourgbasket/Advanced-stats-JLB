import { PerformanceApp } from "@/components/performance-app";
import { I18nProvider } from "@/components/i18n-provider";

export default function Home() {
  return <I18nProvider><PerformanceApp /></I18nProvider>;
}
