import { create } from "zustand";
import type { AutosaveStatus } from "@/application/portal/autosave-queue";
import {
  orderDocumentItemsForRender,
  type PortalDocument,
} from "@/domain/portal/document";
import {
  type PortalPublicationIssue,
  validatePortalPublicationReadiness,
} from "@/domain/portal/publication-readiness";

export type PortalAutosaveState = {
  error: string | null;
  status: AutosaveStatus;
};

export type PortalEditorState = {
  autosaveByPortalId: Record<string, PortalAutosaveState>;
  documentRevisionByPortalId: Record<string, number>;
  documentsByPortalId: Record<string, PortalDocument>;
  documentServerRevisionByPortalId: Record<string, number>;
  hasUnpublishedChangesByPortalId: Record<string, boolean>;
  lastPublishedPortalId: string | null;
  publishError: string | null;
  publishingPortalId: string | null;
  publicationIssuesByPortalId: Record<string, PortalPublicationIssue[]>;
  publicationPopoverOpenByPortalId: Record<string, boolean>;
  serverHydrationGenerationByPortalId: Record<string, number>;
  hydrateDocument: (
    portalId: string,
    document: PortalDocument,
    serverRevision?: number | null,
    hasUnpublishedChanges?: boolean,
  ) => void;
  initializeHasUnpublishedChanges: (
    portalId: string,
    hasChanges: boolean,
  ) => void;
  markPublishedIfRevision: (portalId: string, revision: number) => boolean;
  markDocumentPersisted: (portalId: string, serverRevision: number) => void;
  resetAutosaveState: (portalId: string) => void;
  setAutosaveState: (portalId: string, state: PortalAutosaveState) => void;
  setHasUnpublishedChanges: (portalId: string, hasChanges: boolean) => void;
  setLastPublishedPortalId: (portalId: string | null) => void;
  setPublishError: (error: string | null) => void;
  setPublishingPortalId: (portalId: string | null) => void;
  setPublicationIssues: (
    portalId: string,
    issues: PortalPublicationIssue[],
  ) => void;
  setPublicationPopoverOpen: (portalId: string, open: boolean) => void;
  updateDocument: (
    portalId: string,
    update: (document: PortalDocument) => PortalDocument,
  ) => PortalDocument | undefined;
};

