import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { deleteClients } from "@/lib/repo";

/**
 * Массовое удаление клиентов. С `withRentals: true` вместе с клиентом уходят
 * и его аренды — иначе такие клиенты возвращаются в списке пропущенных.
 */
export async function POST(req: NextRequest) {
  try {
    // Массовое удаление доступно только администратору
    const me = await requireAuth("clients.edit");
    if (!me.isAdmin) throw new ApiError(403, "Массовое удаление доступно только администратору");
    const { ids, withRentals } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, "Не выбрано ни одного клиента");
    if (ids.length > 500) throw new ApiError(400, "За раз можно удалить не больше 500 клиентов");
    return NextResponse.json(deleteClients(ids, { withRentals: !!withRentals }));
  } catch (e) {
    return apiError(e);
  }
}
