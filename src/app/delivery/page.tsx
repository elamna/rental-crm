import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Truck } from "lucide-react";

export default function DeliveryPage() {
  return (
    <PlaceholderPage
      icon={Truck}
      title="Доставка"
      description="Маршруты доставки и возврата инструмента"
      bullets={["Список доставок на сегодня", "Статусы: назначена / в пути / доставлена", "Интеграция с картой филиалов"]}
    />
  );
}
