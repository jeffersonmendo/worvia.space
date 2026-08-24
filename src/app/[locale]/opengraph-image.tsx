import { ImageResponse } from "next/og";
import { HomeOpenGraphCard } from "@/components/home-open-graph-card";
import { OPEN_GRAPH_SIZE } from "@/lib/public-metadata";

export const alt = "Worvia";
export const contentType = "image/png";
export const size = OPEN_GRAPH_SIZE;

export default function OpenGraphImage() {
  return new ImageResponse(<HomeOpenGraphCard />, size);
}
