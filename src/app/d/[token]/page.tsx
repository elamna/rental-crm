import { getRentalDocumentByToken } from "@/lib/repo";
import { DOCUMENT_CSS } from "@/lib/document-styles";

/**
 * Документ глазами клиента.
 *
 * Открывается по ссылке из WhatsApp, без входа в систему: у клиента учётной
 * записи нет и быть не должно. Защищает длинный случайный ключ — подобрать его
 * перебором нельзя, а менеджер может отозвать ссылку, и она перестанет работать.
 *
 * Страница намеренно только показывает: ни правки, ни данных других аренд здесь
 * нет, по ключу отдаётся ровно один документ.
 */
export default async function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = getRentalDocumentByToken(token);

  // Ссылку могли отозвать или прислать с опечаткой. Клиенту нужна понятная
  // фраза и что делать дальше, а не пустая страница «не найдено»
  if (!doc) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#EBEBEB] p-6">
        <div className="max-w-[420px] rounded-[16px] bg-white p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <div className="text-[17px] font-semibold">Ссылка недействительна</div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6E6C63]">
            Документ по этой ссылке больше не открывается: её отозвали или она указана с ошибкой.
            Попросите прокат отправить ссылку заново.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#EBEBEB] py-6">
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_CSS }} />
      <div className="mx-auto max-w-[820px] px-3">
        <div className="mb-3 rounded-[12px] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <div className="text-[15px] font-semibold">{doc.name}</div>
          <div className="text-[13px] text-[#6E6C63]">
            {doc.rentalNumber ? `Аренда № ${doc.rentalNumber}` : "Документ"}
            {doc.clientName ? ` · ${doc.clientName}` : ""}
          </div>
        </div>

        <div
          className="doc-render mx-auto bg-white p-[14mm] shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
          dangerouslySetInnerHTML={{ __html: doc.body }}
        />

        <p className="mx-auto mt-3 max-w-[640px] text-center text-[12.5px] text-[#6E6C63]">
          Документ можно распечатать или сохранить в PDF через меню браузера.
        </p>
      </div>
    </div>
  );
}
