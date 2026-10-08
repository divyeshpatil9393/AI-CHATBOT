import { useCallback, useEffect, useState } from "react";
import { deleteDocument, fetchDocuments, getErrorMessage, uploadDocument } from "../api/client";
import { uid, validateFile } from "../utils/helpers";

export function useDocuments(notify) {
  const [documents, setDocuments] = useState([]);
  const [uploads, setUploads] = useState([]); // in-flight or failed uploads
  const [ready, setReady] = useState(false); // true once the server list has loaded successfully

  useEffect(() => {
    let cancelled = false;
    fetchDocuments()
      .then((docs) => {
        if (cancelled) return;
        setDocuments(docs);
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled) notify.error(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const patchUpload = useCallback(
    (id, patch) => setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u))),
    []
  );

  const upload = useCallback(
    async (file) => {
      const problem = validateFile(file);
      if (problem) {
        notify.error(problem);
        return null;
      }
      const id = uid();
      setUploads((list) => [...list, { id, name: file.name, progress: 0, phase: "uploading" }]);
      try {
        const doc = await uploadDocument(file, (progress) =>
          patchUpload(id, { progress, phase: progress >= 100 ? "processing" : "uploading" })
        );
        setDocuments((docs) => [doc, ...docs]);
        setUploads((list) => list.filter((u) => u.id !== id));
        notify.success(`${doc.filename} is ready to use.`);
        return doc;
      } catch (error) {
        patchUpload(id, { phase: "error", error: getErrorMessage(error) });
        return null;
      }
    },
    [notify, patchUpload]
  );

  const dismissUpload = useCallback((id) => setUploads((list) => list.filter((u) => u.id !== id)), []);

  const remove = useCallback(
    async (id) => {
      try {
        await deleteDocument(id);
        setDocuments((docs) => docs.filter((d) => d.document_id !== id));
      } catch (error) {
        notify.error(getErrorMessage(error));
      }
    },
    [notify]
  );

  return { documents, uploads, ready, upload, dismissUpload, remove };
}
