import {
  IconCalendar,
  IconDatabaseFilled,
  IconFiles,
  IconPaletteOff,
  IconPhotoFilled,
  IconSpiral,
} from "@tabler/icons-react";

type OpenGraphCardProps = {
  badge: string;
  colors: string[];
  colorCount: number;
  description: string;
  fileTypes: string[];
  imageCount: number;
  isPremium: boolean;
  labels: {
    colors: string;
    files: string;
    images: string;
    lastUpdated: string;
    totalSize: string;
  };
  title: string;
  totalBytes: number;
  totalFiles: number;
  updatedAt: string;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
};

const truncateDescription = (value: string, maxLength = 120) => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  const truncated = normalized.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${truncated}…`;
};

const truncateTitle = (value: string, maxLength = 32) => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  const truncated = normalized.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${truncated}…`;
};

function OpenGraphFileBadge({ type }: { type: string }) {
  const background =
    type === "psd" ? "#001e36" : type === "pdf" ? "#ff2116" : "#330000";
  const foreground =
    type === "pdf" ? "#ffffff" : type === "psd" ? "#31a8ff" : "#ff9a00";
  return (
    <span
      style={{
        alignItems: "center",
        background,
        borderRadius: 10,
        color: foreground,
        display: "flex",
        fontSize: type === "eps" ? 13 : type === "pdf" ? 15 : 23,
        fontWeight: 700,
        height: 50,
        justifyContent: "center",
        width: 50,
      }}
    >
      {type.toUpperCase()}
    </span>
  );
}

export function OpenGraphCard({
  badge,
  colors,
  colorCount,
  labels,
  fileTypes,
  imageCount,
  isPremium,
  totalBytes,
  totalFiles,
  updatedAt,
  description,
  title,
}: OpenGraphCardProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e4e4e7",
        color: "#09090b",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "52px 64px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          height: 62,
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: "#09090b",
            display: "flex",
            height: 62,
            justifyContent: "center",
            width: 62,
          }}
        >
          <IconSpiral color="#09090b" size={48} stroke={1.7} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex" }}>
          <span
            style={{
              background: isPremium ? "#facc15" : "#bbf7d0",
              borderRadius: 999,
              color: isPremium ? "#713f12" : "#166534",
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              gap: 8,
              padding: "9px 18px",
            }}
          >
            {badge}
          </span>
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: -3.6,
            lineHeight: 1.02,
            maxWidth: 1060,
            whiteSpace: "nowrap",
          }}
        >
          {truncateTitle(title)}
        </div>
        <div
          style={{
            color: "#52525b",
            fontSize: 29,
            lineHeight: 1.35,
            maxWidth: 1020,
          }}
        >
          {truncateDescription(description)}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            marginTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              width: "44%",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
              {fileTypes.length === 0 ? (
                <IconFiles color="#71717a" size={32} />
              ) : null}
              {fileTypes.slice(0, 4).map((type) => (
                <span
                  key={type}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    height: 50,
                    justifyContent: "center",
                    width: 50,
                  }}
                >
                  <OpenGraphFileBadge type={type} />
                </span>
              ))}
              <span style={{ color: "#71717a", fontSize: 25 }}>
                + {Math.max(totalFiles - fileTypes.length, 0)} {labels.files}
              </span>
            </div>
            <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
              {colors.length === 0 ? (
                <IconPaletteOff color="#71717a" size={32} />
              ) : null}
              {colors.slice(0, 4).map((color) => (
                <span
                  key={color}
                  style={{
                    background: color,
                    border:
                      color.toLowerCase() === "#ffffff"
                        ? "1px solid #d4d4d8"
                        : "none",
                    borderRadius: 10,
                    height: 50,
                    width: 50,
                  }}
                />
              ))}
              <span style={{ color: "#71717a", fontSize: 25 }}>
                + {colorCount} {labels.colors}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              width: "44%",
            }}
          >
            <div
              style={{
                alignItems: "center",
                color: "#52525b",
                display: "flex",
                fontSize: 25,
                gap: 18,
              }}
            >
              <IconPhotoFilled color="#71717a" size={32} />
              <span>
                {labels.images} · {imageCount}
              </span>
            </div>
            <div
              style={{
                alignItems: "center",
                color: "#52525b",
                display: "flex",
                fontSize: 25,
                gap: 18,
              }}
            >
              <IconDatabaseFilled color="#71717a" size={32} />
              <span>
                {labels.totalSize} · {formatBytes(totalBytes)}
              </span>
            </div>
            <div
              style={{
                alignItems: "center",
                color: "#52525b",
                display: "flex",
                fontSize: 25,
                gap: 18,
              }}
            >
              <IconCalendar color="#71717a" size={32} />
              <span>
                {labels.lastUpdated} · {formatDate(updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
