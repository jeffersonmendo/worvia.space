import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const imageMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "image/webp",
]);

/**
 * Returns only a server-generated derivative. The original asset URL/path is
 * never returned and this route has no branch that can fall back to it.
 */
export async function GET(request: Request) {
  const portalId = new URL(request.url).searchParams.get("portal_id");
  if (!portalId) return new NextResponse(null, { status: 404 });
  const assetId = new URL(request.url).searchParams.get("asset_id");
  const imageIndex = Number.parseInt(
    new URL(request.url).searchParams.get("image_index") ?? "0",
    10,
  );
  if (!Number.isInteger(imageIndex) || imageIndex < 0) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = createAdminClient();
  const [{ data: portal }, { data: assets }] = await Promise.all([
    admin
      .from("portals")
      .select("id")
      .eq("id", portalId)
      .eq("visibility", "paid")
      .maybeSingle(),
    admin
      .from("portal_assets")
      .select("id,file_path,mime_type,position")
      .eq("portal_id", portalId)
      .eq("state", "ready")
      .order("position", { ascending: true })
      .limit(50),
  ]);

  if (!portal) return new NextResponse(null, { status: 404 });
  const images = (assets ?? []).filter(
    (asset) => asset.mime_type && imageMimeTypes.has(asset.mime_type),
  );
  const image = images[imageIndex];
  const selectedImage = assetId
    ? images.find((asset) => asset.id === assetId)
    : image;
  if (!selectedImage) return new NextResponse(null, { status: 404 });

  const { data, error } = await admin.storage
    .from("portal-assets")
    .download(selectedImage.file_path);
  if (error || !data) return new NextResponse(null, { status: 404 });

  try {
    const source = Buffer.from(await data.arrayBuffer());
    const watermark = Buffer.from(`
      <svg width="52" height="52" viewBox="0 0 52 52" opacity="0.7" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="51" height="51" rx="25.5" fill="#000" fill-opacity="0.42" stroke="#fff" stroke-opacity="0.3"/>
        <g transform="translate(8 8) scale(1.5)" fill="#fff" stroke="none">
          <path d="M19 19h-14c-.5 0-.9-.3-1-.8l-2-10c0-.4.1-.8.5-1.1c.4-.2.8-.2 1.1 0l4.1 3.3l3.4-5.1c.4-.6 1.3-.6 1.7 0l3.4 5.1l4.1-3.3c.3-.3.8-.3 1.1 0c.4.2.5.6.5 1.1l-2 10c0 .5-.5.8-1 .8z"/>
        </g>
      </svg>
    `);
    const preview = await sharp(source)
      .resize(640, 400, { fit: "cover", withoutEnlargement: true })
      .modulate({ brightness: 1 })
      .composite([{ input: watermark, gravity: "center" }])
      .jpeg({ quality: 65, progressive: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(preview), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
