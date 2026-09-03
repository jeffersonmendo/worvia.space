"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRandomId } from "@/lib/random-id";

export type UploadedFile = {
  file: File;
  id: string;
  preview?: string;
};

type FileUploadOptions = {
  accept?: string;
  maxSize?: number;
  onPreflight?: (result: {
    acceptedFiles: File[];
    rejectedFileCount: number;
  }) => void;
  preflightFiles?: (files: File[]) => Promise<{
    acceptedFiles: File[];
    rejectedFileCount: number;
  }>;
  validateFile?: (file: File, existingFiles: File[]) => string | undefined;
};

function matchesAccept(file: File, accept: string) {
  return accept.split(",").some((entry) => {
    const rule = entry.trim().toLowerCase();
    if (!rule) return false;
    if (rule.endsWith("/*"))
      return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    return file.type.toLowerCase() === rule;
  });
}

export function useFileUpload({
  accept = "*/*",
  maxSize,
  onPreflight,
  preflightFiles,
  validateFile,
}: FileUploadOptions = {}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const filesRef = useRef(files);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (incoming: File[]) => {
      setIsPreflighting(true);
      try {
        const preflight = preflightFiles
          ? await preflightFiles(incoming)
          : { acceptedFiles: incoming, rejectedFileCount: 0 };
        if (preflight.rejectedFileCount > 0) onPreflight?.(preflight);
        const nextErrors: string[] = [];
        const validFiles: File[] = [];
        const acceptedFiles = filesRef.current.map(({ file }) => file);
        for (const file of preflight.acceptedFiles) {
          if (!matchesAccept(file, accept)) {
            nextErrors.push(`${file.name}: File type is not supported.`);
            continue;
          }
          if (maxSize && file.size > maxSize) {
            nextErrors.push(
              `${file.name}: File exceeds the ${Math.round(maxSize / 1024 / 1024)}MB limit.`,
            );
            continue;
          }
          const validationError = validateFile?.(file, acceptedFiles);
          if (validationError) {
            nextErrors.push(`${file.name}: ${validationError}`);
            continue;
          }
          validFiles.push(file);
          acceptedFiles.push(file);
        }

        setErrors(nextErrors);
        setFiles((current) => {
          const existing = new Set(
            current.map(
              ({ file }) => `${file.name}:${file.size}:${file.lastModified}`,
            ),
          );
          const additions = validFiles
            .filter((file) => {
              const key = `${file.name}:${file.size}:${file.lastModified}`;
              if (existing.has(key)) return false;
              existing.add(key);
              return true;
            })
            .map((file) => ({
              file,
              id: `${file.name}-${file.size}-${file.lastModified}-${createRandomId()}`,
              preview: file.type.startsWith("image/")
                ? URL.createObjectURL(file)
                : undefined,
            }));
          return [...current, ...additions];
        });
      } finally {
        setIsPreflighting(false);
      }
    },
    [accept, maxSize, onPreflight, preflightFiles, validateFile],
  );

  const removeFile = useCallback((id?: string) => {
    if (!id) return;
    setFiles((current) => {
      const removed = current.find((file) => file.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter((file) => file.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((current) => {
      for (const { preview } of current) {
        if (preview) URL.revokeObjectURL(preview);
      }
      return [];
    });
    setErrors([]);
  }, []);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(
    () => () => {
      filesRef.current.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [],
  );

  return [
    { files, isDragging, isPreflighting, errors },
    {
      handleDragEnter: (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(true);
      },
      handleDragLeave: (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
      },
      handleDragOver: (event: React.DragEvent) => event.preventDefault(),
      handleDrop: (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
        void addFiles(Array.from(event.dataTransfer.files));
      },
      openFileDialog: () => inputRef.current?.click(),
      clearFiles,
      removeFile,
      getInputProps: () => ({
        accept,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          void addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        },
        ref: inputRef,
        type: "file" as const,
      }),
    },
  ] as const;
}
