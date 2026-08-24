import { IconSpiral } from "@tabler/icons-react";

export function HomeOpenGraphCard() {
  return (
    <div
      aria-label="Worvia"
      role="img"
      style={{
        alignItems: "center",
        backgroundColor: "#050507",
        backgroundImage:
          "radial-gradient(ellipse at 50% 50%, rgba(192,132,252,0.58) 0%, rgba(126,34,206,0.36) 26%, rgba(76,29,149,0.16) 48%, rgba(5,5,7,0) 74%)",
        color: "#ffffff",
        display: "flex",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 24,
        }}
      >
        <IconSpiral
          aria-hidden="true"
          color="currentColor"
          size={76}
          stroke={1.45}
        />
        <span style={{ fontSize: 54, fontWeight: 650, letterSpacing: -2.5 }}>
          Worvia
        </span>
      </div>
    </div>
  );
}
