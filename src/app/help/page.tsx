import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { HelpCircle } from "lucide-react";

export default function HelpPage() {
  return (
    <PlaceholderPage
      icon={HelpCircle}
      title="Помощь"
      description="Документация и поддержка"
      bullets={["База знаний", "Видео-инструкции", "Контакты поддержки"]}
    />
  );
}
