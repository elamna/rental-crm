import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Rss } from "lucide-react";

export default function FeedPage() {
  return (
    <PlaceholderPage
      icon={Rss}
      title="Лента"
      description="Действия сотрудников в реальном времени"
      bullets={["Хронология всех действий по арендам и клиентам", "Фильтры по сотруднику и филиалу", "Логи изменений"]}
    />
  );
}
