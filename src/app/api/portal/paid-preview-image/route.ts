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
        <g transform="translate(8 8) scale(1.5)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">
          <path d="M10 12.057a1.9 1.9 0 0 0 .614.743c1.06.713 2.472.112 3.043-.919.839-1.513-.022-3.368-1.525-4.08-2-.95-4.371.154-5.24 2.086-1.095 2.432.29 5.248 2.71 6.246 2.931 1.208 6.283-.418 7.438-3.255 1.36-3.343-.557-7.134-3.896-8.41-3.855-1.474-8.2.68-9.636 4.422-1.63 4.253.823 9.024 5.082 10.576 4.778 1.74 10.118-.941 11.833-5.59a9.354 9.354 0 0 0 .577-2.813"/>
        </g>
      </svg>
    `);
    const preview = await sharp(source)
      .resize(640, 400, { fit: "cover", withoutEnlargement: true })
      .modulate({ brightness: 0.95 })
      .composite([{ input: watermark, gravity: "southeast" }])
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
