import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (
      ![".ts", ".tsx"].includes(extname(entry.name)) ||
      entry.name.includes(".test.")
    ) {
      return [];
    }
    return [path];
  });
}

describe("translation catalogs", () => {
  test("keep English and Spanish message keys in sync", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(es).sort());
  });

  test("cover authentication, public portals, and the portal editor", () => {
    expect(en).toHaveProperty("Auth.signIn.title");
    expect(en).toHaveProperty("Auth.common.showPassword");
    expect(en).toHaveProperty("Auth.common.hidePassword");
    expect(en).toHaveProperty("Auth.signIn.emailPlaceholder");
    expect(en).toHaveProperty("Auth.signIn.passwordPlaceholder");
    expect(en).toHaveProperty("Auth.signUp.namePlaceholder");
    expect(en).toHaveProperty("Auth.signUp.emailPlaceholder");
    expect(en).toHaveProperty("Auth.signUp.passwordPlaceholder");
    expect(en).toHaveProperty("PublicPortal.password.label");
    expect(en).toHaveProperty("PortalEditor.sections.addTitle");
    expect(en).toHaveProperty("PortalViewer.actions.exportAll");
    expect(en).toHaveProperty("PortalViewer.summary.namePlaceholder");
    expect(en).toHaveProperty("PortalViewer.summary.descriptionPlaceholder");
    expect(es).toHaveProperty(
      "PortalEditor.image.fitOptions.cover",
      "Recortar",
    );
    expect(es).toHaveProperty(
      "PortalEditor.image.fitOptions.contain",
      "Contener",
    );
    expect(es).toHaveProperty("PortalEditor.image.fitOptions.fill", "Rellenar");
    expect(es).toHaveProperty(
      "PortalEditor.image.fitOptions.auto",
      "Automático",
    );
    expect(es).toHaveProperty("PortalEditor.image.ratioAuto", "Automática");
  });

  test("give every not-found surface a localized way forward", () => {
    for (const messages of [en, es]) {
      expect(messages).toHaveProperty("PublicPortal.notFound.viewProjects");
      expect(messages).toHaveProperty("PublicPortal.notFound.goHome");
      expect(messages).toHaveProperty("NotFound.title");
      expect(messages).toHaveProperty("NotFound.description");
      expect(messages).toHaveProperty("NotFound.viewProjects");
      expect(messages).toHaveProperty("NotFound.goHome");
    }
  });

  test("explains whether storage is shared or belongs to one portal", () => {
    expect(es).toHaveProperty(
      "PortalEditor.plan.storageLabels.free",
      "Almacenamiento de este proyecto",
    );
    expect(es).toHaveProperty(
      "PortalEditor.plan.storageLabels.premium",
      "Almacenamiento de este proyecto",
    );
    expect(es).toHaveProperty(
      "PortalEditor.plan.storageSummaries.free",
      "Plan Gratis. {used} de {limit} usados en este proyecto. {percent}%.",
    );
    expect(es).toHaveProperty(
      "PortalEditor.plan.storageSummaries.premium",
      "Plan Premium. {used} de {limit} usados en este proyecto. {percent}%.",
    );
    expect(en).toHaveProperty(
      "PortalEditor.plan.storageLabels.free",
      "This project's storage",
    );
    expect(en).toHaveProperty(
      "PortalEditor.plan.storageLabels.premium",
      "This project's storage",
    );
    expect(en).toHaveProperty(
      "PortalEditor.plan.storageSummaries.free",
      "Free plan. {used} of {limit} used by this project. {percent}%.",
    );
    expect(en).toHaveProperty(
      "PortalEditor.plan.storageSummaries.premium",
      "Premium plan. {used} of {limit} used by this project. {percent}%.",
    );
  });

  test("uses concise plan comparison copy in the upgrade modal", () => {
    expect(en).toHaveProperty("PortalEditor.plan.buy", "Buy for {price}");
    expect(es).toHaveProperty("PortalEditor.plan.buy", "Comprar por {price}");
    expect(en).toHaveProperty(
      "PortalEditor.plan.buyAccessible",
      "Buy {plan} for {price}",
    );
    expect(es).toHaveProperty(
      "PortalEditor.plan.buyAccessible",
      "Comprar {plan} por {price}",
    );
    expect(en).toHaveProperty(
      "PortalEditor.plan.compareDescription",
      "Compare storage and content limits before continuing.",
    );
    expect(es).toHaveProperty(
      "PortalEditor.plan.compareDescription",
      "Compara el almacenamiento y los límites de contenido antes de continuar.",
    );
  });

  test("does not leave Spanish UI copy hardcoded in app or components", () => {
    const files = [...sourceFiles("src/app"), ...sourceFiles("src/components")];
    const spanishUiCopy =
      /[áéíóúñÁÉÍÓÚÑ]|\b(?:Ajusta|Agregar|Archivos|Arrastra|Cambiar|Comprobando|Configurar|Contraseña|Cualquiera|Define el|Eliminar|Elegir|Familia|Guardar|Mostrar|Permitir|Privacidad|Quitar|Remover|Sitio web|Solo tu|Subir)\b/;
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return spanishUiCopy.test(source);
    });

    expect(offenders).toEqual([]);
  });

  test("keeps section and font fallbacks locale-safe", () => {
    const workspace = readFileSync(
      "src/components/portal/portal-workspace-controls.tsx",
      "utf8",
    );
    const renderer = readFileSync(
      "src/components/portal/render-portal/render-portal.tsx",
      "utf8",
    );

    expect(workspace).not.toContain("section.title || section.type");
    expect(renderer).not.toContain("section.title || section.type");
    expect(workspace).not.toContain("t(`weights.$" + "{weight}`)");
    expect(renderer).not.toContain("t(`sectionTypes.$" + "{section.type}`)");
  });

  test("shows localized portal summary placeholders only while editing", () => {
    const renderer = readFileSync(
      "src/components/portal/render-portal/render-portal.tsx",
      "utf8",
    );

    expect(renderer).toContain(
      'placeholder={editable ? t("namePlaceholder") : undefined}',
    );
    expect(renderer).toContain(
      'placeholder={editable ? t("descriptionPlaceholder") : undefined}',
    );
  });

  test("provides localized item models to Base UI selects", () => {
    const workspace = readFileSync(
      "src/components/portal/portal-workspace-controls.tsx",
      "utf8",
    );

    expect(workspace).toContain("items={imageFitItems}");
    expect(workspace).toContain("items={aspectRatioItems}");
    expect(workspace).toContain("items={layoutModeItems}");
    expect(workspace).toContain("items={colorFormatItems}");
    expect(workspace).toContain("items={visibilityItems}");

    const selectOpeningTags = workspace.match(/<Select\n[\s\S]*?>/g) ?? [];
    expect(selectOpeningTags.length).toBeGreaterThan(0);
    expect(selectOpeningTags.filter((tag) => !tag.includes("items="))).toEqual(
      [],
    );
  });
});
