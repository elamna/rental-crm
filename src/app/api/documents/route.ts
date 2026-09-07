import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { listAllDocuments } from "@/lib/repo";

/** Реестр всех напечатанных документов: по кому, по какой аренде и подписан ли */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("documents.view");
    const params = req.nextUrl.searchParams;
    const status = params.get("status");

    return NextResponse.json(
      listAllDocuments({
        status: status === "signed" || status === "pending" ? status : "all",
        search: params.get("q") ?? undefined,
        from: params.get("from"),
        to: params.get("to"),
      })
    );
  } catch (e) {
    return apiError(e);
  }
}
