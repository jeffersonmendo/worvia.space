"use client";

import { IconColorPicker } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { parseColor } from "react-aria-components";
import { Button } from "@/components/ui/button";
import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorThumb,
  SliderTrack,
} from "@/components/ui/color";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ColorFormat =
  | "hex"
  | "hexa"
  | "hsb"
  | "hsba"
  | "hsl"
  | "hsla"
  | "rgb"
  | "rgba";

const colorSwatches = ["#F00", "#F90", "#0F0", "#08F", "#00F"];

export function normalizeHexInput(value: string, maxLength = 8) {
  return value
    .replace(/[^0-9a-f]/gi, "")
    .slice(0, maxLength)
    .toUpperCase();
}

function clampNumber(value: string, min: number, max: number) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return "";
  const number = Number(normalized);
  if (Number.isNaN(number)) return "";
  return String(Math.min(max, Math.max(min, number)));
}

function rgbToHex(value: string) {
  const parts = (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3);
  const rgb = [0, 1, 2].map((index) => clampNumber(parts[index] ?? "", 0, 255));
  if (rgb.some((part) => part === "")) return "#FF0000";
  return `#${rgb
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function formatPickerColor(value: string, format: ColorFormat) {
  try {
    return parseColor(value).toString(format);
  } catch {
    return parseColor("#FF0000").toString(format);
  }
}

/** Produces a safe display value without changing the persisted source value. */
export function visualColorPickerValue(value: string) {
  const color = value.trim();
  if (color.toLowerCase() === "transparent") return "#00000000";
  try {
    parseColor(color);
    return color;
  } catch {
    return color.toLowerCase().startsWith("rgb") ? rgbToHex(color) : "#FF0000";
  }
}

export function VisualColorPicker({
  allowTransparency = false,
  format,
  onChange,
  onTransparencyChange,
  overlayContainer,
  paletteColors = [],
  targetPrefix,
  transparent = false,
  value,
}: {
  allowTransparency?: boolean;
  format: ColorFormat;
  onChange: (value: string) => void;
  onTransparencyChange?: (transparent: boolean) => void;
  overlayContainer?: HTMLElement | null;
  paletteColors?: string[];
  targetPrefix?: string;
  transparent?: boolean;
  value: string;
}) {
  const t = useTranslations("PortalEditor.colors");
  const hexInputId = useId();
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);
  const [hexDraft, setHexDraft] = useState(() =>
    normalizeHexInput(formatPickerColor(value, "hex"), 6),
  );
  const quickColors = paletteColors.length ? paletteColors : colorSwatches;

  useEffect(() => {
    setEyeDropperSupported("EyeDropper" in window);
  }, []);

  useEffect(() => {
    setHexDraft(normalizeHexInput(formatPickerColor(value, "hex"), 6));
  }, [value]);

  function commitHexDraft() {
    const normalized = normalizeHexInput(hexDraft, 6);
    const complete =
      normalized.length === 3
        ? normalized
            .split("")
            .map((character) => `${character}${character}`)
            .join("")
        : normalized;
    if (complete.length === 6) {
      onChange(`#${complete}`);
      return;
    }
    setHexDraft(normalizeHexInput(formatPickerColor(value, "hex"), 6));
  }

  async function pickFromScreen() {
    const EyeDropperConstructor = (
      window as Window & {
        EyeDropper?: new () => {
          open: () => Promise<{ sRGBHex: string }>;
        };
      }
    ).EyeDropper;
    if (!EyeDropperConstructor) return;

    try {
      const eyeDropper = new EyeDropperConstructor();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Screen color selection failed", error);
      }
    }
  }

  return (
    <ColorPicker
      value={visualColorPickerValue(value)}
      onChange={(color) => onChange(color.toString(format))}
    >
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                demo-id={targetPrefix ? `${targetPrefix}-picker` : undefined}
                data-portal-demo-target={
                  targetPrefix ? `${targetPrefix}-picker` : undefined
                }
                className="flex-1 justify-start rounded-md"
                type="button"
                variant="outline"
              />
            }
          >
            <ColorSwatch className="size-4 rounded-sm border" />
            {t("choose")}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-auto"
            collisionBoundary={overlayContainer ?? undefined}
            portalContainer={overlayContainer}
            positionMethod={overlayContainer ? "absolute" : "fixed"}
            side="bottom"
          >
            <div className="flex flex-col gap-4 outline-none">
              <div>
                <ColorArea
                  className="h-[164px] rounded-b-none border-b-0"
                  colorSpace="hsb"
                  xChannel="saturation"
                  yChannel="brightness"
                >
                  <ColorThumb className="z-50" />
                </ColorArea>
                <ColorSlider colorSpace="hsb" channel="hue">
                  <SliderTrack className="rounded-t-none border-t-0">
                    <ColorThumb className="top-1/2" />
                  </SliderTrack>
                </ColorSlider>
              </div>

              <ColorSwatchPicker className="w-[192px]">
                {quickColors.map((swatch) => (
                  <ColorSwatchPickerItem
                    color={swatch}
                    demo-id={
                      targetPrefix && swatch.toLowerCase() === "#000000"
                        ? `${targetPrefix}-black`
                        : undefined
                    }
                    data-portal-demo-target={
                      targetPrefix && swatch.toLowerCase() === "#000000"
                        ? `${targetPrefix}-black`
                        : undefined
                    }
                    key={swatch}
                  >
                    <ColorSwatch />
                  </ColorSwatchPickerItem>
                ))}
              </ColorSwatchPicker>
              <Field>
                <FieldLabel htmlFor={hexInputId}>{t("hexCode")}</FieldLabel>
                <div className="flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="px-2.5 text-muted-foreground text-sm">
                    #
                  </span>
                  <Input
                    className="border-none px-0 shadow-none focus-visible:ring-0"
                    id={hexInputId}
                    maxLength={6}
                    onBlur={commitHexDraft}
                    onChange={(event) => {
                      const next = normalizeHexInput(
                        event.currentTarget.value,
                        6,
                      );
                      setHexDraft(next);
                      if (next.length === 6) onChange(`#${next}`);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      commitHexDraft();
                    }}
                    placeholder="E5E5E5"
                    value={hexDraft}
                  />
                </div>
              </Field>
              {eyeDropperSupported ? (
                <Button
                  className="w-full rounded-md"
                  onClick={() => void pickFromScreen()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <IconColorPicker data-icon="inline-start" />
                  {t("pickFromScreen")}
                </Button>
              ) : null}
              {allowTransparency ? (
                <Button
                  aria-pressed={transparent}
                  className="w-full rounded-md"
                  onClick={() => onTransparencyChange?.(!transparent)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("transparentBackground")}
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </ColorPicker>
  );
}