export const usePortalEditorStore = create<PortalEditorState>((set) => ({
  autosaveByPortalId: {},
  documentRevisionByPortalId: {},
  documentsByPortalId: {},
  documentServerRevisionByPortalId: {},
  hasUnpublishedChangesByPortalId: {},
  lastPublishedPortalId: null,
  publishError: null,
  publishingPortalId: null,
  publicationIssuesByPortalId: {},
  publicationPopoverOpenByPortalId: {},
  serverHydrationGenerationByPortalId: {},
  hydrateDocument: (
    portalId,
    document,
    serverRevision,
    hasUnpublishedChanges,
  ) =>
    set((state) => {
      const autosaveStatus = state.autosaveByPortalId[portalId]?.status;
      const currentServerRevision =
        state.documentServerRevisionByPortalId[portalId];
      if (
        state.documentsByPortalId[portalId] &&
        (autosaveStatus === "saving" ||
          autosaveStatus === "error" ||
          (currentServerRevision !== undefined &&
            (serverRevision == null || serverRevision < currentServerRevision)))
      ) {
        return state;
      }
      return {
        documentRevisionByPortalId: {
          ...state.documentRevisionByPortalId,
          [portalId]: state.documentRevisionByPortalId[portalId] ?? 0,
        },
        documentsByPortalId: {
          ...state.documentsByPortalId,
          [portalId]: orderDocumentItemsForRender(document),
        },
        documentServerRevisionByPortalId:
          serverRevision !== undefined && serverRevision !== null
            ? {
                ...state.documentServerRevisionByPortalId,
                [portalId]: serverRevision,
              }
            : state.documentServerRevisionByPortalId,
        hasUnpublishedChangesByPortalId:
          hasUnpublishedChanges === undefined
            ? state.hasUnpublishedChangesByPortalId
            : {
                ...state.hasUnpublishedChangesByPortalId,
                [portalId]: hasUnpublishedChanges,
              },
        serverHydrationGenerationByPortalId: {
          ...state.serverHydrationGenerationByPortalId,
          [portalId]:
            (state.serverHydrationGenerationByPortalId[portalId] ?? 0) + 1,
        },
      };
    }),
  markDocumentPersisted: (portalId, serverRevision) =>
    set((state) => {
      const current = state.documentServerRevisionByPortalId[portalId];
      if (current !== undefined && current >= serverRevision) {
        return state;
      }
      return {
        documentServerRevisionByPortalId: {
          ...state.documentServerRevisionByPortalId,
          [portalId]: serverRevision,
        },
      };
    }),
  markPublishedIfRevision: (portalId, revision) => {
    let matched = false;
    set((state) => {
      if ((state.documentRevisionByPortalId[portalId] ?? 0) !== revision) {
        return state;
      }
      matched = true;
      return {
        hasUnpublishedChangesByPortalId: {
          ...state.hasUnpublishedChangesByPortalId,
          [portalId]: false,
        },
      };
    });
    return matched;
  },
  initializeHasUnpublishedChanges: (portalId, hasChanges) =>
    set((state) => {
      if (portalId in state.hasUnpublishedChangesByPortalId) {
        return state;
      }
      return {
        hasUnpublishedChangesByPortalId: {
          ...state.hasUnpublishedChangesByPortalId,
          [portalId]: hasChanges,
        },
      };
    }),
  resetAutosaveState: (portalId) =>
    set((state) => ({
      autosaveByPortalId: {
        ...state.autosaveByPortalId,
        [portalId]: { error: null, status: "idle" },
      },
    })),
  setAutosaveState: (portalId, autosaveState) =>
    set((state) => ({
      autosaveByPortalId: {
        ...state.autosaveByPortalId,
        [portalId]: autosaveState,
      },
    })),
  setHasUnpublishedChanges: (portalId, hasChanges) =>
    set((state) => ({
      hasUnpublishedChangesByPortalId: {
        ...state.hasUnpublishedChangesByPortalId,
        [portalId]: hasChanges,
      },
    })),
  setLastPublishedPortalId: (portalId) =>
    set({ lastPublishedPortalId: portalId }),
  setPublishError: (error) => set({ publishError: error }),
  setPublishingPortalId: (portalId) => set({ publishingPortalId: portalId }),
  setPublicationIssues: (portalId, issues) =>
    set((state) => ({
      publicationIssuesByPortalId: {
        ...state.publicationIssuesByPortalId,
        [portalId]: issues,
      },
    })),
  setPublicationPopoverOpen: (portalId, open) =>
    set((state) => ({
      publicationPopoverOpenByPortalId: {
        ...state.publicationPopoverOpenByPortalId,
        [portalId]: open,
      },
    })),
  updateDocument: (portalId, update) => {
    let nextDocument: PortalDocument | undefined;
    set((state) => {
      const current = state.documentsByPortalId[portalId];
      if (!current) return state;
      nextDocument = update(current);
      const publicationIssues = state.publicationIssuesByPortalId[portalId]
        ? validatePortalPublicationReadiness(nextDocument)
        : undefined;
      return {
        autosaveByPortalId: {
          ...state.autosaveByPortalId,
          [portalId]: { error: null, status: "saving" },
        },
        documentRevisionByPortalId: {
          ...state.documentRevisionByPortalId,
          [portalId]: (state.documentRevisionByPortalId[portalId] ?? 0) + 1,
        },
        documentsByPortalId: {
          ...state.documentsByPortalId,
          [portalId]: nextDocument,
        },
        publicationIssuesByPortalId: publicationIssues
          ? {
              ...state.publicationIssuesByPortalId,
              [portalId]: publicationIssues,
            }
          : state.publicationIssuesByPortalId,
        hasUnpublishedChangesByPortalId: {
          ...state.hasUnpublishedChangesByPortalId,
          [portalId]: true,
        },
      };
    });
    return nextDocument;
  },
}));
